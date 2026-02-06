# Plant Codex Custom Category Taxonomy

## Overview

We've designed a user-friendly category system that groups plants by their **visual characteristics and care patterns** rather than strict botanical taxonomy. This makes it easier for users to browse and find plants that match their aesthetic preferences and care abilities.

## Categories (10 Total)

### 1. **Tropical** 🌿
**What:** Lush, leafy plants from tropical regions  
**Vibe:** Jungle feel, dramatic foliage, statement pieces  
**Examples:**
- Monstera Deliciosa
- Fiddle Leaf Fig (Ficus lyrata)
- Bird of Paradise (Strelitzia)
- Rubber Plant (Ficus elastica)
- Calatheas

**Why grouped together:** These plants share similar care needs (humidity, indirect light) and create a lush, tropical aesthetic perfect for modern interiors.

---

### 2. **Succulents** 🌵
**What:** Fleshy, water-storing plants (excluding cacti)  
**Vibe:** Modern, minimalist, geometric shapes  
**Examples:**
- Echeveria varieties
- Haworthia (Zebra Plant)
- Aloe Vera
- Jade Plant (Crassula)
- String of Pearls (Senecio)

**Why grouped together:** Low water needs, compact growth, sculptural forms. Perfect for busy people or forgetful waterers.

---

### 3. **Cacti** 🌵
**What:** Spiny, drought-tolerant succulents  
**Vibe:** Desert aesthetic, architectural, sculptural  
**Examples:**
- Golden Barrel Cactus
- Bunny Ears (Opuntia)
- Christmas Cactus (Schlumbergera)
- Old Man Cactus
- Star Cactus (Astrophytum)

**Why separate from succulents:** Cacti have distinct care (less water, more sun) and aesthetic. Users specifically looking for "cactus" want spines!

---

### 4. **Palms** 🌴
**What:** Palm family plants with feathery or fan fronds  
**Vibe:** Vacation vibes, resort style, airy elegance  
**Examples:**
- Parlor Palm (Chamaedorea)
- Kentia Palm (Howea)
- Areca Palm (Dypsis)
- Lady Palm (Rhapis)
- Majesty Palm

**Why grouped together:** Distinct tropical aesthetic with specific growth habits (single trunk, arching fronds). Different care than broad-leaf tropicals.

---

### 5. **Ferns** 🌿
**What:** Ancient plants with delicate, divided fronds  
**Vibe:** Soft, romantic, vintage charm, forest floor  
**Examples:**
- Boston Fern (Nephrolepis)
- Maidenhair Fern (Adiantum)
- Bird's Nest Fern (Asplenium)
- Staghorn Fern (Platycerium)
- Rabbit's Foot Fern (Davallia)

**Why grouped together:** High humidity needs, no flowers, propagate via spores. Create a completely different vibe than flowering plants.

---

### 6. **Vines** 🌿
**What:** Trailing or climbing plants  
**Vibe:** Cascading, wild, perfect for shelves/hanging  
**Examples:**
- Pothos (Epipremnum)
- Philodendron varieties
- Monstera Adansonii (Swiss Cheese)
- String of Hearts (Ceropegia)
- Hoya varieties

**Why grouped together:** Growth habit matters! These plants need vertical space or hanging planters. Perfect for small spaces.

---

### 7. **Flowering** 🌸
**What:** Plants grown primarily for blooms  
**Vibe:** Colorful, cheerful, seasonal interest  
**Examples:**
- African Violets (Saintpaulia)
- Peace Lily (Spathiphyllum)
- Hibiscus
- Anthurium
- Orchids (when added)

**Why grouped together:** Users specifically want flowers! These often have different light needs (brighter) and care schedules.

---

### 8. **Herbs** 🌱
**What:** Edible aromatic plants  
**Vibe:** Functional, kitchen-friendly, fresh scents  
**Examples:**
- Basil (Ocimum)
- Mint (Mentha)
- Rosemary
- Thyme
- Parsley

**Why grouped together:** Kitchen utility, edible, fragrant. Users want these for cooking, not just decoration.

---

### 9. **Trees** 🌳
**What:** Woody plants that grow tall with single/multiple trunks  
**Vibe:** Indoor trees, architectural statements, room dividers  
**Examples:**
- Fiddle Leaf Fig
- Rubber Plant
- Money Tree (Pachira)
- Olive Tree
- Citrus trees

**Why grouped together:** Size category! These are statement floor plants that grow tall. Different placement and pot needs.

---

### 10. **Unknown** 🌱
**What:** Uncategorized plants (fallback)  
**Vibe:** Various  
**When used:** When we can't determine a clear category from available data.

---

## Why This System?

### Instead of Scientific Taxonomy:
**Botanical Families** → Too technical for most users
- "Araceae family" (includes Monsteras, Philodendrons, Peace Lilies)
- Users don't search for "Araceae"!

### Our User-Friendly Approach:
**Visual/Functional Groups** → Intuitive browsing
- "Tropical" = lush, leafy jungle vibe
- "Vines" = trailing growth habit
- "Flowering" = I want blooms!

---

## Search Behavior Examples

| User Thinks... | Searches For... | Finds In Category... |
|----------------|-----------------|---------------------|
| "I want a desert vibe" | "cactus" | Cacti |
| "Something that hangs down" | "hanging plant" | Vines |
| "Big statement piece" | "indoor tree" | Trees or Palms |
| "Colorful flowers" | "flowering houseplant" | Flowering |
| "Easy care" | "succulent" or "snake plant" | Succulents |
| "Beach house feel" | "palm" | Palms |

---

## Implementation Notes

### In the Database:
```sql
plants.category = 'tropical' | 'succulent' | 'cactus' | 'palm' | 
                  'fern' | 'vine' | 'flowering' | 'herb' | 'tree'
```

### In the Node Script:
The `CATEGORY_MAP` in `populatePlantCodex.js` maps genus names to these categories:
```javascript
const CATEGORY_MAP = {
  'Monstera': 'tropical',
  'Echeveria': 'succulent',
  'Opuntia': 'cactus',
  'Dypsis': 'palm',
  // ... etc
};
```

### Icons:
Each category has a consistent emoji:
```javascript
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
};
```

---

## Future Enhancements

1. **Subcategories:** 
   - Flowering → African Violets, Orchids, Begonias
   - Succulents → Echeverias, Haworthias, Sedums

2. **Care-Based Tags:**
   - "Low Light" (overlaps categories)
   - "Pet Safe" (cross-category filter)
   - "Air Purifying"

3. **Seasonal Collections:**
   - "Holiday Plants" (Christmas cactus, Poinsettia)
   - "Spring Bloomers"

4. **Room-Based Suggestions:**
   - "Bathroom Plants" (ferns, high humidity)
   - "Bedroom Plants" (peace lilies, snake plants)

---

## Maintenance

When adding new plants via the node script, the category is automatically determined by:
1. Checking `CATEGORY_MAP` for genus match
2. Falling back to family-based detection
3. Defaulting to "tropical"

To add new category mappings, update the `CATEGORY_MAP` in `scripts/populatePlantCodex.js`.
