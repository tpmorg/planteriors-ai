import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { SavedDesign, PlantSelectionMode, PlantSize, PlacementType } from '../types';

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('plantai.db');
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createDesignsTable = `
      CREATE TABLE IF NOT EXISTS saved_designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_image_uri TEXT NOT NULL,
        generated_image_uri TEXT NOT NULL,
        local_image_path TEXT,
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

    // Migration: Add new columns to existing tables if they don't exist
    await this.migrateDatabase();
  }

  private async migrateDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      // Check if mode column exists by trying to select it
      await this.db.execAsync(`
        ALTER TABLE saved_designs ADD COLUMN mode TEXT DEFAULT 'multi-plant';
      `);
    } catch {
      // Column already exists, ignore error
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

  async saveDesign(design: {
    originalImageUri: string;
    generatedImageUri: string;
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
          mode,
          plant_type_name, plant_type_description,
          plant_style_name, plant_style_description,
          individual_plant_name, individual_plant_scientific_name,
          individual_plant_size, individual_plant_placement,
          custom_prompt, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          design.originalImageUri,
          design.generatedImageUri,
          localImagePath,
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
}

export const databaseService = new DatabaseService();