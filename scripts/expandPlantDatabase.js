#!/usr/bin/env node

/**
 * Expand Plant Database - Multi-Source Plant Data & Image Fetcher
 * 
 * Fetches plant data and images from multiple sources:
 * 1. Perenual API (primary) - Comprehensive plant data
 * 2. Unsplash API (fallback) - High-quality plant photography
 * 3. Trefle API (last resort) - Legacy support
 * 
 * Usage:
 *   node scripts/expandPlantDatabase.js [--test] [--limit=5]
 * 
 * Options:
 *   --test       Run in test mode (first 5 plants only)
 *   --limit=N    Process only N plants
 *   --dry-run    Don't download images or update files
 * 
 * Environment Variables (in .env.local):
 *   PERENUAL_API_KEY      - Perenual API key (required)
 *   UNSPLASH_ACCESS_KEY   - Unsplash Access Key (optional but recommended for best images)
 *   TREFLE_API_KEY        - Trefle API key (optional fallback)
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
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp-plants');
const LOG_FILE = path.join(PROJECT_ROOT, 'plant-expansion.log');

// API Configuration
const PERENUAL_BASE_URL = 'https://perenual.com/api';
const UNSPLASH_BASE_URL = 'https://api.unsplash.com';
const TREFLE_BASE_URL = 'https://trefle.io/api/v1';

// Rate limiting (be respectful to APIs)
const DELAY_BETWEEN_REQUESTS = 1200; // 1.2 seconds
const MAX_RETRIES = 3;

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test');
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : (isTestMode ? 5 : null);

// Curated list of plants to add (56 high-quality additions - no duplicates from existing 44)
const PLANTS_TO_ADD = [
  // === TROPICAL & FOLIAGE (15) ===
  {
    id: 'alocasia-amazonica',
    name: 'Alocasia Amazonica',
    scientificName: 'Alocasia amazonica',
    description: 'Dramatic arrow-shaped leaves with striking white veins',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium', 'large'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'moderate',
    icon: 'Leaf',
  },
  {
    id: 'pilea-peperomioides',
    name: 'Chinese Money Plant',
    scientificName: 'Pilea peperomioides',
    description: 'Unique round coin-shaped leaves on delicate stems',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Circle',
  },
  {
    id: 'maranta-leuconeura',
    name: 'Prayer Plant',
    scientificName: 'Maranta leuconeura',
    description: 'Patterned leaves that fold up at night like praying hands',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'HandsPraying',
  },
  {
    id: 'stromanthe-sanguinea',
    name: 'Triostar Stromanthe',
    scientificName: 'Stromanthe sanguinea',
    description: 'Stunning tricolor leaves in cream, green, and pink',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'high',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'moderate',
    icon: 'PaintBrush',
  },
  {
    id: 'ficus-benjamina',
    name: 'Weeping Fig',
    scientificName: 'Ficus benjamina',
    description: 'Graceful tree with arching branches and glossy leaves',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['medium', 'large'],
    suitablePlacements: ['floor'],
    growthRate: 'moderate',
    icon: 'Tree',
  },
  {
    id: 'schefflera-arboricola',
    name: 'Umbrella Plant',
    scientificName: 'Schefflera arboricola',
    description: 'Compact tree with umbrella-like leaf clusters',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium', 'large'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'moderate',
    icon: 'Umbrella',
  },
  {
    id: 'dracaena-fragrans',
    name: 'Corn Plant',
    scientificName: 'Dracaena fragrans',
    description: 'Tall stalks with arching corn-like leaves',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['medium', 'large'],
    suitablePlacements: ['floor'],
    growthRate: 'slow',
    icon: 'Plant',
  },
  {
    id: 'cordyline-fruticosa',
    name: 'Ti Plant',
    scientificName: 'Cordyline fruticosa',
    description: 'Colorful tropical foliage in reds, pinks, and greens',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium', 'large'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'moderate',
    icon: 'Leaf',
  },
  {
    id: 'begonia-rex',
    name: 'Rex Begonia',
    scientificName: 'Begonia rex',
    description: 'Ornamental leaves with metallic patterns and colors',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'PaintBrush',
  },
  {
    id: 'caladium',
    name: 'Angel Wings',
    scientificName: 'Caladium bicolor',
    description: 'Heart-shaped leaves with vibrant pink, red, and white patterns',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'fast',
    icon: 'Heart',
  },
  {
    id: 'ctenanthe-burle-marxii',
    name: 'Fishbone Prayer Plant',
    scientificName: 'Ctenanthe burle-marxii',
    description: 'Fishbone-patterned leaves with purple undersides',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Fish',
  },
  {
    id: 'calathea-makoyana',
    name: 'Peacock Plant',
    scientificName: 'Goeppertia makoyana',
    description: 'Intricate peacock feather-like patterns on leaves',
    category: 'tropical',
    careLevel: 'difficult',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'high',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Eye',
  },
  {
    id: 'calathea-orbifolia',
    name: 'Round-Leaf Calathea',
    scientificName: 'Goeppertia orbifolia',
    description: 'Large round leaves with silver-green stripes',
    category: 'tropical',
    careLevel: 'difficult',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'high',
    petSafe: true,
    availableSizes: ['medium', 'large'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'slow',
    icon: 'Circle',
  },
  {
    id: 'polyscias-fruticosa',
    name: 'Ming Aralia',
    scientificName: 'Polyscias fruticosa',
    description: 'Delicate fern-like foliage on woody stems',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium', 'large'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'slow',
    icon: 'Tree',
  },
  {
    id: 'yucca-elephantipes',
    name: 'Spineless Yucca',
    scientificName: 'Yucca elephantipes',
    description: 'Architectural plant with sword-like leaves on thick trunks',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['medium', 'large'],
    suitablePlacements: ['floor'],
    growthRate: 'slow',
    icon: 'Sword',
  },

  // === SUCCULENTS & CACTI (10) ===
  {
    id: 'sedum-morganianum',
    name: "Burro's Tail",
    scientificName: 'Sedum morganianum',
    description: 'Trailing succulent with plump, overlapping leaves',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'slow',
    icon: 'DotsThree',
  },
  {
    id: 'sedum-rubrotinctum',
    name: 'Jelly Bean Plant',
    scientificName: 'Sedum rubrotinctum',
    description: 'Chubby bean-shaped leaves that turn red in sun',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Circle',
  },
  {
    id: 'graptopetalum-paraguayense',
    name: 'Ghost Plant',
    scientificName: 'Graptopetalum paraguayense',
    description: 'Pale blue-gray rosettes with a ghostly appearance',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Ghost',
  },
  {
    id: 'crassula-perforata',
    name: 'String of Buttons',
    scientificName: 'Crassula perforata',
    description: 'Stacked triangular leaves threaded on stems',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Stack',
  },
  {
    id: 'kalanchoe-tomentosa',
    name: 'Panda Plant',
    scientificName: 'Kalanchoe tomentosa',
    description: 'Fuzzy gray-green leaves with brown edges',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Cat',
  },
  {
    id: 'aloe-aristata',
    name: 'Lace Aloe',
    scientificName: 'Aloe aristata',
    description: 'Compact aloe with white-spotted leaves and soft teeth',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Leaf',
  },
  {
    id: 'gasteria-bicolor',
    name: 'Ox Tongue',
    scientificName: 'Gasteria bicolor',
    description: 'Thick tongue-shaped leaves with white spots',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Leaf',
  },
  {
    id: 'echinocactus-grusonii',
    name: 'Golden Barrel Cactus',
    scientificName: 'Echinocactus grusonii',
    description: 'Spherical cactus with golden spines',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['small', 'medium', 'large'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'slow',
    icon: 'Circle',
  },
  {
    id: 'mammillaria-elongata',
    name: 'Ladyfinger Cactus',
    scientificName: 'Mammillaria elongata',
    description: 'Clustering cylindrical cactus with golden spines',
    category: 'succulent',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Cactus',
  },
  {
    id: 'gymnocalycium-mihanovichii',
    name: 'Moon Cactus',
    scientificName: 'Gymnocalycium mihanovichii',
    description: 'Colorful grafted cactus in red, pink, or yellow',
    category: 'succulent',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Moon',
  },

  // === VINES & TRAILING (10) ===
  {
    id: 'monstera-adansonii',
    name: 'Swiss Cheese Vine',
    scientificName: 'Monstera adansonii',
    description: 'Trailing monstera with distinctive holes in leaves',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'fast',
    icon: 'Leaf',
  },
  {
    id: 'rhaphidophora-tetrasperma',
    name: 'Mini Monstera',
    scientificName: 'Rhaphidophora tetrasperma',
    description: 'Fast-growing vine with split leaves resembling monstera',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'fast',
    icon: 'Leaf',
  },
  {
    id: 'scindapsus-pictus',
    name: 'Satin Pothos',
    scientificName: 'Scindapsus pictus',
    description: 'Velvety leaves with silver splashes',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Sparkle',
  },
  {
    id: 'philodendron-micans',
    name: 'Velvet Leaf Philodendron',
    scientificName: 'Philodendron hederaceum micans',
    description: 'Velvety bronze-green heart-shaped leaves',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'fast',
    icon: 'Heart',
  },
  {
    id: 'philodendron-melanochrysum',
    name: 'Black Gold Philodendron',
    scientificName: 'Philodendron melanochrysum',
    description: 'Velvety black leaves with golden veins',
    category: 'vine',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Sparkle',
  },
  {
    id: 'syngonium-podophyllum',
    name: 'Arrowhead Vine',
    scientificName: 'Syngonium podophyllum',
    description: 'Arrow-shaped leaves that change form as they mature',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'fast',
    icon: 'ArrowUp',
  },
  {
    id: 'hoya-kerrii',
    name: 'Sweetheart Hoya',
    scientificName: 'Hoya kerrii',
    description: 'Heart-shaped succulent leaves, often sold as singles',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Heart',
  },
  {
    id: 'hoya-obovata',
    name: 'Wax Plant',
    scientificName: 'Hoya obovata',
    description: 'Round waxy leaves with silver splashes',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'slow',
    icon: 'Circle',
  },
  {
    id: 'senecio-radicans',
    name: 'String of Bananas',
    scientificName: 'Senecio radicans',
    description: 'Trailing succulent with banana-shaped leaves',
    category: 'vine',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'low',
    petSafe: false,
    availableSizes: ['small'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'DotsThree',
  },
  {
    id: 'dischidia-nummularia',
    name: 'String of Nickels',
    scientificName: 'Dischidia nummularia',
    description: 'Delicate trailing vine with round coin-like leaves',
    category: 'vine',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Circle',
  },

  // === FERNS (5) ===
  {
    id: 'pteris-cretica',
    name: 'Cretan Brake Fern',
    scientificName: 'Pteris cretica',
    description: 'Delicate fronds with variegated cream and green',
    category: 'fern',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'high',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Leaf',
  },
  {
    id: 'davallia-fejeensis',
    name: "Rabbit's Foot Fern",
    scientificName: 'Davallia fejeensis',
    description: 'Fuzzy rhizomes that creep over the pot edge',
    category: 'fern',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Rabbit',
  },
  {
    id: 'microsorum-diversifolium',
    name: 'Kangaroo Fern',
    scientificName: 'Microsorum diversifolium',
    description: 'Glossy dark green fronds with unique texture',
    category: 'fern',
    careLevel: 'easy',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Leaf',
  },
  {
    id: 'polystichum-polyblepharum',
    name: 'Tassel Fern',
    scientificName: 'Polystichum polyblepharum',
    description: 'Glossy arching fronds with tassel-like tips',
    category: 'fern',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Leaf',
  },
  {
    id: 'phlebodium-aureum',
    name: 'Blue Star Fern',
    scientificName: 'Phlebodium aureum',
    description: 'Blue-green fronds with fuzzy golden rhizomes',
    category: 'fern',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Star',
  },

  // === PALMS (5) ===
  {
    id: 'rhapis-excelsa',
    name: 'Lady Palm',
    scientificName: 'Rhapis excelsa',
    description: 'Elegant fan-shaped fronds on bamboo-like stems',
    category: 'palm',
    careLevel: 'easy',
    lightRequirement: 'low-to-bright',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['medium', 'large'],
    suitablePlacements: ['floor'],
    growthRate: 'slow',
    icon: 'Tree',
  },
  {
    id: 'caryota-mitis',
    name: 'Fishtail Palm',
    scientificName: 'Caryota mitis',
    description: 'Unique fishtail-shaped leaflets on clustering stems',
    category: 'palm',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['medium', 'large'],
    suitablePlacements: ['floor'],
    growthRate: 'moderate',
    icon: 'Fish',
  },
  {
    id: 'phoenix-roebelenii',
    name: 'Pygmy Date Palm',
    scientificName: 'Phoenix roebelenii',
    description: 'Compact palm with graceful arching fronds',
    category: 'palm',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium', 'large'],
    suitablePlacements: ['floor'],
    growthRate: 'slow',
    icon: 'Tree',
  },
  {
    id: 'livistona-rotundifolia',
    name: 'Footstool Palm',
    scientificName: 'Livistona rotundifolia',
    description: 'Round fan-shaped leaves on slender trunk',
    category: 'palm',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['medium', 'large'],
    suitablePlacements: ['floor'],
    growthRate: 'slow',
    icon: 'Circle',
  },

  // === FLOWERING (10) ===
  {
    id: 'hibiscus-rosa-sinensis',
    name: 'Tropical Hibiscus',
    scientificName: 'Hibiscus rosa-sinensis',
    description: 'Large showy flowers in vibrant tropical colors',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-direct',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium', 'large'],
    suitablePlacements: ['floor', 'shelf'],
    growthRate: 'moderate',
    icon: 'Flower',
  },
  {
    id: 'aeschynanthus-radicans',
    name: 'Lipstick Plant',
    scientificName: 'Aeschynanthus radicans',
    description: 'Trailing plant with tubular red flowers',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Flower',
  },
  {
    id: 'columnea-gloriosa',
    name: 'Goldfish Plant',
    scientificName: 'Columnea gloriosa',
    description: 'Trailing plant with orange goldfish-shaped flowers',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'moderate',
    icon: 'Fish',
  },
  {
    id: 'streptocarpus',
    name: 'Cape Primrose',
    scientificName: 'Streptocarpus',
    description: 'Rosette of leaves with colorful tubular flowers',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Flower',
  },
  {
    id: 'sinningia-speciosa',
    name: 'Gloxinia',
    scientificName: 'Sinningia speciosa',
    description: 'Velvety leaves with large bell-shaped flowers',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Bell',
  },
  {
    id: 'begonia-maculata',
    name: 'Polka Dot Begonia',
    scientificName: 'Begonia maculata',
    description: 'Angel wing leaves with white polka dots',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Circle',
  },
  {
    id: 'cyclamen-persicum',
    name: "Florist's Cyclamen",
    scientificName: 'Cyclamen persicum',
    description: 'Heart-shaped leaves with upswept butterfly flowers',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Butterfly',
  },
  {
    id: 'gardenia-jasminoides',
    name: 'Gardenia',
    scientificName: 'Gardenia jasminoides',
    description: 'Glossy leaves with intensely fragrant white flowers',
    category: 'flowering',
    careLevel: 'difficult',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'high',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Flower',
  },
  {
    id: 'jasminum-polyanthum',
    name: 'Pink Jasmine',
    scientificName: 'Jasminum polyanthum',
    description: 'Climbing vine with fragrant pink and white flowers',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'fast',
    icon: 'Flower',
  },
  {
    id: 'mandevilla',
    name: 'Rocktrumpet',
    scientificName: 'Mandevilla sanderi',
    description: 'Climbing vine with large trumpet-shaped flowers',
    category: 'flowering',
    careLevel: 'moderate',
    lightRequirement: 'bright-direct',
    waterRequirement: 'moderate',
    petSafe: false,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf', 'hanging'],
    growthRate: 'fast',
    icon: 'Flower',
  },

  // === HERBS & EDIBLE (5) ===
  {
    id: 'basil',
    name: 'Basil',
    scientificName: 'Ocimum basilicum',
    description: 'Aromatic herb with flavorful green leaves',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'fast',
    icon: 'Leaf',
  },
  {
    id: 'mint',
    name: 'Mint',
    scientificName: 'Mentha spicata',
    description: 'Refreshing herb that spreads vigorously',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'high',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'fast',
    icon: 'Leaf',
  },
  {
    id: 'rosemary',
    name: 'Rosemary',
    scientificName: 'Rosmarinus officinalis',
    description: 'Woody herb with needle-like aromatic leaves',
    category: 'tropical',
    careLevel: 'moderate',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small', 'medium'],
    suitablePlacements: ['shelf'],
    growthRate: 'slow',
    icon: 'Tree',
  },
  {
    id: 'thyme',
    name: 'Thyme',
    scientificName: 'Thymus vulgaris',
    description: 'Low-growing herb with tiny fragrant leaves',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'bright-direct',
    waterRequirement: 'low',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Leaf',
  },
  {
    id: 'parsley',
    name: 'Parsley',
    scientificName: 'Petroselinum crispum',
    description: 'Curly or flat-leaf herb rich in vitamins',
    category: 'tropical',
    careLevel: 'easy',
    lightRequirement: 'bright-indirect',
    waterRequirement: 'moderate',
    petSafe: true,
    availableSizes: ['small'],
    suitablePlacements: ['shelf'],
    growthRate: 'moderate',
    icon: 'Leaf',
  },
];

// Utility functions
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`Error: ${ENV_FILE} not found`);
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  const fullMessage = data ? `${logMessage}\n${JSON.stringify(data, null, 2)}` : logMessage;
  fs.appendFileSync(LOG_FILE, fullMessage + '\n');
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
          reject(new Error(`Failed to parse JSON from ${url}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects'));
      }
      
      protocol.get(currentUrl, (res) => {
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

// API Functions
async function fetchFromPerenual(scientificName, apiKey) {
  const encodedName = encodeURIComponent(scientificName);
  const url = `${PERENUAL_BASE_URL}/species-list?key=${apiKey}&q=${encodedName}`;
  
  try {
    log(`  Searching Perenual for: ${scientificName}`);
    const response = await fetchJson(url);
    
    if (response.data && response.data.length > 0) {
      const plant = response.data[0];
      log(`  ✓ Found on Perenual: ${plant.common_name || plant.scientific_name}`);
      return {
        source: 'perenual',
        imageUrl: plant.default_image?.regular_url || plant.default_image?.medium_url || plant.default_image?.small_url,
        commonName: plant.common_name,
        scientificName: plant.scientific_name,
      };
    }
    
    log(`  ✗ Not found on Perenual`);
    return null;
  } catch (error) {
    log(`  ✗ Perenual error: ${error.message}`);
    return null;
  }
}

async function fetchFromUnsplash(plantName, accessKey) {
  if (!accessKey) {
    log(`  ⊘ Unsplash Access Key not provided, skipping`);
    return null;
  }
  
  const query = encodeURIComponent(`${plantName} houseplant indoor`);
  const url = `${UNSPLASH_BASE_URL}/search/photos?query=${query}&per_page=1&client_id=${accessKey}`;
  
  try {
    log(`  Searching Unsplash for: ${plantName}`);
    const response = await fetchJson(url);
    
    if (response.results && response.results.length > 0) {
      const photo = response.results[0];
      log(`  ✓ Found on Unsplash by ${photo.user.name}`);
      return {
        source: 'unsplash',
        imageUrl: photo.urls.regular,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
      };
    }
    
    log(`  ✗ Not found on Unsplash`);
    return null;
  } catch (error) {
    log(`  ✗ Unsplash error: ${error.message}`);
    return null;
  }
}

async function fetchFromTrefle(scientificName, apiKey) {
  if (!apiKey) {
    log(`  ⊘ Trefle API key not provided, skipping`);
    return null;
  }
  
  const encodedName = encodeURIComponent(scientificName);
  const url = `${TREFLE_BASE_URL}/plants/search?token=${apiKey}&q=${encodedName}`;
  
  try {
    log(`  Searching Trefle for: ${scientificName}`);
    const response = await fetchJson(url);
    
    if (response.data && response.data.length > 0) {
      const plant = response.data[0];
      log(`  ✓ Found on Trefle`);
      return {
        source: 'trefle',
        imageUrl: plant.image_url,
      };
    }
    
    log(`  ✗ Not found on Trefle`);
    return null;
  } catch (error) {
    log(`  ✗ Trefle error: ${error.message}`);
    return null;
  }
}

async function fetchPlantData(plant, apiKeys) {
  log(`\nFetching data for: ${plant.name} (${plant.scientificName})`);
  
  // Try Perenual first (best quality)
  let result = await fetchFromPerenual(plant.scientificName, apiKeys.perenual);
  if (result && result.imageUrl) return result;
  
  // Try Unsplash (high quality photos)
  result = await fetchFromUnsplash(plant.name, apiKeys.unsplash);
  if (result && result.imageUrl) return result;
  
  // Try Trefle as last resort
  result = await fetchFromTrefle(plant.scientificName, apiKeys.trefle);
  if (result && result.imageUrl) return result;
  
  log(`  ✗ No image found from any source`);
  return null;
}

async function processPlant(plant, apiKeys, stats) {
  try {
    // Fetch plant data from APIs
    let data = await fetchPlantData(plant, apiKeys);
    
    if (!data || !data.imageUrl) {
      stats.failed.push({ plant: plant.name, reason: 'No image found' });
      return null;
    }
    
    // Download image
    if (!isDryRun) {
      const extension = data.imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
      const filename = `${plant.id}.${extension}`;
      const tempPath = path.join(TEMP_DIR, filename);
      const finalPath = path.join(ASSETS_DIR, filename);
      
      log(`  Downloading image...`);
      
      try {
        await downloadImage(data.imageUrl, tempPath);
      } catch (downloadError) {
        // If download failed with 404 and we haven't tried Unsplash yet, try it as fallback
        if (downloadError.message.includes('404') && data.source !== 'unsplash' && apiKeys.unsplash) {
          log(`  ✗ Download failed (404), trying Unsplash fallback...`);
          const unsplashData = await fetchFromUnsplash(plant.name, apiKeys.unsplash);
          
          if (unsplashData && unsplashData.imageUrl) {
            data = unsplashData;
            await downloadImage(data.imageUrl, tempPath);
            log(`  ✓ Fallback successful from Unsplash`);
          } else {
            throw downloadError; // Re-throw if fallback also failed
          }
        } else {
          throw downloadError; // Re-throw if not a 404 or already tried Unsplash
        }
      }
      
      // Check file size
      const fileStats = fs.statSync(tempPath);
      const fileSizeKB = Math.round(fileStats.size / 1024);
      log(`  Downloaded: ${filename} (${fileSizeKB}KB)`);
      
      // Move to final location
      fs.renameSync(tempPath, finalPath);
      
      stats.downloaded.push({
        plant: plant.name,
        filename,
        size: fileSizeKB,
        source: data.source,
      });
      
      return {
        ...plant,
        imageFilename: filename,
        imageSource: data.source,
      };
    } else {
      log(`  [DRY RUN] Would download from ${data.source}`);
      stats.downloaded.push({
        plant: plant.name,
        source: data.source,
      });
      return {
        ...plant,
        imageSource: data.source,
      };
    }
  } catch (error) {
    log(`  ✗ Error processing plant: ${error.message}`);
    stats.failed.push({ plant: plant.name, reason: error.message });
    return null;
  }
}

function generateTypeScriptCode(plants) {
  const entries = plants.map(plant => {
    const sizes = plant.availableSizes.map(s => `'${s}'`).join(', ');
    const placements = plant.suitablePlacements.map(p => `'${p}'`).join(', ');
    
    return `  {
    id: '${plant.id}',
    name: '${plant.name}',
    scientificName: '${plant.scientificName}',
    description: '${plant.description}',
    icon: '${plant.icon}',
    category: '${plant.category}',
    lightRequirement: '${plant.lightRequirement}',
    waterRequirement: '${plant.waterRequirement}',
    availableSizes: [${sizes}],
    suitablePlacements: [${placements}],
    careLevel: '${plant.careLevel}',
    growthRate: '${plant.growthRate}',
    petSafe: ${plant.petSafe},
    imageUrl: require('../../assets/plants/${plant.imageFilename}'),
  }`;
  }).join(',\n');
  
  return `
  // === NEWLY ADDED PLANTS ===
${entries},
`;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Plant Database Expansion - Multi-Source Fetcher       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (isTestMode) {
    console.log('🧪 TEST MODE: Processing first 5 plants only\n');
  }
  if (isDryRun) {
    console.log('🔍 DRY RUN: No files will be modified\n');
  }
  
  // Load environment
  log('Loading environment variables...');
  const env = loadEnv();
  const apiKeys = {
    perenual: env.PERENUAL_API_KEY,
    unsplash: env.UNSPLASH_ACCESS_KEY,
    trefle: env.TREFLE_API_KEY || env.TRUFLE_API_KEY, // Support both spellings
  };
  
  if (!apiKeys.perenual) {
    console.error('❌ Error: PERENUAL_API_KEY not found in .env.local');
    console.error('   Get your API key from: https://perenual.com/docs/api');
    process.exit(1);
  }
  
  log('✓ Perenual API key loaded');
  if (apiKeys.unsplash) log('✓ Unsplash API key loaded');
  if (apiKeys.trefle) log('✓ Trefle API key loaded (fallback)');
  
  // Create directories
  if (!isDryRun) {
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }
  
  // Process plants
  const plantsToProcess = limit ? PLANTS_TO_ADD.slice(0, limit) : PLANTS_TO_ADD;
  log(`\nProcessing ${plantsToProcess.length} plants...\n`);
  
  const stats = {
    downloaded: [],
    failed: [],
  };
  
  const successfulPlants = [];
  
  for (let i = 0; i < plantsToProcess.length; i++) {
    const plant = plantsToProcess[i];
    console.log(`\n[${i + 1}/${plantsToProcess.length}] ${plant.name}`);
    console.log('─'.repeat(60));
    
    const result = await processPlant(plant, apiKeys, stats);
    if (result) {
      successfulPlants.push(result);
    }
    
    // Rate limiting
    if (i < plantsToProcess.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
  
  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Total plants processed: ${plantsToProcess.length}`);
  console.log(`✓ Successfully downloaded: ${stats.downloaded.length}`);
  console.log(`✗ Failed: ${stats.failed.length}\n`);
  
  if (stats.downloaded.length > 0) {
    console.log('Downloaded images:');
    const bySource = stats.downloaded.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });
    
    if (!isDryRun) {
      const totalSize = stats.downloaded.reduce((sum, item) => sum + (item.size || 0), 0);
      console.log(`  Total size: ${Math.round(totalSize / 1024)}MB`);
    }
  }
  
  if (stats.failed.length > 0) {
    console.log('\nFailed plants:');
    stats.failed.forEach(item => {
      console.log(`  ✗ ${item.plant}: ${item.reason}`);
    });
  }
  
  // Generate TypeScript code
  if (successfulPlants.length > 0 && !isDryRun) {
    const outputFile = path.join(PROJECT_ROOT, 'new-plants.ts');
    const tsCode = generateTypeScriptCode(successfulPlants);
    fs.writeFileSync(outputFile, tsCode);
    
    console.log(`\n✓ Generated TypeScript code: ${outputFile}`);
    console.log('\nNext steps:');
    console.log('1. Review the downloaded images in assets/plants/');
    console.log('2. Copy the plant entries from new-plants.ts');
    console.log('3. Paste them into src/data/plantDatabase.ts (before the closing bracket)');
    console.log('4. Test the app to verify images load correctly');
    console.log('5. Delete temp-plants/ directory when done');
  }
  
  // Clean up temp directory if empty
  if (!isDryRun && fs.existsSync(TEMP_DIR)) {
    const tempFiles = fs.readdirSync(TEMP_DIR);
    if (tempFiles.length === 0) {
      fs.rmdirSync(TEMP_DIR);
    }
  }
  
  console.log(`\n✓ Log saved to: ${LOG_FILE}`);
  console.log('\n✨ Done!\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
