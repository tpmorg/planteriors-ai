import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  SavedDesign,
  PlantSelectionMode,
  PlantSize,
  PlacementType,
  SubscriptionData,
  FreeTrialUsage
} from '../types';

const DB_VERSION = 2; // Current database version

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing: boolean = false;

  async initialize(): Promise<void> {
    // Prevent concurrent initialization attempts
    if (this.isInitializing) {
      console.log('Database initialization already in progress, waiting...');
      // Wait for current initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }

    this.isInitializing = true;
    try {
      this.db = await SQLite.openDatabaseAsync('plantai.db');
      await this.createTables();
      await this.runMigrations();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Ensures the database connection is valid.
   * Re-initializes if the connection was lost (e.g., after hot reload or backgrounding).
   */
  private async ensureConnection(): Promise<void> {
    if (!this.db) {
      console.log('Database connection lost, re-initializing...');
      await this.initialize();
      return;
    }

    // Test if the connection is still valid by running a simple query
    try {
      await this.db.getFirstAsync('SELECT 1');
    } catch (error) {
      console.log('Database connection stale, re-initializing...', error);
      this.db = null;
      await this.initialize();
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create db_version table for tracking migrations
    const createVersionTable = `
      CREATE TABLE IF NOT EXISTS db_version (
        version INTEGER PRIMARY KEY
      );
    `;
    await this.db.execAsync(createVersionTable);

    const createDesignsTable = `
      CREATE TABLE IF NOT EXISTS saved_designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_image_uri TEXT NOT NULL,
        generated_image_uri TEXT NOT NULL,
        local_image_path TEXT,
        user_id TEXT,
        mode TEXT DEFAULT 'multi-plant',
        plant_type_name TEXT,
        plant_type_description TEXT,
        plant_style_name TEXT,
        plant_style_description TEXT,
        individual_plant_name TEXT,
        individual_plant_scientific_name TEXT,
        individual_plant_size TEXT,
        individual_plant_placement TEXT,
        custom_prompt TEXT,
        created_at INTEGER NOT NULL,
        is_favorite INTEGER DEFAULT 0
      );
    `;
    await this.db.execAsync(createDesignsTable);

    // Create usage_tracking table
    const createUsageTrackingTable = `
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        generation_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        generation_request TEXT
      );
    `;
    await this.db.execAsync(createUsageTrackingTable);

    // Create subscriptions table
    const createSubscriptionsTable = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        subscription_status TEXT NOT NULL,
        subscription_type TEXT,
        purchase_token TEXT,
        original_transaction_id TEXT,
        platform TEXT,
        purchase_date INTEGER,
        expiry_date INTEGER,
        is_mock INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `;
    await this.db.execAsync(createSubscriptionsTable);

    // Create free_trial_usage table
    const createFreeTrialUsageTable = `
      CREATE TABLE IF NOT EXISTS free_trial_usage (
        user_id TEXT PRIMARY KEY,
        generations_used INTEGER DEFAULT 0,
        first_generation_at INTEGER,
        last_generation_at INTEGER,
        created_at INTEGER NOT NULL
      );
    `;
    await this.db.execAsync(createFreeTrialUsageTable);

    // Create indexes
    await this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_saved_designs_user_id ON saved_designs(user_id);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at ON usage_tracking(created_at);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      `);
    } catch (error) {
      console.warn('Failed to create some indexes (may already exist):', error);
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.db) return;

    const currentVersion = await this.getCurrentDbVersion();
    console.log('Current database version:', currentVersion);

    // Migration from v0 to v1: Add individual plant columns
    if (currentVersion < 1) {
      console.log('Running migration to v1: Adding individual plant columns');
      await this.migrateToV1();
      await this.setDbVersion(1);
    }

    // Migration from v1 to v2: Add user_id column and subscription tables
    if (currentVersion < 2) {
      console.log('Running migration to v2: Adding user_id and subscription support');
      await this.migrateToV2();
      await this.setDbVersion(2);
    }

    console.log('Migrations complete. Database at version:', DB_VERSION);
  }

  private async getCurrentDbVersion(): Promise<number> {
    if (!this.db) return 0;

    try {
      const result = await this.db.getFirstAsync<{ version: number }>(
        'SELECT version FROM db_version LIMIT 1'
      );
      return result?.version || 0;
    } catch {
      return 0;
    }
  }

  private async setDbVersion(version: number): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync('DELETE FROM db_version');
      await this.db.runAsync('INSERT INTO db_version (version) VALUES (?)', [version]);
    } catch (error) {
      console.error('Failed to set database version:', error);
    }
  }

  private async migrateToV1(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN mode TEXT DEFAULT 'multi-plant';
      `);
    } catch {
      // Column already exists
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN individual_plant_name TEXT;
      `);
    } catch {
      // Column already exists
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN individual_plant_scientific_name TEXT;
      `);
    } catch {
      // Column already exists
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN individual_plant_size TEXT;
      `);
    } catch {
      // Column already exists
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN individual_plant_placement TEXT;
      `);
    } catch {
      // Column already exists
    }
  }

  private async migrateToV2(): Promise<void> {
    if (!this.db) return;

    // Add user_id column to saved_designs
    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN user_id TEXT;
      `);
      console.log('Added user_id column to saved_designs');
    } catch {
      // Column already exists
    }

    // Note: New tables (usage_tracking, subscriptions, free_trial_usage)
    // are created in createTables() with CREATE TABLE IF NOT EXISTS,
    // so they will be created automatically if they don't exist yet.
  }

  async saveDesign(design: {
    originalImageUri: string;
    generatedImageUri: string;
    userId?: string;
    mode: PlantSelectionMode;
    // Multi-plant mode fields
    plantTypeName?: string;
    plantTypeDescription?: string;
    plantStyleName?: string;
    plantStyleDescription?: string;
    // Individual plant mode fields
    individualPlantName?: string;
    individualPlantScientificName?: string;
    individualPlantSize?: PlantSize;
    individualPlantPlacement?: PlacementType;
    customPrompt?: string;
  }): Promise<SavedDesign> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Save image to local storage if it's a data URI
      let localImagePath: string | null = null;
      if (design.generatedImageUri.startsWith('data:')) {
        localImagePath = await this.saveImageToLocal(design.generatedImageUri);
      }

      // For backwards compatibility with NOT NULL constraints on legacy databases,
      // provide default values for plant_type_name and plant_style_name when in individual mode
      const plantTypeName = design.plantTypeName || (design.mode === 'individual' ? 'Individual Plant' : '');
      const plantTypeDescription = design.plantTypeDescription || (design.mode === 'individual' ? design.individualPlantName || '' : '');
      const plantStyleName = design.plantStyleName || (design.mode === 'individual' ? design.individualPlantSize || '' : '');
      const plantStyleDescription = design.plantStyleDescription || (design.mode === 'individual' ? design.individualPlantPlacement || '' : '');

      const result = await this.db.runAsync(
        `INSERT INTO saved_designs (
          original_image_uri, generated_image_uri, local_image_path,
          user_id, mode,
          plant_type_name, plant_type_description,
          plant_style_name, plant_style_description,
          individual_plant_name, individual_plant_scientific_name,
          individual_plant_size, individual_plant_placement,
          custom_prompt, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          design.originalImageUri,
          design.generatedImageUri,
          localImagePath,
          design.userId || null,
          design.mode,
          plantTypeName,
          plantTypeDescription,
          plantStyleName,
          plantStyleDescription,
          design.individualPlantName || null,
          design.individualPlantScientificName || null,
          design.individualPlantSize || null,
          design.individualPlantPlacement || null,
          design.customPrompt || '',
          Date.now()
        ]
      );

      const savedDesign: SavedDesign = {
        id: result.lastInsertRowId.toString(),
        originalImageUri: design.originalImageUri,
        generatedImageUri: design.generatedImageUri,
        localImagePath,
        mode: design.mode,
        plantType: design.mode === 'multi-plant' && design.plantTypeName ? {
          name: design.plantTypeName,
          description: design.plantTypeDescription || '',
        } : undefined,
        plantStyle: design.mode === 'multi-plant' && design.plantStyleName ? {
          name: design.plantStyleName,
          description: design.plantStyleDescription || '',
        } : undefined,
        individualPlant: design.mode === 'individual' && design.individualPlantName ? {
          name: design.individualPlantName,
          scientificName: design.individualPlantScientificName || '',
          size: design.individualPlantSize!,
          placement: design.individualPlantPlacement!,
        } : undefined,
        customPrompt: design.customPrompt,
        createdAt: new Date(Date.now()),
        isFavorite: false,
      };

      console.log('Design saved to database with ID:', result.lastInsertRowId);
      return savedDesign;
    } catch (error) {
      console.error('Failed to save design:', error);
      throw error;
    }
  }

  async getAllDesigns(): Promise<SavedDesign[]> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync(`
        SELECT * FROM saved_designs
        ORDER BY created_at DESC
      `);

      return result.map(this.mapRowToSavedDesign);
    } catch (error) {
      console.error('Failed to get designs:', error);
      throw error;
    }
  }

  async getDesignById(id: string): Promise<SavedDesign | null> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM saved_designs WHERE id = ?',
        [id]
      );

      return result ? this.mapRowToSavedDesign(result) : null;
    } catch (error) {
      console.error('Failed to get design by ID:', error);
      throw error;
    }
  }

  async toggleFavorite(id: string): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE saved_designs SET is_favorite = 1 - is_favorite WHERE id = ?',
        [id]
      );
      console.log('Toggled favorite for design:', id);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  }

  async deleteDesign(id: string): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Get the design to delete local image file if exists
      const design = await this.getDesignById(id);
      if (design?.localImagePath) {
        try {
          await FileSystem.deleteAsync(design.localImagePath);
        } catch (fileError) {
          console.warn('Failed to delete local image file:', fileError);
        }
      }

      await this.db.runAsync('DELETE FROM saved_designs WHERE id = ?', [id]);
      console.log('Design deleted:', id);
    } catch (error) {
      console.error('Failed to delete design:', error);
      throw error;
    }
  }

  private async saveImageToLocal(dataUri: string): Promise<string> {
    try {
      const fileName = `design_${Date.now()}.png`;
      const filePath = `${FileSystem.documentDirectory}designs/${fileName}`;

      // Ensure directory exists
      const dirPath = `${FileSystem.documentDirectory}designs/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      // Extract base64 data from data URI
      const base64Data = dataUri.split(',')[1];
      await FileSystem.writeAsStringAsync(filePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('Image saved to local storage:', filePath);
      return filePath;
    } catch (error) {
      console.error('Failed to save image to local storage:', error);
      throw error;
    }
  }

  private mapRowToSavedDesign(row: any): SavedDesign {
    const mode: PlantSelectionMode = row.mode || 'multi-plant';

    return {
      id: row.id.toString(),
      originalImageUri: row.original_image_uri,
      generatedImageUri: row.generated_image_uri,
      localImagePath: row.local_image_path,
      mode,
      plantType: row.plant_type_name ? {
        name: row.plant_type_name,
        description: row.plant_type_description || '',
      } : undefined,
      plantStyle: row.plant_style_name ? {
        name: row.plant_style_name,
        description: row.plant_style_description || '',
      } : undefined,
      individualPlant: row.individual_plant_name ? {
        name: row.individual_plant_name,
        scientificName: row.individual_plant_scientific_name || '',
        size: row.individual_plant_size as PlantSize,
        placement: row.individual_plant_placement as PlacementType,
      } : undefined,
      customPrompt: row.custom_prompt || undefined,
      createdAt: new Date(row.created_at),
      isFavorite: Boolean(row.is_favorite),
    };
  }

  // ============================================
  // Subscription Management Methods
  // ============================================

  async saveSubscription(subscription: SubscriptionData): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = Date.now();
      await this.db.runAsync(
        `INSERT OR REPLACE INTO subscriptions (
          user_id, subscription_status, subscription_type,
          purchase_token, original_transaction_id, platform,
          purchase_date, expiry_date, is_mock,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subscription.userId,
          subscription.subscriptionStatus,
          subscription.subscriptionType || null,
          subscription.purchaseToken || null,
          subscription.originalTransactionId || null,
          subscription.platform || null,
          subscription.purchaseDate || null,
          subscription.expiryDate || null,
          subscription.isMock ? 1 : 0,
          subscription.createdAt || now,
          now
        ]
      );
      console.log('Subscription saved for user:', subscription.userId);
    } catch (error) {
      console.error('Failed to save subscription:', error);
      throw error;
    }
  }

  async getSubscription(userId: string): Promise<SubscriptionData | null> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<any>(
        'SELECT * FROM subscriptions WHERE user_id = ?',
        [userId]
      );

      if (!result) return null;

      return {
        id: result.id,
        userId: result.user_id,
        subscriptionStatus: result.subscription_status,
        subscriptionType: result.subscription_type,
        purchaseToken: result.purchase_token,
        originalTransactionId: result.original_transaction_id,
        platform: result.platform,
        purchaseDate: result.purchase_date,
        expiryDate: result.expiry_date,
        isMock: Boolean(result.is_mock),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      console.error('Failed to get subscription:', error);
      throw error;
    }
  }

  async updateSubscriptionStatus(
    userId: string,
    status: string,
    expiryDate: number
  ): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `UPDATE subscriptions
         SET subscription_status = ?, expiry_date = ?, updated_at = ?
         WHERE user_id = ?`,
        [status, expiryDate, Date.now(), userId]
      );
      console.log('Updated subscription status for user:', userId);
    } catch (error) {
      console.error('Failed to update subscription status:', error);
      throw error;
    }
  }

  async deleteSubscription(userId: string): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
      console.log('Subscription deleted for user:', userId);
    } catch (error) {
      console.error('Failed to delete subscription:', error);
      throw error;
    }
  }

  // ============================================
  // Usage Tracking Methods
  // ============================================

  async trackUsage(
    userId: string,
    generationType: 'free' | 'paid',
    requestData?: string
  ): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `INSERT INTO usage_tracking (user_id, generation_type, created_at, generation_request)
         VALUES (?, ?, ?, ?)`,
        [userId, generationType, Date.now(), requestData || null]
      );
      console.log(`Tracked ${generationType} generation for user:`, userId);
    } catch (error) {
      console.error('Failed to track usage:', error);
      throw error;
    }
  }

  async getFreeTrialUsage(userId: string): Promise<FreeTrialUsage> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<any>(
        'SELECT * FROM free_trial_usage WHERE user_id = ?',
        [userId]
      );

      if (!result) {
        // Return default values if no record exists
        return {
          userId,
          generationsUsed: 0,
          firstGenerationAt: null,
          lastGenerationAt: null,
        };
      }

      return {
        userId: result.user_id,
        generationsUsed: result.generations_used,
        firstGenerationAt: result.first_generation_at,
        lastGenerationAt: result.last_generation_at,
      };
    } catch (error) {
      console.error('Failed to get free trial usage:', error);
      throw error;
    }
  }

  async updateFreeTrialUsage(userId: string, incrementBy: number = 1): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const current = await this.getFreeTrialUsage(userId);
      const now = Date.now();

      if (current.generationsUsed === 0) {
        // First generation - create new record
        await this.db.runAsync(
          `INSERT INTO free_trial_usage (user_id, generations_used, first_generation_at, last_generation_at, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, incrementBy, now, now, now]
        );
      } else {
        // Update existing record
        await this.db.runAsync(
          `UPDATE free_trial_usage
           SET generations_used = generations_used + ?,
               last_generation_at = ?
           WHERE user_id = ?`,
          [incrementBy, now, userId]
        );
      }
      console.log(`Updated free trial usage for user ${userId}: +${incrementBy}`);
    } catch (error) {
      console.error('Failed to update free trial usage:', error);
      throw error;
    }
  }

  async getTotalGenerations(userId: string): Promise<number> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ total: number }>(
        'SELECT COUNT(*) as total FROM usage_tracking WHERE user_id = ?',
        [userId]
      );
      return result?.total || 0;
    } catch (error) {
      console.error('Failed to get total generations:', error);
      throw error;
    }
  }

  async assignUserIdToExistingDesigns(userId: string): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE saved_designs SET user_id = ? WHERE user_id IS NULL',
        [userId]
      );
      console.log('Assigned user_id to existing designs:', userId);
    } catch (error) {
      console.error('Failed to assign user_id to existing designs:', error);
      throw error;
    }
  }

  // ============================================
  // Testing Helper Methods
  // ============================================

  async resetUserUsage(userId: string): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM usage_tracking WHERE user_id = ?', [userId]);
      await this.db.runAsync('DELETE FROM free_trial_usage WHERE user_id = ?', [userId]);
      console.log('Reset usage for user:', userId);
    } catch (error) {
      console.error('Failed to reset user usage:', error);
      throw error;
    }
  }
}

export const databaseService = new DatabaseService();