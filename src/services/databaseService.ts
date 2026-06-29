import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  SavedDesign,
  PlantSelectionMode,
  PlantSize,
  PlacementType,
  SubscriptionData,
  FreeTrialUsage,
  Collection,
  IdentifiedDesignPlant
} from '../types';
import { INDIVIDUAL_PLANTS } from '../data/plantDatabase';

const DB_VERSION = 7; // Current database version

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing: boolean = false;

  private async resolveInsertRowId(result: { lastInsertRowId?: number | null }): Promise<number> {
    if (typeof result.lastInsertRowId === 'number' && Number.isFinite(result.lastInsertRowId)) {
      return result.lastInsertRowId;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const fallback = await this.db.getFirstAsync<{ id: number }>('SELECT last_insert_rowid() as id');
    if (!fallback || typeof fallback.id !== 'number' || !Number.isFinite(fallback.id)) {
      throw new Error('Failed to resolve inserted row id');
    }
    return fallback.id;
  }

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
      await this.reconcileSchema();
      await this.seedStaticPlants();
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
        collection_id INTEGER,
        plant_type_name TEXT,
        plant_type_description TEXT,
        plant_style_name TEXT,
        plant_style_description TEXT,
        individual_plant_name TEXT,
        individual_plant_scientific_name TEXT,
        individual_plant_size TEXT,
        individual_plant_placement TEXT,
        individual_plant_id TEXT,
        generated_plants_json TEXT,
        custom_prompt TEXT,
        created_at INTEGER NOT NULL,
        is_favorite INTEGER DEFAULT 0
      );
    `;
    await this.db.execAsync(createDesignsTable);

    const createCollectionsTable = `
      CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `;
    await this.db.execAsync(createCollectionsTable);

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

    // Create plants table for plant codex
    const createPlantsTable = `
      CREATE TABLE IF NOT EXISTS plants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scientific_name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        icon TEXT,
        care_level TEXT,
        light_requirement TEXT,
        water_requirement TEXT,
        pet_safe INTEGER,
        available_sizes TEXT,
        suitable_placements TEXT,
        trefle_id TEXT,
        is_popular INTEGER DEFAULT 0,
        user_added INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      );
    `;
    await this.db.execAsync(createPlantsTable);

    // Create plant images table
    const createPlantImagesTable = `
      CREATE TABLE IF NOT EXISTS plant_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plant_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        local_path TEXT,
        is_primary INTEGER DEFAULT 0,
        source TEXT,
        attribution TEXT,
        downloaded_at INTEGER,
        FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
      );
    `;
    await this.db.execAsync(createPlantImagesTable);

    // Create FTS5 virtual table for full-text search
    try {
      await this.db.execAsync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS plants_fts USING fts5(
          name,
          scientific_name,
          description,
          content='plants',
          content_rowid='rowid'
        );
      `);

      // Create triggers to sync FTS5
      await this.db.execAsync(`
        CREATE TRIGGER IF NOT EXISTS plants_ai AFTER INSERT ON plants BEGIN
          INSERT INTO plants_fts(rowid, name, scientific_name, description)
          VALUES (new.rowid, new.name, new.scientific_name, new.description);
        END;

        CREATE TRIGGER IF NOT EXISTS plants_ad AFTER DELETE ON plants BEGIN
          INSERT INTO plants_fts(plants_fts, rowid, name, scientific_name, description)
          VALUES ('delete', old.rowid, old.name, old.scientific_name, old.description);
        END;

        CREATE TRIGGER IF NOT EXISTS plants_au AFTER UPDATE ON plants BEGIN
          INSERT INTO plants_fts(plants_fts, rowid, name, scientific_name, description)
          VALUES ('delete', old.rowid, old.name, old.scientific_name, old.description);
          INSERT INTO plants_fts(rowid, name, scientific_name, description)
          VALUES (new.rowid, new.name, new.scientific_name, new.description);
        END;
      `);
    } catch (error) {
      console.warn('FTS5 not available, search will use LIKE queries:', error);
    }

    // Create search cache table
    const createSearchCacheTable = `
      CREATE TABLE IF NOT EXISTS plant_search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        results_json TEXT NOT NULL,
        result_count INTEGER,
        searched_at INTEGER,
        expires_at INTEGER
      );
    `;
    await this.db.execAsync(createSearchCacheTable);

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
      
      // Plant codex indexes
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_plants_category ON plants(category);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_plants_care_level ON plants(care_level);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_plants_popular ON plants(is_popular);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_plants_user_added ON plants(user_added);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_plant_images_plant_id ON plant_images(plant_id);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_search_cache_query ON plant_search_cache(query);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON plant_search_cache(expires_at);
      `);
    } catch (error) {
      console.warn('Failed to create some indexes (may already exist):', error);
    }
  }

  private async reconcileSchema(): Promise<void> {
    if (!this.db) return;

    await this.ensureTableColumn('saved_designs', 'individual_plant_id', 'TEXT');
    await this.ensureTableColumn('saved_designs', 'generated_plants_json', 'TEXT');
    await this.ensureTableColumn('saved_designs', 'collection_id', 'INTEGER');
  }

  private async ensureTableColumn(
    tableName: string,
    columnName: string,
    columnDefinition: string
  ): Promise<void> {
    if (!this.db) return;

    try {
      const columns = await this.db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
      const hasColumn = columns.some((column) => column.name === columnName);
      if (hasColumn) {
        return;
      }

      await this.db.execAsync(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`
      );
      console.log(`Added missing column ${tableName}.${columnName}`);
    } catch (error) {
      console.warn(`Failed to ensure column ${tableName}.${columnName}:`, error);
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

    // Migration from v2 to v3: Add plant codex tables
    if (currentVersion < 3) {
      console.log('Running migration to v3: Adding plant codex tables');
      await this.migrateToV3();
      await this.setDbVersion(3);
    }

    // Migration from v3 to v4: Add collections support
    if (currentVersion < 4) {
      console.log('Running migration to v4: Adding collections support');
      await this.migrateToV4();
      await this.setDbVersion(4);
    }

    // Migration from v4 to v5: Add user_added flag to plants
    if (currentVersion < 5) {
      console.log('Running migration to v5: Adding user_added flag to plants');
      await this.migrateToV5();
      await this.setDbVersion(5);
    }

    // Migration from v5 to v6: Add plant ID reference to individual plant designs
    if (currentVersion < 6) {
      console.log('Running migration to v6: Adding plant ID to individual design records');
      await this.migrateToV6();
      await this.setDbVersion(6);
    }

    // Migration from v6 to v7: Store generated multi-plant identification results
    if (currentVersion < 7) {
      console.log('Running migration to v7: Adding generated plant identification results');
      await this.migrateToV7();
      await this.setDbVersion(7);
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

  private async migrateToV3(): Promise<void> {
    if (!this.db) return;

    try {
      // Plants table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS plants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          scientific_name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          icon TEXT,
          care_level TEXT,
          light_requirement TEXT,
          water_requirement TEXT,
          pet_safe INTEGER,
          available_sizes TEXT,
          suitable_placements TEXT,
          trefle_id TEXT,
          is_popular INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Plant images table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS plant_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plant_id TEXT NOT NULL,
          image_url TEXT NOT NULL,
          local_path TEXT,
          is_primary INTEGER DEFAULT 0,
          source TEXT,
          attribution TEXT,
          downloaded_at INTEGER,
          FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
        );
      `);

      // FTS5 virtual table
      try {
        await this.db.execAsync(`
          CREATE VIRTUAL TABLE IF NOT EXISTS plants_fts USING fts5(
            name,
            scientific_name,
            description,
            content='plants',
            content_rowid='rowid'
          );
        `);

        // FTS5 triggers
        await this.db.execAsync(`
          CREATE TRIGGER IF NOT EXISTS plants_ai AFTER INSERT ON plants BEGIN
            INSERT INTO plants_fts(rowid, name, scientific_name, description)
            VALUES (new.rowid, new.name, new.scientific_name, new.description);
          END;

          CREATE TRIGGER IF NOT EXISTS plants_ad AFTER DELETE ON plants BEGIN
            INSERT INTO plants_fts(plants_fts, rowid, name, scientific_name, description)
            VALUES ('delete', old.rowid, old.name, old.scientific_name, old.description);
          END;

          CREATE TRIGGER IF NOT EXISTS plants_au AFTER UPDATE ON plants BEGIN
            INSERT INTO plants_fts(plants_fts, rowid, name, scientific_name, description)
            VALUES ('delete', old.rowid, old.name, old.scientific_name, old.description);
            INSERT INTO plants_fts(rowid, name, scientific_name, description)
            VALUES (new.rowid, new.name, new.scientific_name, new.description);
          END;
        `);
      } catch (error) {
        console.warn('FTS5 not available, falling back to LIKE queries');
      }

      // Search cache table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS plant_search_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          results_json TEXT NOT NULL,
          result_count INTEGER,
          searched_at INTEGER,
          expires_at INTEGER
        );
      `);

      // Indexes
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_plants_category ON plants(category);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_plants_care_level ON plants(care_level);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_plants_popular ON plants(is_popular);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_plant_images_plant_id ON plant_images(plant_id);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_search_cache_query ON plant_search_cache(query);`);
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON plant_search_cache(expires_at);`);

      console.log('Plant codex tables created successfully');
    } catch (error) {
      console.error('Failed to create plant codex tables:', error);
      throw error;
    }
  }

  private async migrateToV4(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN collection_id INTEGER;
      `);
    } catch {
      // Column already exists
    }

    try {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
    } catch (error) {
      console.warn('Failed to create collections table:', error);
    }

    try {
      await this.db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_saved_designs_collection_id ON saved_designs(collection_id);`
      );
      await this.db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);`
      );
      await this.db.execAsync(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_user_name ON collections(user_id, name);`
      );
    } catch {
      // ignore
    }
  }

  private async migrateToV5(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`
        ALTER TABLE plants ADD COLUMN user_added INTEGER DEFAULT 0;
      `);
    } catch {
      // Column already exists
    }

    try {
      await this.db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_plants_user_added ON plants(user_added);`
      );
    } catch {
      // ignore
    }
  }

  private async migrateToV6(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN individual_plant_id TEXT;
      `);
    } catch {
      // Column already exists
    }

    try {
      await this.db.runAsync(`
        UPDATE saved_designs
        SET individual_plant_id = (
          SELECT p.id
          FROM plants p
          WHERE lower(p.name) = lower(saved_designs.individual_plant_name)
          LIMIT 1
        )
        WHERE mode = 'individual'
          AND individual_plant_id IS NULL
          AND individual_plant_name IS NOT NULL
          AND TRIM(individual_plant_name) <> '';
      `);
      await this.db.runAsync(`
        UPDATE saved_designs
        SET individual_plant_id = (
          SELECT p.id
          FROM plants p
          WHERE lower(p.scientific_name) = lower(saved_designs.individual_plant_scientific_name)
          LIMIT 1
        )
        WHERE mode = 'individual'
          AND individual_plant_id IS NULL
          AND individual_plant_scientific_name IS NOT NULL
          AND TRIM(individual_plant_scientific_name) <> '';
      `);
    } catch {
      // Ignore backfill failures; column may not exist yet on unexpected schema state.
    }
  }

  private async migrateToV7(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN generated_plants_json TEXT;
      `);
    } catch {
      // Column already exists
    }
  }

  // ============================================
  // Plant Codex Methods
  // ============================================

  async savePlant(plant: {
    id: string;
    name: string;
    scientificName: string;
    description?: string;
    category?: string;
    icon?: string;
    careLevel?: string;
    lightRequirement?: string;
    waterRequirement?: string;
    petSafe?: boolean;
    availableSizes?: string[];
    suitablePlacements?: string[];
    trefleId?: string;
    isPopular?: boolean;
    userAdded?: boolean;
  }): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO plants (
          id, name, scientific_name, description, category, icon,
          care_level, light_requirement, water_requirement, pet_safe,
          available_sizes, suitable_placements, trefle_id, is_popular,
          user_added, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plant.id,
          plant.name,
          plant.scientificName,
          plant.description || null,
          plant.category || null,
          plant.icon || 'Leaf',
          plant.careLevel || 'easy',
          plant.lightRequirement || 'bright-indirect',
          plant.waterRequirement || 'moderate',
          plant.petSafe ? 1 : 0,
          plant.availableSizes ? JSON.stringify(plant.availableSizes) : '[]',
          plant.suitablePlacements ? JSON.stringify(plant.suitablePlacements) : '[]',
          plant.trefleId || null,
          plant.isPopular ? 1 : 0,
          plant.userAdded ? 1 : 0,
          Date.now(),
          Date.now()
        ]
      );
    } catch (error) {
      console.error('Failed to save plant:', error);
      throw error;
    }
  }

  private async seedStaticPlants(): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    try {
      for (const plant of INDIVIDUAL_PLANTS) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO plants (
            id, name, scientific_name, description, category, icon,
            care_level, light_requirement, water_requirement, pet_safe,
            available_sizes, suitable_placements, trefle_id, is_popular,
            user_added, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            plant.id,
            plant.name,
            plant.scientificName,
            plant.description,
            plant.category,
            plant.icon,
            plant.careLevel,
            plant.lightRequirement,
            plant.waterRequirement,
            plant.petSafe ? 1 : 0,
            JSON.stringify(plant.availableSizes),
            JSON.stringify(plant.suitablePlacements),
            null,
            1,
            0,
            now,
            now,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to seed static plants:', error);
      throw error;
    }
  }

  async getPopularPlants(limit: number = 50): Promise<any[]> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = await this.db.getAllAsync(
        `SELECT p.*, 
          pi.local_path as local_image_path,
          pi.image_url as primary_image_url
         FROM plants p
         LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
         WHERE p.is_popular = 1
         ORDER BY p.name ASC
         LIMIT ?`,
        [limit]
      );

      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        scientificName: row.scientific_name,
        description: row.description,
        category: row.category,
        icon: row.icon,
        careLevel: row.care_level,
        lightRequirement: row.light_requirement,
        waterRequirement: row.water_requirement,
        petSafe: row.pet_safe === 1,
        availableSizes: row.available_sizes ? JSON.parse(row.available_sizes) : [],
        suitablePlacements: row.suitable_placements ? JSON.parse(row.suitable_placements) : [],
        localImagePath: row.local_image_path,
        primaryImageUrl: row.primary_image_url,
        isPopular: row.is_popular === 1,
        userAdded: row.user_added === 1
      }));
    } catch (error) {
      console.error('Failed to get popular plants:', error);
      throw error;
    }
  }

  async getPlantsByCategory(category: string, limit: number = 50): Promise<any[]> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = await this.db.getAllAsync(
        `SELECT p.*,
          pi.local_path as local_image_path,
          pi.image_url as primary_image_url
         FROM plants p
         LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
         WHERE p.category = ?
         ORDER BY p.is_popular DESC, p.name ASC
         LIMIT ?`,
        [category, limit]
      );

      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        scientificName: row.scientific_name,
        description: row.description,
        category: row.category,
        icon: row.icon,
        careLevel: row.care_level,
        lightRequirement: row.light_requirement,
        waterRequirement: row.water_requirement,
        petSafe: row.pet_safe === 1,
        availableSizes: row.available_sizes ? JSON.parse(row.available_sizes) : [],
        suitablePlacements: row.suitable_placements ? JSON.parse(row.suitable_placements) : [],
        localImagePath: row.local_image_path,
        primaryImageUrl: row.primary_image_url,
        isPopular: row.is_popular === 1,
        userAdded: row.user_added === 1
      }));
    } catch (error) {
      console.error('Failed to get plants by category:', error);
      throw error;
    }
  }

  async searchPlants(query: string, options: {
    category?: string;
    careLevel?: string;
    lightRequirement?: string;
    lightRequirements?: string[];
    waterRequirement?: string;
    petSafe?: boolean;
    placement?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    const {
      category,
      careLevel,
      lightRequirement,
      lightRequirements,
      waterRequirement,
      petSafe,
      placement,
      limit = 20,
      offset = 0,
    } = options;
    const normalizedQuery = (query || '').trim();

    try {
      const normalizeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
      const baseFilterClause: string[] = [];
      const baseFilterParams: any[] = [];

      if (category) {
        baseFilterClause.push('p.category = ?');
        baseFilterParams.push(category);
      }
      if (careLevel) {
        baseFilterClause.push('p.care_level = ?');
        baseFilterParams.push(careLevel);
      }
      if (lightRequirements && lightRequirements.length > 0) {
        baseFilterClause.push(`p.light_requirement IN (${lightRequirements.map(() => '?').join(', ')})`);
        baseFilterParams.push(...lightRequirements);
      } else if (lightRequirement) {
        baseFilterClause.push('p.light_requirement = ?');
        baseFilterParams.push(lightRequirement);
      }
      if (waterRequirement) {
        baseFilterClause.push('p.water_requirement = ?');
        baseFilterParams.push(waterRequirement);
      }
      if (petSafe !== undefined) {
        baseFilterClause.push('p.pet_safe = ?');
        baseFilterParams.push(petSafe ? 1 : 0);
      }
      if (placement) {
        baseFilterClause.push('p.suitable_placements LIKE ?');
        baseFilterParams.push(`%"${placement}"%`);
      }

      const toPlantProfileRows = (rows: any[]) => rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        scientificName: row.scientific_name,
        description: row.description,
        category: row.category,
        icon: row.icon,
        careLevel: row.care_level,
        lightRequirement: row.light_requirement,
        waterRequirement: row.water_requirement,
        petSafe: row.pet_safe === 1,
        availableSizes: row.available_sizes ? JSON.parse(row.available_sizes) : [],
        suitablePlacements: row.suitable_placements ? JSON.parse(row.suitable_placements) : [],
        localImagePath: row.local_image_path,
        primaryImageUrl: row.primary_image_url,
        searchRank: row.search_rank,
        isPopular: row.is_popular === 1,
        userAdded: row.user_added === 1
      }));

      const runQuery = async (sql: string, params: any[]) => {
        const rows = await this.db!.getAllAsync(sql, params);
        return toPlantProfileRows(rows);
      };

      const appendFiltersAndPagination = (sql: string, params: any[], orderBySearchRank: boolean = false) => {
        let nextSql = sql;
        const nextParams = [...params];

        if (baseFilterClause.length > 0) {
          nextSql += ` AND ${baseFilterClause.join(' AND ')}`;
        }

        const orderBy = orderBySearchRank && normalizedQuery ? 'search_rank ASC' : 'p.name ASC';
        nextSql += ` ORDER BY ${orderBy}`;
        nextSql += ' LIMIT ? OFFSET ?';
        nextParams.push(limit, offset);

        return { nextSql, nextParams };
      };

      // Try FTS first for exact-ish matching, then fall back to LIKE.
      if (normalizedQuery) {
        const useFts = await this.checkFts5Available();
        if (useFts) {
          const sanitizedTokens = normalizedQuery
            .toLowerCase()
            .split(/\s+/)
            .map((token) => token.replace(/[^a-z0-9]/g, ''))
            .filter((token) => token.length > 0)
            .slice(0, 8);
          const ftsQuery = sanitizedTokens.map((token) => `${token}*`).join(' ');

          if (ftsQuery.length > 0) {
            const ftsBaseSql = `
              SELECT p.*, 
                pi.local_path as local_image_path,
                pi.image_url as primary_image_url,
                rank as search_rank
              FROM plants p
              JOIN plants_fts fts ON p.rowid = fts.rowid
              LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
              WHERE plants_fts MATCH ?
            `;
            const ftsParams = [ftsQuery, ...baseFilterParams];
            const { nextSql, nextParams } = appendFiltersAndPagination(ftsBaseSql, ftsParams, true);

            try {
              const ftsRows = await runQuery(nextSql, nextParams);
              if (ftsRows.length > 0) {
                return ftsRows;
              }
            } catch (ftsError) {
              if (__DEV__) {
                console.warn('FTS5 search failed, falling back to LIKE:', ftsError);
              }
            }
          }
        }
      }

      const likeQuery = `%${normalizeLike(normalizedQuery)}%`;
      const likeBaseSql = `
        SELECT p.*, 
          pi.local_path as local_image_path,
          pi.image_url as primary_image_url
        FROM plants p
        LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
        WHERE (p.name LIKE ? ESCAPE '\\' OR p.scientific_name LIKE ? ESCAPE '\\')
      `;
      const likeParams = [likeQuery, likeQuery, ...baseFilterParams];
      const { nextSql, nextParams } = appendFiltersAndPagination(likeBaseSql, likeParams, false);

      return runQuery(nextSql, nextParams);
    } catch (error) {
      console.error('Failed to search plants:', error);
      throw error;
    }
  }

  private async checkFts5Available(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.getFirstAsync(`SELECT 1 FROM plants_fts LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async savePlantImage(plantId: string, image: {
    imageUrl: string;
    localPath?: string;
    isPrimary?: boolean;
    source?: string;
    attribution?: string;
  }): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `INSERT INTO plant_images (plant_id, image_url, local_path, is_primary, source, attribution, downloaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          plantId,
          image.imageUrl,
          image.localPath || null,
          image.isPrimary ? 1 : 0,
          image.source || 'unknown',
          image.attribution || null,
          Date.now()
        ]
      );
    } catch (error) {
      console.error('Failed to save plant image:', error);
      throw error;
    }
  }

  async getPlantById(id: string): Promise<any | null> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const row = await this.db.getFirstAsync<any>(
        `SELECT p.*, 
          pi.local_path as local_image_path,
          pi.image_url as primary_image_url
         FROM plants p
         LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
         WHERE p.id = ?`,
        [id]
      );

      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        scientificName: row.scientific_name,
        description: row.description,
        category: row.category,
        icon: row.icon,
        careLevel: row.care_level,
        lightRequirement: row.light_requirement,
        waterRequirement: row.water_requirement,
        petSafe: row.pet_safe === 1,
        availableSizes: row.available_sizes ? JSON.parse(row.available_sizes) : [],
        suitablePlacements: row.suitable_placements ? JSON.parse(row.suitable_placements) : [],
        localImagePath: row.local_image_path,
        primaryImageUrl: row.primary_image_url,
        isPopular: row.is_popular === 1,
        userAdded: row.user_added === 1
      };
    } catch (error) {
      console.error('Failed to get plant by ID:', error);
      throw error;
    }
  }

  async getPlantsCount(): Promise<number> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM plants`
      );
      return result?.count || 0;
    } catch (error) {
      console.error('Failed to get plants count:', error);
      return 0;
    }
  }

  async clearSearchCache(): Promise<void> {
    await this.ensureConnection();
    if (!this.db) return;

    try {
      await this.db.runAsync(`DELETE FROM plant_search_cache WHERE expires_at < ?`, [Date.now()]);
    } catch (error) {
      console.error('Failed to clear search cache:', error);
    }
  }

  async saveSearchCache(query: string, results: any[]): Promise<void> {
    await this.ensureConnection();
    if (!this.db) return;

    try {
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      await this.db.runAsync(
        `INSERT OR REPLACE INTO plant_search_cache (query, results_json, result_count, searched_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [query.toLowerCase(), JSON.stringify(results), results.length, Date.now(), expiresAt]
      );
    } catch (error) {
      console.error('Failed to save search cache:', error);
    }
  }

  async getCachedSearch(query: string): Promise<any[] | null> {
    await this.ensureConnection();
    if (!this.db) return null;

    try {
      const row = await this.db.getFirstAsync<{ results_json: string }>(
        `SELECT results_json FROM plant_search_cache 
         WHERE query = ? AND expires_at > ?`,
        [query.toLowerCase(), Date.now()]
      );

      return row ? JSON.parse(row.results_json) : null;
    } catch (error) {
      console.error('Failed to get cached search:', error);
      return null;
    }
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
    individualPlantId?: string;
    generatedPlants?: IdentifiedDesignPlant[];
    customPrompt?: string;
  }): Promise<SavedDesign> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const toDbValue = <T>(value: T | undefined | null): T | null => {
        return value === undefined ? null : value;
      };

      // Save image to local storage if it's a data URI
      let localImagePath: string | null = null;
      if (design.generatedImageUri?.startsWith('data:')) {
        localImagePath = await this.saveImageToLocal(design.generatedImageUri);
      }

      const isSinglePlantMode = design.mode === 'individual' || design.mode === 'replace-plant';
      // For backwards compatibility with NOT NULL constraints on legacy databases,
      // provide default values for plant_type_name and plant_style_name when in single-plant modes.
      const plantTypeName = design.plantTypeName || (isSinglePlantMode ? (design.mode === 'replace-plant' ? 'Replace Plant' : 'Individual Plant') : '');
      const plantTypeDescription = design.plantTypeDescription || (isSinglePlantMode ? design.individualPlantName || '' : '');
      const plantStyleName = design.plantStyleName || (isSinglePlantMode ? design.individualPlantSize || '' : '');
      const plantStyleDescription = design.plantStyleDescription || (isSinglePlantMode ? design.individualPlantPlacement || '' : '');

      const result = await this.db.runAsync(
        `INSERT INTO saved_designs (
          original_image_uri, generated_image_uri, local_image_path,
          user_id, mode,
          plant_type_name, plant_type_description,
          plant_style_name, plant_style_description,
          individual_plant_name, individual_plant_scientific_name,
          individual_plant_size, individual_plant_placement,
          individual_plant_id,
          generated_plants_json,
          custom_prompt, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          design.originalImageUri,
          design.generatedImageUri,
          localImagePath,
          toDbValue(design.userId),
          design.mode,
          plantTypeName ?? '',
          plantTypeDescription ?? '',
          plantStyleName ?? '',
          plantStyleDescription ?? '',
          toDbValue(design.individualPlantName),
          toDbValue(design.individualPlantScientificName),
          toDbValue(design.individualPlantSize),
          toDbValue(design.individualPlantPlacement),
          toDbValue(design.individualPlantId),
          design.generatedPlants ? JSON.stringify(design.generatedPlants) : null,
          design.customPrompt ?? '',
          Date.now(),
        ]
      );

      const insertedId = await this.resolveInsertRowId(result);

      const savedDesign: SavedDesign = {
        id: insertedId.toString(),
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
        generatedPlants: design.generatedPlants,
        individualPlant: isSinglePlantMode && design.individualPlantName ? {
          id: toDbValue(design.individualPlantId) as string | undefined,
          name: design.individualPlantName,
          scientificName: design.individualPlantScientificName || '',
          size: design.individualPlantSize!,
          placement: design.individualPlantPlacement!,
        } : undefined,
        customPrompt: design.customPrompt,
        createdAt: new Date(Date.now()),
        isFavorite: false,
      };

      console.log('Design saved to database with ID:', insertedId);
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

      return result.map((row) => this.mapRowToSavedDesign(row));
    } catch (error) {
      console.error('Failed to get designs:', error);
      throw error;
    }
  }

  async getRecentSourceImageUris(userId?: string, limit: number = 24): Promise<string[]> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const params: (string | number)[] = [];
      let sql = `
        SELECT original_image_uri
        FROM saved_designs
        WHERE original_image_uri IS NOT NULL
      `;

      if (userId) {
        sql += ` AND user_id = ?`;
        params.push(userId);
      }

      sql += `
        GROUP BY original_image_uri
        ORDER BY MAX(created_at) DESC
        LIMIT ?
      `;
      params.push(limit);

      const rows = await this.db.getAllAsync<{ original_image_uri: string }>(sql, params);
      return rows
        .map((row) => row.original_image_uri)
        .filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);
    } catch (error) {
      console.error('Failed to get recent source images:', error);
      return [];
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

  async updateGeneratedPlants(
    designId: string,
    generatedPlants: IdentifiedDesignPlant[]
  ): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE saved_designs SET generated_plants_json = ? WHERE id = ?',
        [JSON.stringify(generatedPlants), designId]
      );
    } catch (error) {
      console.error('Failed to update generated plants:', error);
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
    const rowId = row?.id ?? 0;
    const resolvedId = typeof rowId === 'number' || typeof rowId === 'string'
      ? String(rowId)
      : '0';
    const generatedPlants = this.parseGeneratedPlants(row.generated_plants_json);

    return {
      id: resolvedId,
      originalImageUri: row.original_image_uri,
      generatedImageUri: row.generated_image_uri,
      localImagePath: row.local_image_path,
      mode,
      collectionId: row.collection_id !== undefined && row.collection_id !== null ? row.collection_id.toString() : null,
      plantType: row.plant_type_name ? {
        name: row.plant_type_name,
        description: row.plant_type_description || '',
      } : undefined,
      plantStyle: row.plant_style_name ? {
        name: row.plant_style_name,
        description: row.plant_style_description || '',
      } : undefined,
      generatedPlants,
      individualPlant: row.individual_plant_name ? {
        id: row.individual_plant_id || undefined,
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

  private parseGeneratedPlants(value?: string | null): IdentifiedDesignPlant[] | undefined {
    if (!value) return undefined;

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as IdentifiedDesignPlant[] : undefined;
    } catch {
      return undefined;
    }
  }

  // ============================================
  // Collections Methods
  // ============================================

  async getCollections(userId?: string): Promise<Collection[]> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = userId
        ? await this.db.getAllAsync(`
            SELECT * FROM collections
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY name COLLATE NOCASE ASC
          `, [userId])
        : await this.db.getAllAsync(`
            SELECT * FROM collections
            ORDER BY name COLLATE NOCASE ASC
          `);

      return rows.map((r: any) => ({
        id: r.id.toString(),
        name: r.name,
        createdAt: new Date(r.created_at),
      }));
    } catch (error) {
      console.error('Failed to get collections:', error);
      return [];
    }
  }

  async createCollection(name: string, userId?: string): Promise<Collection> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Collection name is required');
    }

    const now = Date.now();
    try {
      const result = await this.db.runAsync(
        `INSERT INTO collections (user_id, name, created_at) VALUES (?, ?, ?)`
        , [userId ?? null, trimmed, now]
      );

      const insertedId = await this.resolveInsertRowId(result);
      return {
        id: insertedId.toString(),
        name: trimmed,
        createdAt: new Date(now),
      };
    } catch (error) {
      console.error('Failed to create collection:', error);
      throw error;
    }
  }

  async setDesignCollection(designId: string, collectionId: string | null): Promise<void> {
    await this.ensureConnection();
    if (!this.db) throw new Error('Database not initialized');

    const value = collectionId ? Number(collectionId) : null;
    try {
      await this.db.runAsync(
        'UPDATE saved_designs SET collection_id = ? WHERE id = ?'
        , [value, Number(designId)]
      );
    } catch (error) {
      console.error('Failed to set design collection:', error);
      throw error;
    }
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
