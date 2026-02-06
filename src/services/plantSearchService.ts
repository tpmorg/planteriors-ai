import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { PlantSearchResult, PlantSearchOptions } from '../types';

// Trefle API Configuration
const TREFLE_API_KEY = ''; // Will be loaded from environment
const RATE_LIMIT_MS = 1000; // 1 second between API calls
const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let lastApiCall = 0;

export class PlantSearchService {
  private db: SQLite.SQLiteDatabase;
  private ftsAvailable: boolean | null = null;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Initialize the service and check FTS5 availability
   */
  async initialize(): Promise<void> {
    this.ftsAvailable = await this.checkFts5Available();
    console.log('PlantSearchService initialized, FTS5 available:', this.ftsAvailable);
  }

  /**
   * Smart search with local FTS5 and API fallback
   */
  async search(options: PlantSearchOptions): Promise<PlantSearchResult[]> {
    const { query, limit = 20, offset = 0, source = 'all' } = options;

    let results: PlantSearchResult[] = [];

    // 1. Search local database first
    if (source === 'local' || source === 'all') {
      results = await this.searchLocal(options);
    }

    // 2. If not enough results and API search is requested
    if (source !== 'local' && query && results.length < limit) {
      const remainingLimit = limit - results.length;
      const existingIds = new Set(results.map(r => r.id));
      
      // Check cache first
      const cachedResults = await this.getCachedSearch(query);
      
      if (cachedResults) {
        // Merge with local results, avoiding duplicates
        const newResults = cachedResults
          .filter(r => !existingIds.has(r.id))
          .slice(0, remainingLimit);
        results = [...results, ...newResults];
      } else if (source === 'api' || source === 'all') {
        // Only hit API if we really need to (and respect rate limits)
        const apiResults = await this.searchTrefleApi(query, remainingLimit);
        
        if (apiResults.length > 0) {
          await this.cacheSearchResults(query, apiResults);
          
          const newResults = apiResults.filter(r => !existingIds.has(r.id));
          results = [...results, ...newResults];
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Get popular plants (cached locally)
   */
  async getPopularPlants(limit: number = 50): Promise<PlantSearchResult[]> {
    const rows = await this.db.getAllAsync<PlantRow>(
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

    return rows.map(row => this.rowToPlant(row));
  }

  /**
   * Get plants by category
   */
  async getPlantsByCategory(category: string, limit: number = 50): Promise<PlantSearchResult[]> {
    const rows = await this.db.getAllAsync<PlantRow>(
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

    return rows.map(row => this.rowToPlant(row));
  }

  /**
   * Get plant by ID
   */
  async getPlantById(id: string): Promise<PlantSearchResult | null> {
    const row = await this.db.getFirstAsync<PlantRow>(
      `SELECT p.*, 
        pi.local_path as local_image_path,
        pi.image_url as primary_image_url
       FROM plants p
       LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
       WHERE p.id = ?`,
      [id]
    );

    return row ? this.rowToPlant(row) : null;
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<{ id: string; name: string; count: number }[]> {
    const rows = await this.db.getAllAsync<{ category: string; count: number }>(
      `SELECT category, COUNT(*) as count 
       FROM plants 
       WHERE category IS NOT NULL 
       GROUP BY category 
       ORDER BY count DESC`
    );

    return rows.map(row => ({
      id: row.category,
      name: this.formatCategoryName(row.category),
      count: row.count
    }));
  }

  /**
   * Download and cache an image for offline use
   */
  async cachePlantImage(plantId: string, imageUrl: string): Promise<string | null> {
    try {
      const filename = `plant_${plantId}_${Date.now()}.jpg`;
      const cacheDir = `${FileSystem.cacheDirectory}plant-images/`;
      const localPath = `${cacheDir}${filename}`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      // Download image
      const downloadResult = await FileSystem.downloadAsync(imageUrl, localPath);
      
      if (downloadResult.status === 200) {
        // Save to database
        await this.db.runAsync(
          `INSERT INTO plant_images (plant_id, image_url, local_path, is_primary, source, downloaded_at)
           VALUES (?, ?, ?, 0, 'api', ?)`,
          [plantId, imageUrl, localPath, Date.now()]
        );

        return localPath;
      }

      return null;
    } catch (error) {
      console.error('Failed to cache plant image:', error);
      return null;
    }
  }

  /**
   * Clear old search cache
   */
  async clearExpiredCache(): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM plant_search_cache WHERE expires_at < ?`,
      [Date.now()]
    );
  }

  /**
   * Get total plant count
   */
  async getPlantCount(): Promise<number> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM plants`
    );
    return result?.count || 0;
  }

  // ==================== Private Methods ====================

  private async searchLocal(options: PlantSearchOptions): Promise<PlantSearchResult[]> {
    const { query, category, careLevel, lightRequirement, petSafe, limit = 20, offset = 0 } = options;

    let sql: string;
    const params: any[] = [];

    if (this.ftsAvailable && query && query.trim()) {
      // Use FTS5 for fast full-text search
      sql = `
        SELECT p.*, 
          pi.local_path as local_image_path,
          pi.image_url as primary_image_url,
          rank as search_rank
        FROM plants p
        JOIN plants_fts fts ON p.rowid = fts.rowid
        LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
        WHERE plants_fts MATCH ?
      `;
      // Create prefix search query (e.g., "monst delici" becomes "monst* OR delici*")
      const ftsQuery = query.split(' ').map(t => `${t}*`).join(' OR ');
      params.push(ftsQuery);
    } else {
      // Fallback to LIKE search
      sql = `
        SELECT p.*, 
          pi.local_path as local_image_path,
          pi.image_url as primary_image_url
        FROM plants p
        LEFT JOIN plant_images pi ON p.id = pi.plant_id AND pi.is_primary = 1
        WHERE (p.name LIKE ? OR p.scientific_name LIKE ?)
      `;
      const likeQuery = `%${query || ''}%`;
      params.push(likeQuery, likeQuery);
    }

    // Add filters
    if (category) {
      sql += ` AND p.category = ?`;
      params.push(category);
    }
    if (careLevel) {
      sql += ` AND p.care_level = ?`;
      params.push(careLevel);
    }
    if (lightRequirement) {
      sql += ` AND p.light_requirement = ?`;
      params.push(lightRequirement);
    }
    if (petSafe !== undefined) {
      sql += ` AND p.pet_safe = ?`;
      params.push(petSafe ? 1 : 0);
    }

    // Order by relevance or name
    if (this.ftsAvailable && query) {
      sql += ` ORDER BY rank ASC`;
    } else {
      sql += ` ORDER BY p.is_popular DESC, p.name ASC`;
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await this.db.getAllAsync<PlantRow>(sql, params);
    return rows.map(row => this.rowToPlant(row));
  }

  private async searchTrefleApi(query: string, limit: number): Promise<PlantSearchResult[]> {
    // Rate limiting - only call API if enough time has passed
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    
    if (timeSinceLastCall < RATE_LIMIT_MS) {
      console.log('Rate limit: skipping Trefle API call');
      return [];
    }

    lastApiCall = Date.now();

    try {
      const url = `https://trefle.io/api/v1/plants/search?token=${TREFLE_API_KEY}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('Trefle API error:', response.status);
        return [];
      }

      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }

      return data.data.slice(0, limit).map((plant: any) => ({
        id: `trefle_${plant.id}`,
        name: plant.common_name || plant.scientific_name,
        scientificName: plant.scientific_name,
        description: '',
        category: this.inferCategory(plant),
        icon: 'Leaf',
        careLevel: 'unknown',
        lightRequirement: 'unknown',
        petSafe: false,
        availableSizes: ['small', 'medium', 'large'],
        suitablePlacements: ['floor', 'shelf', 'hanging'],
        primaryImageUrl: plant.image_url,
        localImagePath: undefined,
        isPopular: false,
      }));

    } catch (error) {
      console.error('Trefle API error:', error);
      return [];
    }
  }

  private async getCachedSearch(query: string): Promise<PlantSearchResult[] | null> {
    const row = await this.db.getFirstAsync<{ results_json: string }>(
      `SELECT results_json FROM plant_search_cache 
       WHERE query = ? AND expires_at > ?`,
      [query.toLowerCase(), Date.now()]
    );

    return row ? JSON.parse(row.results_json) : null;
  }

  private async cacheSearchResults(query: string, results: PlantSearchResult[]): Promise<void> {
    const expiresAt = Date.now() + SEARCH_CACHE_TTL_MS;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO plant_search_cache (query, results_json, result_count, searched_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [query.toLowerCase(), JSON.stringify(results), results.length, Date.now(), expiresAt]
    );
  }

  private async checkFts5Available(): Promise<boolean> {
    try {
      await this.db.getFirstAsync(`SELECT 1 FROM plants_fts LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  private rowToPlant(row: PlantRow): PlantSearchResult {
    return {
      id: row.id,
      name: row.name,
      scientificName: row.scientific_name,
      description: row.description || undefined,
      category: row.category || 'unknown',
      icon: row.icon || 'Leaf',
      careLevel: row.care_level || 'easy',
      lightRequirement: row.light_requirement || 'bright-indirect',
      waterRequirement: row.water_requirement || undefined,
      petSafe: row.pet_safe === 1,
      availableSizes: row.available_sizes ? JSON.parse(row.available_sizes) : [],
      suitablePlacements: row.suitable_placements ? JSON.parse(row.suitable_placements) : [],
      primaryImageUrl: row.primary_image_url || undefined,
      localImagePath: row.local_image_path || undefined,
      searchRank: row.search_rank,
      isPopular: row.is_popular === 1,
    };
  }

  private inferCategory(plant: any): string {
    const family = (plant.family || '').toLowerCase();
    const commonName = (plant.common_name || '').toLowerCase();
    
    if (family.includes('cact')) return 'cactus';
    if (family.includes('succulent') || commonName.includes('succulent')) return 'succulent';
    if (family.includes('palm') || commonName.includes('palm')) return 'palm';
    if (family.includes('fern') || commonName.includes('fern')) return 'fern';
    if (commonName.includes('flower') || commonName.includes('bloom')) return 'flowering';
    if (commonName.includes('vine') || commonName.includes('ivy') || commonName.includes('philodendron')) return 'vine';
    
    return 'tropical';
  }

  private formatCategoryName(category: string): string {
    const names: Record<string, string> = {
      'tropical': 'Tropical',
      'succulent': 'Succulents',
      'cactus': 'Cacti',
      'palm': 'Palms',
      'fern': 'Ferns',
      'flowering': 'Flowering',
      'vine': 'Vines',
      'herb': 'Herbs',
      'tree': 'Trees',
    };
    return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }
}

// Type for database rows
interface PlantRow {
  id: string;
  name: string;
  scientific_name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  care_level: string | null;
  light_requirement: string | null;
  water_requirement: string | null;
  pet_safe: number;
  available_sizes: string | null;
  suitable_placements: string | null;
  primary_image_url: string | null;
  local_image_path: string | null;
  search_rank?: number;
  is_popular: number;
}

// Singleton instance
let plantSearchService: PlantSearchService | null = null;

export function getPlantSearchService(db: SQLite.SQLiteDatabase): PlantSearchService {
  if (!plantSearchService) {
    plantSearchService = new PlantSearchService(db);
  }
  return plantSearchService;
}
