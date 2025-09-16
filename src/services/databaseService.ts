import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { SavedDesign } from '../types';

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
        plant_type_name TEXT NOT NULL,
        plant_type_description TEXT NOT NULL,
        plant_style_name TEXT NOT NULL,
        plant_style_description TEXT NOT NULL,
        custom_prompt TEXT,
        created_at INTEGER NOT NULL,
        is_favorite INTEGER DEFAULT 0
      );
    `;

    await this.db.execAsync(createDesignsTable);
  }

  async saveDesign(design: {
    originalImageUri: string;
    generatedImageUri: string;
    plantTypeName: string;
    plantTypeDescription: string;
    plantStyleName: string;
    plantStyleDescription: string;
    customPrompt?: string;
  }): Promise<SavedDesign> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Save image to local storage if it's a data URI
      let localImagePath: string | null = null;
      if (design.generatedImageUri.startsWith('data:')) {
        localImagePath = await this.saveImageToLocal(design.generatedImageUri);
      }

      const result = await this.db.runAsync(
        `INSERT INTO saved_designs (
          original_image_uri, generated_image_uri, local_image_path,
          plant_type_name, plant_type_description,
          plant_style_name, plant_style_description,
          custom_prompt, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          design.originalImageUri,
          design.generatedImageUri,
          localImagePath,
          design.plantTypeName,
          design.plantTypeDescription,
          design.plantStyleName,
          design.plantStyleDescription,
          design.customPrompt || '',
          Date.now()
        ]
      );

      const savedDesign: SavedDesign = {
        id: result.lastInsertRowId.toString(),
        originalImageUri: design.originalImageUri,
        generatedImageUri: design.generatedImageUri,
        localImagePath,
        plantType: {
          name: design.plantTypeName,
          description: design.plantTypeDescription,
        },
        plantStyle: {
          name: design.plantStyleName,
          description: design.plantStyleDescription,
        },
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
    return {
      id: row.id.toString(),
      originalImageUri: row.original_image_uri,
      generatedImageUri: row.generated_image_uri,
      localImagePath: row.local_image_path,
      plantType: {
        name: row.plant_type_name,
        description: row.plant_type_description,
      },
      plantStyle: {
        name: row.plant_style_name,
        description: row.plant_style_description,
      },
      customPrompt: row.custom_prompt || undefined,
      createdAt: new Date(row.created_at),
      isFavorite: Boolean(row.is_favorite),
    };
  }
}

export const databaseService = new DatabaseService();