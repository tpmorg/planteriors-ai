#!/usr/bin/env node

/**
 * Populates SQLite database with 200 popular houseplants from Trefle API
 * Creates a pre-populated database file for bundling with the app
 * 
 * Usage:
 *   node scripts/populatePlantCodex.js
 * 
 * Environment:
 *   TRUFLE_API_KEY - Your Trefle API key
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const CONFIG = {
  TARGET_COUNT: 200,
  ASSETS_DIR: path.join(__dirname, '../assets'),
  DB_FILE: path.join(__dirname, '../assets/plantai-seed.db'),
  IMAGES_DIR: path.join(__dirname, '../assets/plant-images'),
  RATE_LIMIT_MS: 1000, // 1 second between requests
  TREFLE_BASE_URL: 'https://trefle.io/api/v1',
};

// 200 Most popular houseplants to search for
const POPULAR_PLANTS = [
  // === TROPICAL FAVORITES (60) ===
  'Monstera deliciosa',
  'Ficus lyrata',
  'Strelitzia reginae',
  'Ficus elastica',
  'Calathea roseopicta',
  'Aglaonema',
  'Dracaena marginata',
  'Codiaeum variegatum',
  'Dieffenbachia',
  'Alocasia amazonica',
  'Anthurium andraeanum',
  'Begonia rex',
  'Caladium',
  'Cordyline fruticosa',
  'Ctenanthe burle-marxii',
  'Dracaena fragrans',
  'Epipremnum aureum',
  'Goeppertia makoyana',
  'Goeppertia orbifolia',
  'Maranta leuconeura',
  'Philodendron hederaceum',
  'Philodendron gloriosum',
  'Philodendron birkin',
  'Pilea peperomioides',
  'Schefflera arboricola',
  'Spathiphyllum',
  'Stromanthe sanguinea',
  'Syngonium podophyllum',
  'Tradescantia zebrina',
  'Zamioculcas zamiifolia',
  'Chamaedorea elegans',
  'Dracaena reflexa',
  'Ficus benjamina',
  'Hibiscus rosa-sinensis',
  'Nerium oleander',
  'Pachira aquatica',
  'Polyscias fruticosa',
  'Yucca elephantipes',
  'Aloe vera',
  'Chlorophytum comosum',
  'Haworthia fasciata',
  'Haworthia cooperi',
  'Gasteria',
  'Aloe brevifolia',
  'Pachyphytum',
  'Echeveria elegans',
  'Echeveria agavoides',
  'Echeveria pulvinata',
  'Graptopetalum paraguayense',
  'Pachyveria',
  'Sedum morganianum',
  'Sedum rubrotinctum',
  'Senecio rowleyanus',
  'Senecio radicans',
  'Crassula ovata',
  'Crassula perforata',
  'Crassula muscosa',
  'Kalanchoe blossfeldiana',
  'Kalanchoe tomentosa',
  'Kalanchoe luciae',
  
  // === CACTI & SUCCULENTS (50) ===
  'Opuntia microdasys',
  'Opuntia basilaris',
  'Echinocactus grusonii',
  'Echinocereus pentalophus',
  'Ferocactus latispinus',
  'Mammillaria hahniana',
  'Mammillaria elongata',
  'Parodia leninghausii',
  'Gymnocalycium mihanovichii',
  'Astrophytum myriostigma',
  'Schlumbergera truncata',
  'Rhipsalidopsis gaertneri',
  'Hatiora salicornioides',
  'Lepismium cruciforme',
  'Pseudorhipsalis ramulosa',
  'Epiphyllum oxypetalum',
  'Hylocereus undatus',
  'Selenicereus anthonyanus',
  'Aporocactus flagelliformis',
  'Disocactus ackermannii',
  'Gymnocalycium stenopleurum',
  'Rebutia steinbachii',
  'Lobivia arachnacantha',
  'Echinopsis chamaecereus',
  'Echinopsis eyriesii',
  'Cleistocactus winteri',
  'Pilosocereus pachycladus',
  'Cephalocereus senilis',
  'Espostoa lanata',
  'Oreocereus celsianus',
  'Aloe aristata',
  'Aloe juvenna',
  'Aloe variegata',
  'Gasteria bicolor',
  'Gasteria pulchra',
  'Haworthia attenuata',
  'Haworthia limifolia',
  'Haworthia retusa',
  'Haworthia truncata',
  'Gasteraloe',
  'Adromischus',
  'Cotyledon tomentosa',
  'Cotyledon orbiculata',
  'Tylecodon paniculatus',
  'Othonna capensis',
  'Portulacaria afra',
  'Peperomia obtusifolia',
  'Peperomia caperata',
  'Peperomia argyreia',
  
  // === PALMS (15) ===
  'Dypsis lutescens',
  'Howea forsteriana',
  'Chamaedorea cataractarum',
  'Chamaedorea seifrizii',
  'Rhapis excelsa',
  'Caryota mitis',
  'Licuala grandis',
  'Livistona rotundifolia',
  'Phoenix roebelenii',
  'Trachycarpus fortunei',
  'Washingtonia robusta',
  'Sabal minor',
  'Cocos nucifera',
  'Adonidia merrillii',
  'Hyophorbe lagenicaulis',
  
  // === FERNS (20) ===
  'Nephrolepis exaltata',
  'Nephrolepis obliterata',
  'Asplenium nidus',
  'Asplenium antiquum',
  'Adiantum raddianum',
  'Adiantum capillus-veneris',
  'Pteris cretica',
  'Pteris ensiformis',
  'Polystichum polyblepharum',
  'Cyrtomium falcatum',
  'Blechnum gibbum',
  'Blechnum brasiliense',
  'Microsorum diversifolium',
  'Microsorum punctatum',
  'Platycerium bifurcatum',
  'Platycerium superbum',
  'Davallia fejeensis',
  'Pellaea rotundifolia',
  'Hemionitis arifolia',
  'Phlebodium aureum',
  
  // === VINES & CLIMBERS (25) ===
  'Epipremnum pinnatum',
  'Epipremnum aureum',
  'Monstera adansonii',
  'Monstera siltepecana',
  'Monstera Peru',
  'Rhaphidophora tetrasperma',
  'Scindapsus pictus',
  'Scindapsus treubii',
  'Pothos Marble Queen',
  'Pothos Neon',
  'Pothos Baltic Blue',
  'Philodendron micans',
  'Philodendron brasil',
  'Philodendron melanochrysum',
  'Philodendron verrucosum',
  'Philodendron subhastatum',
  'Philodendron camposportoanum',
  'Syngonium podophyllum',
  'Syngonium albo',
  'Syngonium pink splash',
  'Hoya carnosa',
  'Hoya kerrii',
  'Hoya obovata',
  'Hoya linearis',
  'Ceropegia woodii',
  
  // === FLOWERING (20) ===
  'Saintpaulia ionantha',
  'Saintpaulia',
  'Streptocarpus',
  'Chirita tamiana',
  'Aeschynanthus radicans',
  'Columnea gloriosa',
  'Episcia cupreata',
  'Kohleria eriantha',
  'Sinningia speciosa',
  'Achimenes grandiflora',
  'Chirita tamiana',
  'Primulina tabacum',
  'Chirita eburnea',
  'Petrocosmea rosettifolia',
  'Didymocarpus',
  'Rhynchotechum',
  'Lysionotus pauciflorus',
  'Jerdonia indica',
  'Titanotrichum oldhamii',
  'Briggsia longipes',
  
  // === HERBS & EDIBLE (10) ===
  'Ocimum basilicum',
  'Mentha spicata',
  'Rosmarinus officinalis',
  'Thymus vulgaris',
  'Origanum vulgare',
  'Petroselinum crispum',
  'Allium schoenoprasum',
  'Anthriscus cerefolium',
  'Coriandrum sativum',
  'Foeniculum vulgare',
];

// Custom category mapping based on user-friendly taxonomy
const CATEGORY_MAP = {
  // Tropical
  'Monstera': 'tropical',
  'Ficus': 'tropical',
  'Strelitzia': 'tropical',
  'Calathea': 'tropical',
  'Goeppertia': 'tropical',
  'Aglaonema': 'tropical',
  'Dieffenbachia': 'tropical',
  'Alocasia': 'tropical',
  'Anthurium': 'tropical',
  'Begonia': 'tropical',
  'Caladium': 'tropical',
  'Cordyline': 'tropical',
  'Ctenanthe': 'tropical',
  'Maranta': 'tropical',
  'Stromanthe': 'tropical',
  'Philodendron': 'vine',
  'Schefflera': 'tropical',
  'Spathiphyllum': 'flowering',
  'Syngonium': 'vine',
  'Tradescantia': 'vine',
  'Zamioculcas': 'succulent',
  'Hibiscus': 'flowering',
  'Pachira': 'tree',
  'Polyscias': 'tropical',
  'Yucca': 'succulent',
  
  // Succulents
  'Aloe': 'succulent',
  'Chlorophytum': 'tropical',
  'Haworthia': 'succulent',
  'Gasteria': 'succulent',
  'Pachyphytum': 'succulent',
  'Echeveria': 'succulent',
  'Graptopetalum': 'succulent',
  'Sedum': 'succulent',
  'Senecio': 'succulent',
  'Crassula': 'succulent',
  'Kalanchoe': 'succulent',
  'Peperomia': 'succulent',
  'Adromischus': 'succulent',
  'Cotyledon': 'succulent',
  'Tylecodon': 'succulent',
  'Othonna': 'succulent',
  'Portulacaria': 'succulent',
  
  // Cacti
  'Opuntia': 'cactus',
  'Echinocactus': 'cactus',
  'Echinocereus': 'cactus',
  'Ferocactus': 'cactus',
  'Mammillaria': 'cactus',
  'Parodia': 'cactus',
  'Gymnocalycium': 'cactus',
  'Astrophytum': 'cactus',
  'Schlumbergera': 'cactus',
  'Rhipsalidopsis': 'cactus',
  'Hatiora': 'cactus',
  'Lepismium': 'cactus',
  'Pseudorhipsalis': 'cactus',
  'Epiphyllum': 'cactus',
  'Hylocereus': 'cactus',
  'Selenicereus': 'cactus',
  'Aporocactus': 'cactus',
  'Disocactus': 'cactus',
  'Rebutia': 'cactus',
  'Lobivia': 'cactus',
  'Echinopsis': 'cactus',
  'Cleistocactus': 'cactus',
  'Pilosocereus': 'cactus',
  'Cephalocereus': 'cactus',
  'Espostoa': 'cactus',
  'Oreocereus': 'cactus',
  
  // Palms
  'Dypsis': 'palm',
  'Howea': 'palm',
  'Chamaedorea': 'palm',
  'Rhapis': 'palm',
  'Caryota': 'palm',
  'Licuala': 'palm',
  'Livistona': 'palm',
  'Phoenix': 'palm',
  'Trachycarpus': 'palm',
  'Washingtonia': 'palm',
  'Sabal': 'palm',
  'Cocos': 'palm',
  'Adonidia': 'palm',
  'Hyophorbe': 'palm',
  
  // Ferns
  'Nephrolepis': 'fern',
  'Asplenium': 'fern',
  'Adiantum': 'fern',
  'Pteris': 'fern',
  'Polystichum': 'fern',
  'Cyrtomium': 'fern',
  'Blechnum': 'fern',
  'Microsorum': 'fern',
  'Platycerium': 'fern',
  'Davallia': 'fern',
  'Pellaea': 'fern',
  'Hemionitis': 'fern',
  'Phlebodium': 'fern',
  
  // Vines
  'Epipremnum': 'vine',
  'Rhaphidophora': 'vine',
  'Scindapsus': 'vine',
  'Pothos': 'vine',
  'Ceropegia': 'vine',
  'Hoya': 'vine',
  
  // Flowering
  'Saintpaulia': 'flowering',
  'Streptocarpus': 'flowering',
  'Aeschynanthus': 'flowering',
  'Columnea': 'flowering',
  'Episcia': 'flowering',
  'Kohleria': 'flowering',
  'Sinningia': 'flowering',
  'Achimenes': 'flowering',
  'Primulina': 'flowering',
  'Chirita': 'flowering',
  'Petrocosmea': 'flowering',
  'Didymocarpus': 'flowering',
  'Rhynchotechum': 'flowering',
  'Lysionotus': 'flowering',
  'Jerdonia': 'flowering',
  'Titanotrichum': 'flowering',
  'Briggsia': 'flowering',
  
  // Herbs
  'Ocimum': 'herb',
  'Mentha': 'herb',
  'Rosmarinus': 'herb',
  'Thymus': 'herb',
  'Origanum': 'herb',
  'Petroselinum': 'herb',
  'Allium': 'herb',
  'Anthriscus': 'herb',
  'Coriandrum': 'herb',
  'Foeniculum': 'herb',
};

// Icon mapping
const ICON_MAP = {
  'tropical': '🌿',
  'succulent': '🌵',
  'cactus': '🌵',
  'palm': '🌴',
  'fern': '🌿',
  'vine': '🌿',
  'flowering': '🌸',
  'herb': '🌱',
  'tree': '🌳',
  'unknown': '🌱',
};

// Care level inference based on genus
const CARE_LEVEL_MAP = {
  'Zamioculcas': 'easy',
  'Sansevieria': 'easy',
  'Chlorophytum': 'easy',
  'Epipremnum': 'easy',
  'Pothos': 'easy',
  'Spathiphyllum': 'easy',
  'Aglaonema': 'easy',
  'Dracaena': 'easy',
  'Aloe': 'easy',
  'Haworthia': 'easy',
  'Echeveria': 'easy',
  'Sedum': 'easy',
  'Crassula': 'easy',
  'Opuntia': 'easy',
  'Echinocactus': 'easy',
  'Dypsis': 'easy',
  'Chamaedorea': 'easy',
  'Nephrolepis': 'easy',
  'Tradescantia': 'easy',
  'Philodendron': 'easy',
  
  'Monstera': 'moderate',
  'Ficus': 'moderate',
  'Calathea': 'moderate',
  'Goeppertia': 'moderate',
  'Maranta': 'moderate',
  'Stromanthe': 'moderate',
  'Begonia': 'moderate',
  'Ctenanthe': 'moderate',
  'Strelitzia': 'moderate',
  'Hoya': 'moderate',
  'Syngonium': 'moderate',
  'Scindapsus': 'moderate',
  'Peperomia': 'moderate',
  'Pilea': 'moderate',
  'Howea': 'moderate',
  'Adiantum': 'moderate',
  'Asplenium': 'moderate',
  'Saintpaulia': 'moderate',
  
  'Alocasia': 'difficult',
  'Anthurium': 'difficult',
  'Caladium': 'difficult',
  'Mammillaria': 'difficult',
  'Gymnocalycium': 'difficult',
  'Platycerium': 'difficult',
  'Caryota': 'difficult',
  'Rhapis': 'difficult',
};

// Light requirement mapping
const LIGHT_MAP = {
  'Zamioculcas': 'low-to-bright',
  'Sansevieria': 'low-to-bright',
  'Aglaonema': 'low-to-bright',
  'Dracaena': 'low-to-bright',
  'Spathiphyllum': 'low-to-bright',
  'Haworthia': 'low-to-bright',
  'Gasteria': 'low-to-bright',
  'Pilea': 'low-to-bright',
  'Chamaedorea': 'low-to-bright',
  'Rhapis': 'low-to-bright',
  
  'Monstera': 'bright-indirect',
  'Ficus': 'bright-indirect',
  'Philodendron': 'bright-indirect',
  'Calathea': 'bright-indirect',
  'Goeppertia': 'bright-indirect',
  'Maranta': 'bright-indirect',
  'Stromanthe': 'bright-indirect',
  'Begonia': 'bright-indirect',
  'Ctenanthe': 'bright-indirect',
  'Epipremnum': 'bright-indirect',
  'Pothos': 'bright-indirect',
  'Scindapsus': 'bright-indirect',
  'Syngonium': 'bright-indirect',
  'Tradescantia': 'bright-indirect',
  'Hoya': 'bright-indirect',
  'Peperomia': 'bright-indirect',
  'Howea': 'bright-indirect',
  'Dypsis': 'bright-indirect',
  'Nephrolepis': 'bright-indirect',
  'Asplenium': 'bright-indirect',
  'Saintpaulia': 'bright-indirect',
  
  'Strelitzia': 'bright-direct',
  'Codiaeum': 'bright-direct',
  'Opuntia': 'bright-direct',
  'Echinocactus': 'bright-direct',
  'Ferocactus': 'bright-direct',
  'Aloe': 'bright-direct',
  'Echeveria': 'bright-direct',
  'Sedum': 'bright-direct',
  'Crassula': 'bright-direct',
  'Kalanchoe': 'bright-direct',
  'Cactus': 'bright-direct',
  'Succulent': 'bright-direct',
};

// ==================== Utility Functions ====================

function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local not found');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      env[key] = valueParts.join('=');
    }
  }
  return env;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects'));
      }

      https.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(filepath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(filepath);
        });
        fileStream.on('error', reject);
      }).on('error', reject);
    };

    request(url);
  });
}

// ==================== Database Functions ====================

function initDatabase() {
  // Remove existing database
  if (fs.existsSync(CONFIG.DB_FILE)) {
    fs.unlinkSync(CONFIG.DB_FILE);
    console.log('Removed existing database');
  }

  // Ensure images directory exists
  if (!fs.existsSync(CONFIG.IMAGES_DIR)) {
    fs.mkdirSync(CONFIG.IMAGES_DIR, { recursive: true });
  }

  // Create database
  const db = new sqlite3.Database(CONFIG.DB_FILE);
  
  db.serialize(() => {
    // Plants table
    db.run(`
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
      )
    `);

    // Plant images table
    db.run(`
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
      )
    `);

    // FTS5 virtual table
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS plants_fts USING fts5(
        name,
        scientific_name,
        description,
        content='plants',
        content_rowid='rowid'
      )
    `);

    // FTS5 triggers
    db.run(`
      CREATE TRIGGER IF NOT EXISTS plants_ai AFTER INSERT ON plants BEGIN
        INSERT INTO plants_fts(rowid, name, scientific_name, description)
        VALUES (new.rowid, new.name, new.scientific_name, new.description);
      END
    `);

    db.run(`
      CREATE TRIGGER IF NOT EXISTS plants_ad AFTER DELETE ON plants BEGIN
        INSERT INTO plants_fts(plants_fts, rowid, name, scientific_name, description)
        VALUES ('delete', old.rowid, old.name, old.scientific_name, old.description);
      END
    `);

    db.run(`
      CREATE TRIGGER IF NOT EXISTS plants_au AFTER UPDATE ON plants BEGIN
        INSERT INTO plants_fts(plants_fts, rowid, name, scientific_name, description)
        VALUES ('delete', old.rowid, old.name, old.scientific_name, old.description);
        INSERT INTO plants_fts(rowid, name, scientific_name, description)
        VALUES (new.rowid, new.name, new.scientific_name, new.description);
      END
    `);

    // Search cache table
    db.run(`
      CREATE TABLE IF NOT EXISTS plant_search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        results_json TEXT NOT NULL,
        result_count INTEGER,
        searched_at INTEGER,
        expires_at INTEGER
      )
    `);

    // Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_plants_category ON plants(category)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_plants_care_level ON plants(care_level)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_plants_popular ON plants(is_popular)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_plant_images_plant_id ON plant_images(plant_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_search_cache_query ON plant_search_cache(query)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON plant_search_cache(expires_at)`);
  });

  console.log('Database initialized');
  return db;
}

function insertPlant(db, plant) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO plants (
        id, name, scientific_name, description, category, icon,
        care_level, light_requirement, water_requirement, pet_safe,
        available_sizes, suitable_placements, trefle_id, is_popular,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    stmt.run([
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
      plant.trefleId,
      Date.now(),
      Date.now()
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });

    stmt.finalize();
  });
}

function insertImage(db, image) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO plant_images (
        plant_id, image_url, local_path, is_primary, source, attribution, downloaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      image.plantId,
      image.imageUrl,
      image.localPath,
      image.isPrimary ? 1 : 0,
      image.source,
      image.attribution,
      Date.now()
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });

    stmt.finalize();
  });
}

// ==================== Plant Processing ====================

async function searchTrefle(scientificName, apiKey) {
  const url = `${CONFIG.TREFLE_BASE_URL}/plants/search?token=${apiKey}&q=${encodeURIComponent(scientificName)}`;
  
  try {
    const response = await fetchJson(url);
    
    if (response.data && response.data.length > 0) {
      // Find best match
      const exactMatch = response.data.find(p => 
        p.scientific_name.toLowerCase() === scientificName.toLowerCase()
      );
      return exactMatch || response.data[0];
    }
    return null;
  } catch (error) {
    console.error(`  Error searching for ${scientificName}:`, error.message);
    return null;
  }
}

async function getPlantDetails(trefleId, apiKey) {
  const url = `${CONFIG.TREFLE_BASE_URL}/plants/${trefleId}?token=${apiKey}`;
  
  try {
    const response = await fetchJson(url);
    return response.data;
  } catch (error) {
    console.error(`  Error getting details for ${trefleId}:`, error.message);
    return null;
  }
}

function categorizePlant(plantData) {
  const genus = plantData.genus?.name || plantData.scientific_name?.split(' ')[0] || '';
  
  // Check category map
  for (const [prefix, category] of Object.entries(CATEGORY_MAP)) {
    if (genus.startsWith(prefix) || plantData.scientific_name?.includes(prefix)) {
      return category;
    }
  }
  
  // Fallback to family-based
  const family = (plantData.family?.name || '').toLowerCase();
  if (family.includes('cact')) return 'cactus';
  if (family.includes('succulent')) return 'succulent';
  if (family.includes('palm')) return 'palm';
  if (family.includes('fern')) return 'fern';
  
  return 'tropical';
}

function inferCareLevel(plantData) {
  const genus = plantData.genus?.name || '';
  
  for (const [prefix, level] of Object.entries(CARE_LEVEL_MAP)) {
    if (genus.startsWith(prefix)) return level;
  }
  
  return 'moderate';
}

function inferLightRequirement(plantData) {
  const genus = plantData.genus?.name || '';
  
  for (const [prefix, light] of Object.entries(LIGHT_MAP)) {
    if (genus.startsWith(prefix)) return light;
  }
  
  return 'bright-indirect';
}

function inferWaterRequirement(careLevel) {
  const map = {
    'easy': 'low',
    'moderate': 'moderate',
    'difficult': 'high'
  };
  return map[careLevel] || 'moderate';
}

function isPetSafe(plantData) {
  // Common toxic plants
  const toxicGenera = [
    'Monstera', 'Ficus', 'Philodendron', 'Dieffenbachia', 'Aglaonema',
    'Alocasia', 'Anthurium', 'Caladium', 'Codiaeum', 'Dracaena',
    'Epipremnum', 'Nerium', 'Sansevieria', 'Zamioculcas', 'Schefflera',
    'Syngonium', 'Tradescantia', 'Yucca'
  ];
  
  const genus = plantData.genus?.name || '';
  return !toxicGenera.some(toxic => genus.startsWith(toxic));
}

function getAvailableSizes(category) {
  switch (category) {
    case 'cactus':
    case 'succulent':
      return ['small', 'medium'];
    case 'palm':
    case 'tree':
      return ['medium', 'large'];
    case 'fern':
      return ['small', 'medium'];
    case 'vine':
      return ['small', 'medium'];
    default:
      return ['small', 'medium', 'large'];
  }
}

function getSuitablePlacements(category, careLevel) {
  const placements = [];
  
  // Floor plants
  if (['palm', 'tree', 'tropical'].includes(category)) {
    placements.push('floor');
  }
  
  // Shelf plants (most plants)
  if (['succulent', 'cactus', 'fern', 'tropical', 'flowering', 'herb'].includes(category)) {
    placements.push('shelf');
  }
  
  // Hanging plants
  if (['vine', 'fern'].includes(category)) {
    placements.push('hanging');
  }
  
  return placements.length > 0 ? placements : ['floor', 'shelf'];
}

function extractDescription(plantData) {
  if (plantData.observations) {
    return plantData.observations.substring(0, 200);
  }
  
  if (plantData.family?.common_name) {
    return `A member of the ${plantData.family.common_name} family.`;
  }
  
  return '';
}

// ==================== Main Process ====================

async function main() {
  console.log('🌱 Plant Codex Populator\n');
  console.log(`Target: ${CONFIG.TARGET_COUNT} plants\n`);

  // Load environment
  const env = loadEnv();
  const apiKey = env.TRUFLE_API_KEY;

  if (!apiKey) {
    console.error('Error: TRUFLE_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Initialize database
  const db = initDatabase();
  
  let successCount = 0;
  let failCount = 0;
  let imageSuccessCount = 0;
  let imageFailCount = 0;

  console.log('\nProcessing plants...\n');

  for (let i = 0; i < POPULAR_PLANTS.length && successCount < CONFIG.TARGET_COUNT; i++) {
    const scientificName = POPULAR_PLANTS[i];
    console.log(`[${i + 1}/${POPULAR_PLANTS.length}] ${scientificName}`);

    try {
      // Search Trefle
      const trefleData = await searchTrefle(scientificName, apiKey);
      
      if (!trefleData) {
        console.log(`  ❌ Not found on Trefle`);
        failCount++;
        await sleep(CONFIG.RATE_LIMIT_MS);
        continue;
      }

      // Get detailed data
      const details = await getPlantDetails(trefleData.id, apiKey);
      
      // Process plant data
      const genus = trefleData.genus?.name || scientificName.split(' ')[0];
      const category = categorizePlant(trefleData);
      const careLevel = inferCareLevel(trefleData);
      const plant = {
        id: `plant_${genus.toLowerCase()}_${trefleData.id}`,
        name: trefleData.common_name || scientificName,
        scientificName: trefleData.scientific_name,
        description: extractDescription(details || trefleData),
        category: category,
        icon: ICON_MAP[category] || '🌱',
        careLevel: careLevel,
        lightRequirement: inferLightRequirement(trefleData),
        waterRequirement: inferWaterRequirement(careLevel),
        petSafe: isPetSafe(trefleData),
        availableSizes: getAvailableSizes(category),
        suitablePlacements: getSuitablePlacements(category, careLevel),
        trefleId: trefleData.id.toString(),
      };

      // Insert plant
      await insertPlant(db, plant);
      successCount++;

      // Download image if available
      if (trefleData.image_url) {
        const extension = trefleData.image_url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
        const filename = `${plant.id}.${extension}`;
        const filepath = path.join(CONFIG.IMAGES_DIR, filename);

        try {
          await downloadImage(trefleData.image_url, filepath);
          
          // Insert image record
          await insertImage(db, {
            plantId: plant.id,
            imageUrl: trefleData.image_url,
            localPath: filepath,
            isPrimary: true,
            source: 'trefle',
            attribution: 'Trefle API'
          });

          console.log(`  ✅ Plant + Image`);
          imageSuccessCount++;
        } catch (err) {
          console.log(`  ✅ Plant, ❌ Image (${err.message})`);
          imageFailCount++;
        }
      } else {
        console.log(`  ✅ Plant (no image)`);
      }

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      failCount++;
    }

    // Rate limiting
    await sleep(CONFIG.RATE_LIMIT_MS);
  }

  // Close database
  db.close();

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Plants processed: ${successCount + failCount}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📥 Images: ${imageSuccessCount} downloaded, ${imageFailCount} failed`);
  console.log(`\nDatabase: ${CONFIG.DB_FILE}`);
  console.log(`Images: ${CONFIG.IMAGES_DIR}`);
  
  // File sizes
  const dbStats = fs.statSync(CONFIG.DB_FILE);
  console.log(`\nDatabase size: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);
  
  console.log('\n✨ Done!');
  console.log('\nNext steps:');
  console.log('1. Copy assets/plantai-seed.db to your app bundle');
  console.log('2. Include assets/plant-images/ directory');
  console.log('3. Update your app to use the seed database on first launch');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
