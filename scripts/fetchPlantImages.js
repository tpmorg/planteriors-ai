#!/usr/bin/env node

/**
 * Fetches plant images from Trefle API and updates plantDatabase.ts
 *
 * Usage: node scripts/fetchPlantImages.js
 *
 * Requires TRUFLE_API_KEY in .env.local
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');
const PLANT_DB_FILE = path.join(PROJECT_ROOT, 'src/data/plantDatabase.ts');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets/plants');
const TREFLE_BASE_URL = 'https://trefle.io/api/v1';

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second between API calls

/**
 * Load environment variables from .env.local
 */
function loadEnv() {
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
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

/**
 * Make an HTTPS GET request
 */
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

/**
 * Download an image from URL to local file
 */
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects'));
      }

      protocol.get(currentUrl, (res) => {
        // Handle redirects
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

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search Trefle API for a plant by scientific name
 */
async function searchPlant(scientificName, apiKey) {
  const encodedName = encodeURIComponent(scientificName);
  const url = `${TREFLE_BASE_URL}/plants/search?token=${apiKey}&q=${encodedName}`;

  try {
    const response = await fetchJson(url);

    if (response.data && response.data.length > 0) {
      // Return the first match (best match)
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error(`  Error searching for ${scientificName}:`, error.message);
    return null;
  }
}

/**
 * Extract the best image URL from Trefle plant data
 */
function getBestImageUrl(plantData) {
  // Priority: image_url, then first image in images array
  if (plantData.image_url) {
    return plantData.image_url;
  }
  return null;
}

/**
 * Parse plant entries from plantDatabase.ts
 */
function parsePlantDatabase(content) {
  // Extract the INDIVIDUAL_PLANTS array content
  const arrayMatch = content.match(/export const INDIVIDUAL_PLANTS: IndividualPlant\[\] = \[([\s\S]*?)\];/);
  if (!arrayMatch) {
    throw new Error('Could not find INDIVIDUAL_PLANTS array in file');
  }

  // Parse individual plant objects
  const plants = [];
  const plantRegex = /\{\s*id:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = plantRegex.exec(arrayMatch[1])) !== null) {
    // Find the scientific name for this plant
    const idPos = match.index;
    const plantBlockEnd = arrayMatch[1].indexOf('},', idPos);
    const plantBlock = arrayMatch[1].substring(idPos, plantBlockEnd + 1);

    const scientificMatch = plantBlock.match(/scientificName:\s*['"]([^'"]+)['"]/);
    const nameMatch = plantBlock.match(/name:\s*['"]([^'"]+)['"]/);

    if (scientificMatch) {
      plants.push({
        id: match[1],
        name: nameMatch ? nameMatch[1] : match[1],
        scientificName: scientificMatch[1],
      });
    }
  }

  return plants;
}

/**
 * Update plantDatabase.ts with imageUrl fields
 */
function updatePlantDatabase(content, imageMap) {
  let updatedContent = content;

  for (const [plantId, imagePath] of Object.entries(imageMap)) {
    // Find the plant entry and add imageUrl after petSafe
    const petSafePattern = new RegExp(
      `(id:\\s*['"]${plantId}['"][\\s\\S]*?petSafe:\\s*(?:true|false)),`,
      'g'
    );

    updatedContent = updatedContent.replace(petSafePattern, (match, group1) => {
      return `${group1},\n    imageUrl: require('../../assets/plants/${imagePath}'),`;
    });
  }

  return updatedContent;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Plant Image Fetcher ===\n');

  // Load environment
  console.log('Loading environment...');
  const env = loadEnv();
  const apiKey = env.TRUFLE_API_KEY;

  if (!apiKey) {
    console.error('Error: TRUFLE_API_KEY not found in .env.local');
    process.exit(1);
  }
  console.log('API key loaded.\n');

  // Ensure assets directory exists
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  // Read plant database
  console.log('Reading plant database...');
  const dbContent = fs.readFileSync(PLANT_DB_FILE, 'utf-8');
  const plants = parsePlantDatabase(dbContent);
  console.log(`Found ${plants.length} plants.\n`);

  // Track downloaded images
  const imageMap = {};
  let successCount = 0;
  let failCount = 0;

  // Process each plant
  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i];
    console.log(`[${i + 1}/${plants.length}] ${plant.name} (${plant.scientificName})`);

    // Search Trefle API
    const trefleData = await searchPlant(plant.scientificName, apiKey);

    if (!trefleData) {
      console.log('  No results found on Trefle');
      failCount++;
      await sleep(DELAY_BETWEEN_REQUESTS);
      continue;
    }

    // Get image URL
    const imageUrl = getBestImageUrl(trefleData);

    if (!imageUrl) {
      console.log('  No image available');
      failCount++;
      await sleep(DELAY_BETWEEN_REQUESTS);
      continue;
    }

    console.log(`  Found image: ${imageUrl.substring(0, 60)}...`);

    // Download image
    const extension = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
    const filename = `${plant.id}.${extension}`;
    const filepath = path.join(ASSETS_DIR, filename);

    try {
      await downloadImage(imageUrl, filepath);
      console.log(`  Downloaded: ${filename}`);
      imageMap[plant.id] = filename;
      successCount++;
    } catch (error) {
      console.log(`  Download failed: ${error.message}`);
      failCount++;
    }

    // Rate limiting
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  console.log('\n=== Summary ===');
  console.log(`Downloaded: ${successCount}/${plants.length}`);
  console.log(`Failed: ${failCount}/${plants.length}`);

  if (successCount > 0) {
    // Update the TypeScript file
    console.log('\nUpdating plantDatabase.ts...');
    const updatedContent = updatePlantDatabase(dbContent, imageMap);
    fs.writeFileSync(PLANT_DB_FILE, updatedContent);
    console.log('Done!');
  }

  console.log('\nImages saved to: assets/plants/');
}

// Run
main().catch(console.error);
