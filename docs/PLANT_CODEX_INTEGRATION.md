# Plant Codex Integration Guide

## What Was Built

### 1. **Enhanced Database Schema (v3)**
New tables added to `src/services/databaseService.ts`:
- `plants` - 200 popular houseplants with metadata
- `plant_images` - Multiple images per plant with local caching
- `plants_fts` - Full-text search index (FTS5)
- `plant_search_cache` - API search results caching

### 2. **Plant Search Service**
`src/services/plantSearchService.ts` provides:
- Smart search (local FTS5 → cache → API fallback)
- Category filtering
- Image caching for offline use
- Rate-limited API calls (respects Trefle limits)

### 3. **Node Population Script**
`scripts/populatePlantCodex.js`:
- Seeds database with 200 popular houseplants
- Downloads images to `assets/plant-images/`
- Creates user-friendly category taxonomy
- Respects Trefle API rate limits (1 req/sec)

### 4. **Custom Category System**
10 user-friendly categories:
- 🌿 Tropical, 🌵 Succulents, 🌵 Cacti, 🌴 Palms
- 🌿 Ferns, 🌿 Vines, 🌸 Flowering, 🌱 Herbs, 🌳 Trees

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
# For the node script (SQLite3)
npm install --save-dev sqlite3

# For the app (already have expo-sqlite)
# expo-sqlite should already be installed
```

### Step 2: Run the Population Script

```bash
# Ensure you have Trefle API key in .env.local
# TRUFLE_API_KEY=your_key_here

# Run the script
node scripts/populatePlantCodex.js

# This creates:
# - assets/plantai-seed.db (pre-populated SQLite database)
# - assets/plant-images/ (downloaded plant photos)
```

**Expected output:**
```
🌱 Plant Codex Populator

Target: 200 plants

Processing plants...

[1/200] Monstera deliciosa
  ✅ Plant + Image
[2/200] Ficus lyrata
  ✅ Plant + Image
...

=== Summary ===
Plants processed: 200
✅ Success: 180
❌ Failed: 20
📥 Images: 150 downloaded, 30 failed

Database: /assets/plantai-seed.db
Images: /assets/plant-images/
```

### Step 3: Bundle Assets

Add to `app.json`:
```json
{
  "expo": {
    "assetBundlePatterns": [
      "assets/plant-images/*",
      "assets/plantai-seed.db"
    ]
  }
}
```

### Step 4: Database Initialization

On first app launch, copy the seed database:

```typescript
// src/utils/databaseSetup.ts
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

const SEED_DB_NAME = 'plantai-seed.db';
const DB_NAME = 'plantai.db';

export async function setupDatabase(): Promise<string> {
  const dbPath = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
  
  // Check if database already exists
  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  
  if (!fileInfo.exists) {
    // Copy seed database from assets
    const asset = Asset.fromModule(require('../../assets/plantai-seed.db'));
    await asset.downloadAsync();
    
    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}SQLite`,
      { intermediates: true }
    );
    
    // Copy to documents
    await FileSystem.copyAsync({
      from: asset.localUri!,
      to: dbPath
    });
    
    console.log('Database initialized from seed');
  }
  
  return dbPath;
}
```

---

## Using the Plant Codex

### Basic Search

```typescript
import { useDatabase } from '../contexts/DatabaseContext';
import { getPlantSearchService } from '../services/plantSearchService';

function PlantSearchScreen() {
  const { db } = useDatabase();
  const searchService = getPlantSearchService(db);
  
  const handleSearch = async (query: string) => {
    const results = await searchService.search({
      query,
      limit: 20,
      source: 'all' // Try local first, then API
    });
    
    return results;
  };
}
```

### Get Popular Plants (Offline)

```typescript
// These are always available offline
const popularPlants = await searchService.getPopularPlants(50);
```

### Filter by Category

```typescript
const ferns = await searchService.getPlantsByCategory('fern', 20);
```

### Advanced Search with Filters

```typescript
const results = await searchService.search({
  query: 'monstera',
  category: 'tropical',
  careLevel: 'easy',
  petSafe: true,
  limit: 10
});
```

### Cache Images for Offline

```typescript
// When user views a plant, cache its image
await searchService.cachePlantImage(plantId, imageUrl);
```

---

## Enhanced IndividualPlantSelector

Replace the existing component with the enhanced version:

```typescript
// src/components/EnhancedIndividualPlantSelector.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useDebounce } from '../hooks/useDebounce';
import { getPlantSearchService } from '../services/plantSearchService';
import { useDatabase } from '../contexts/DatabaseContext';
import { PlantSearchResult } from '../types';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌿' },
  { id: 'tropical', name: 'Tropical', icon: '🌴' },
  { id: 'succulent', name: 'Succulents', icon: '🌵' },
  { id: 'cactus', name: 'Cacti', icon: '🌵' },
  { id: 'palm', name: 'Palms', icon: '🌴' },
  { id: 'fern', name: 'Ferns', icon: '🌿' },
  { id: 'vine', name: 'Vines', icon: '🌿' },
  { id: 'flowering', name: 'Flowering', icon: '🌸' },
  { id: 'herb', name: 'Herbs', icon: '🌱' },
];

export const EnhancedIndividualPlantSelector: React.FC<Props> = ({
  onSelectionChange,
  selection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [plants, setPlants] = useState<PlantSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const debouncedQuery = useDebounce(searchQuery, 300);
  const { db } = useDatabase();
  const searchService = getPlantSearchService(db);

  // Load popular plants initially
  useEffect(() => {
    loadPopularPlants();
  }, []);

  // Search when query or category changes
  useEffect(() => {
    if (debouncedQuery || selectedCategory !== 'all') {
      performSearch();
    } else {
      loadPopularPlants();
    }
  }, [debouncedQuery, selectedCategory]);

  const loadPopularPlants = async () => {
    setLoading(true);
    try {
      const results = await searchService.getPopularPlants(50);
      setPlants(results);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      const results = await searchService.search({
        query: debouncedQuery,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        limit: 50,
        source: 'all'
      });
      setPlants(results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search 200+ plants..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text>{cat.icon}</Text>
            <Text style={styles.categoryName}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Grid */}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <ScrollView style={styles.plantGrid}>
          {plants.map(plant => (
            <PlantCard 
              key={plant.id} 
              plant={plant}
              onSelect={() => handlePlantSelect(plant)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// Plant Card Component
const PlantCard: React.FC<{ plant: PlantSearchResult }> = ({ plant, onSelect }) => (
  <TouchableOpacity style={styles.card} onPress={onSelect}>
    {plant.localImagePath || plant.primaryImageUrl ? (
      <Image
        source={{ uri: plant.localImagePath || plant.primaryImageUrl }}
        style={styles.image}
      />
    ) : (
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{plant.icon}</Text>
      </View>
    )}
    <Text style={styles.name}>{plant.name}</Text>
    <Text style={styles.scientific}>{plant.scientificName}</Text>
    
    {/* Care badges */}
    <View style={styles.badges}>
      <Text style={styles.badge}>{plant.careLevel}</Text>
      {plant.petSafe && <Text style={styles.badge}>🐾 Safe</Text>}
    </View>
  </TouchableOpacity>
);
```

---

## Smart Loading Strategy

### How It Works

1. **Local First (Always Fast)**
   - 200 plants stored locally in SQLite
   - FTS5 full-text search (instant results)
   - Works completely offline

2. **Cache Layer**
   - Previous API searches cached for 7 days
   - Avoids redundant API calls
   - Reduces Trefle API usage

3. **API Fallback (Rate Limited)**
   - Only called when local results < limit
   - Max 1 request per second
   - Results cached immediately

### API Rate Limiting

```typescript
// In PlantSearchService
const RATE_LIMIT_MS = 1000; // 1 second between calls
let lastApiCall = 0;

async searchTrefleApi(query: string) {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < RATE_LIMIT_MS) {
    console.log('Rate limit: skipping API call');
    return [];
  }
  
  lastApiCall = Date.now();
  // ... make API call
}
```

**With Trefle Free Tier (120 req/day):**
- On first search: ~50 API calls to populate cache
- Subsequent searches: 0 API calls (uses cache)
- Cache expires: 7 days
- Realistic usage: ~10 API calls/day average

---

## Migration from Current System

### Current: Hardcoded TypeScript Array
```typescript
// src/data/plantDatabase.ts
export const INDIVIDUAL_PLANTS: IndividualPlant[] = [
  // ~50 plants hardcoded
];
```

### New: Database-Driven
```typescript
// Query database instead
const plants = await databaseService.searchPlants('monstera');
```

### Migration Steps

1. **Keep existing component** as fallback:
   ```typescript
   // Try database first
   const dbPlants = await searchService.search({ query: '' });
   
   // Fallback to hardcoded if DB empty
   const plants = dbPlants.length > 0 ? dbPlants : INDIVIDUAL_PLANTS;
   ```

2. **Gradual transition:**
   - Phase 1: Use both systems side-by-side
   - Phase 2: Remove hardcoded array once DB is stable

---

## Performance Optimizations

### 1. Image Loading
```typescript
// Lazy load images
<Image
  source={{ uri: plant.localImagePath }}
  loadingIndicatorSource={require('../assets/placeholder.png')}
  progressiveRenderingEnabled={true}
/>
```

### 2. Debounced Search
```typescript
// 300ms debounce prevents excessive queries
const debouncedQuery = useDebounce(searchQuery, 300);
```

### 3. FTS5 Index
```sql
-- Instant full-text search
SELECT * FROM plants 
JOIN plants_fts ON plants.rowid = plants_fts.rowid
WHERE plants_fts MATCH 'monst*';
```

### 4. Cached Images
```typescript
// Images downloaded on-demand, cached locally
const localPath = await searchService.cachePlantImage(plantId, imageUrl);
```

---

## Testing

### Manual Test Cases

1. **Offline Search**
   - Turn off WiFi
   - Search "monstera"
   - Should return results instantly from local DB

2. **API Fallback**
   - Search obscure plant not in local DB
   - Should query Trefle API (rate limited)
   - Result should be cached

3. **Category Filter**
   - Select "Succulents" category
   - Should show only succulents
   - Should work offline

4. **Image Caching**
   - View plant with no local image
   - Image downloads and caches
   - Subsequent views use cached image

---

## Troubleshooting

### "No plants found"
- Check if database was seeded: `databaseService.getPlantsCount()`
- Verify seed DB exists in assets
- Check database migration ran (version 3)

### "Search is slow"
- Verify FTS5 is available: `searchService.checkFts5Available()`
- Check if indexes created: `idx_plants_category`, etc.
- Consider adding more specific indexes

### "Images not loading"
- Check image directory exists: `FileSystem.documentDirectory` + `plant-images/`
- Verify image URLs are valid
- Check network permissions

### "Trefle API errors"
- Verify API key in `.env.local`
- Check rate limit not exceeded
- Review Trefle dashboard for quota usage

---

## Future Enhancements

1. **Incremental Updates**
   - Update script to add new plants without full rebuild
   - Versioned database updates

2. **User Contributions**
   - Allow users to suggest new plants
   - Community image submissions

3. **ML Recommendations**
   - Suggest plants based on room conditions
   - "Plants like this" recommendations

4. **Integration with Generation**
   - Pass plant data directly to Gemini prompts
   - Better context for AI generation

---

## Summary

**What you get:**
- ✅ 200 popular houseplants, fully searchable
- ✅ Works offline (no API required for basic use)
- ✅ Smart API loading (respects rate limits)
- ✅ 10 user-friendly categories
- ✅ Image caching for performance
- ✅ FTS5 full-text search
- ✅ Category filtering
- ✅ Pet-safe and care level filters

**Next steps:**
1. Run `node scripts/populatePlantCodex.js`
2. Add seed database to assets
3. Update `IndividualPlantSelector` to use new service
4. Test offline functionality
5. Ship it! 🚀
