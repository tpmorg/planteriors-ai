import type {
  DesignFlowDraft,
  DesignPhotoAsset,
  DesignFlowEntryPoint,
  DesignIntent,
  GenerationRequest,
  IndividualPlant,
  IndividualPlantSelection,
  MaintenanceLevel,
  PlacementDensity,
  PlantOptions,
  PurchaseCompletionEvent,
  PlantStyle,
  PlantType,
  PotColor,
  PotStyle,
  PlantSearchResult,
  PlantSize,
} from '../types';

export const PLANT_TYPES: PlantType[] = [
  {
    id: 'succulents', name: 'Succulents', description: 'Low-maintenance, water-storing plants', icon: 'Cactus',
    styles: [
      { id: 'modern', name: 'Modern', description: 'Clean, geometric arrangements', icon: 'Lightning' },
      { id: 'rustic', name: 'Rustic', description: 'Natural, organic feel', icon: 'Tree' },
      { id: 'minimalist', name: 'Minimalist', description: 'Simple, elegant displays', icon: 'Circle' },
    ],
  },
  {
    id: 'tropical', name: 'Tropical', description: 'Lush, green foliage plants', icon: 'Leaf',
    styles: [
      { id: 'jungle', name: 'Jungle', description: 'Dense, wild arrangements', icon: 'Tree' },
      { id: 'contemporary', name: 'Contemporary', description: 'Stylish, curated look', icon: 'StarFour' },
      { id: 'bohemian', name: 'Bohemian', description: 'Eclectic, artistic vibe', icon: 'PaintBrush' },
    ],
  },
  {
    id: 'flowering', name: 'Flowering', description: 'Colorful blooms and flowers', icon: 'Flower',
    styles: [
      { id: 'cottage', name: 'Cottage', description: 'Charming, homey feel', icon: 'House' },
      { id: 'elegant', name: 'Elegant', description: 'Sophisticated arrangements', icon: 'Crown' },
      { id: 'vibrant', name: 'Vibrant', description: 'Bold, colorful displays', icon: 'Palette' },
    ],
  },
  {
    id: 'hanging', name: 'Hanging', description: 'Trailing and cascading plants', icon: 'Plant',
    styles: [
      { id: 'cascading', name: 'Cascading', description: 'Flowing, waterfall effect', icon: 'Drop' },
      { id: 'structured', name: 'Structured', description: 'Organized, planned layout', icon: 'Ruler' },
      { id: 'natural', name: 'Natural', description: 'Organic, free-flowing', icon: 'Leaf' },
    ],
  },
];

export const POT_STYLES: PotStyle[] = [
  { id: 'ceramic', name: 'Ceramic', icon: 'PottedPlant' },
  { id: 'terracotta', name: 'Terracotta', icon: 'CookingPot' },
  { id: 'modern', name: 'Modern', icon: 'Square' },
  { id: 'woven', name: 'Woven', icon: 'Basket' },
  { id: 'concrete', name: 'Concrete', icon: 'Cube' },
];

export const POT_COLORS: PotColor[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF' },
  { id: 'black', name: 'Black', hex: '#2D2D2D' },
  { id: 'terracotta', name: 'Terracotta', hex: '#C45C3E' },
  { id: 'sage', name: 'Sage', hex: '#9CAF88' },
  { id: 'navy', name: 'Navy', hex: '#1E3A5F' },
  { id: 'cream', name: 'Cream', hex: '#F5F5DC' },
];

export const MAINTENANCE_LEVELS: MaintenanceLevel[] = [
  { id: 'low', name: 'Low', description: 'Minimal care needed', icon: 'BatteryLow' },
  { id: 'medium', name: 'Medium', description: 'Regular attention', icon: 'BatteryMedium' },
  { id: 'high', name: 'High', description: 'Daily care required', icon: 'BatteryHigh' },
];

export const PLACEMENT_DENSITIES: PlacementDensity[] = [
  { id: 'sparse', name: 'Sparse', description: 'Few accent plants', icon: 'Plant' },
  { id: 'moderate', name: 'Moderate', description: 'Balanced arrangement', icon: 'Leaf' },
  { id: 'lush', name: 'Lush', description: 'Abundant greenery', icon: 'Tree' },
];

export const DEFAULT_RESTYLE_PRESET = {
  plantTypeId: 'tropical',
  plantStyleId: 'contemporary',
  potStyleId: 'ceramic',
  potColorId: 'white',
  maintenanceLevelId: 'low',
  placementDensityId: 'moderate',
} as const;

// Local-only recovery policy: keep the newest three unsaved/saved flow results for seven days.
// These references live in AsyncStorage and are intentionally excluded from Firestore sync.
export const RECOVERABLE_RESULT_LIMIT = 3;
export const RECOVERABLE_RESULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function pruneRecoverableResults(results: DesignFlowDraft['results'], now: number = Date.now()) {
  return results
    .filter((result) => now - result.createdAt <= RECOVERABLE_RESULT_RETENTION_MS)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-RECOVERABLE_RESULT_LIMIT);
}

export function shouldResumeAfterPurchase(
  draft: Pick<DesignFlowDraft, 'resumeAfterPurchase' | 'purchaseEventBaselineId'>,
  purchaseCompletion: PurchaseCompletionEvent | null
): boolean {
  return Boolean(
    draft.resumeAfterPurchase
      && purchaseCompletion
      && purchaseCompletion.id > (draft.purchaseEventBaselineId || 0)
  );
}

export function createDesignDraft(ownerId: string, entryPoint: DesignFlowEntryPoint = 'new-design'): DesignFlowDraft {
  const now = Date.now();
  const plantType = PLANT_TYPES.find((value) => value.id === DEFAULT_RESTYLE_PRESET.plantTypeId)!;
  const plantStyle = plantType.styles.find((value) => value.id === DEFAULT_RESTYLE_PRESET.plantStyleId)!;
  return {
    id: `design-${now}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    entryPoint,
    step: 'photo',
    plantType,
    plantStyle,
    plantOptions: {
      potStyle: POT_STYLES.find((value) => value.id === DEFAULT_RESTYLE_PRESET.potStyleId)!,
      potColor: POT_COLORS.find((value) => value.id === DEFAULT_RESTYLE_PRESET.potColorId)!,
      usePlanterBox: false,
      maintenanceLevel: MAINTENANCE_LEVELS.find((value) => value.id === DEFAULT_RESTYLE_PRESET.maintenanceLevelId)!,
      placementDensity: PLACEMENT_DENSITIES.find((value) => value.id === DEFAULT_RESTYLE_PRESET.placementDensityId)!,
    },
    requestStatus: 'idle',
    results: [],
  };
}

export function applyPhotoRevision(draft: DesignFlowDraft, photo: DesignPhotoAsset): DesignFlowDraft {
  return {
    ...draft,
    photo,
    location: undefined,
    locationPhotoRevision: undefined,
    refinementSourceUri: undefined,
    updatedAt: Date.now(),
  };
}

export function intentToMode(intent: DesignIntent): GenerationRequest['mode'] {
  if (intent === 'restyle') return 'multi-plant';
  if (intent === 'replace') return 'replace-plant';
  return 'individual';
}

export function getDefaultPlantSize(sizes: PlantSize[]): PlantSize {
  if (sizes.includes('medium')) return 'medium';
  return (['small', 'medium', 'large'] as PlantSize[]).find((size) => sizes.includes(size)) || 'medium';
}

export function toIndividualPlant(plant: PlantSearchResult): IndividualPlant | null {
  const availableSizes = plant.availableSizes?.filter((size): size is PlantSize =>
    size === 'small' || size === 'medium' || size === 'large'
  );
  const placements = plant.suitablePlacements?.filter((value) =>
    value === 'floor' || value === 'shelf' || value === 'hanging' || value === 'auto'
  );
  const validCategory = ['tropical', 'succulent', 'flowering', 'fern', 'palm', 'vine'].includes(plant.category);
  const validLight = ['low', 'low-to-bright', 'bright-indirect', 'bright-direct'].includes(plant.lightRequirement);
  const validWater = ['low', 'moderate', 'high'].includes(plant.waterRequirement || '');
  const validCare = ['easy', 'moderate', 'difficult'].includes(plant.careLevel);
  if (!plant.id || !plant.name || !plant.scientificName || !plant.description || !availableSizes?.length || !placements?.length || !validCategory || !validLight || !validWater || !validCare) {
    return null;
  }
  return {
    id: plant.id,
    name: plant.name,
    scientificName: plant.scientificName,
    description: plant.description,
    icon: plant.icon || 'Leaf',
    category: plant.category as IndividualPlant['category'],
    lightRequirement: plant.lightRequirement as IndividualPlant['lightRequirement'],
    waterRequirement: plant.waterRequirement as IndividualPlant['waterRequirement'],
    availableSizes,
    suitablePlacements: placements,
    careLevel: plant.careLevel as IndividualPlant['careLevel'],
    petSafe: plant.petSafe,
  };
}

export function selectPlant(plant: IndividualPlant): IndividualPlantSelection {
  return { plant, size: getDefaultPlantSize(plant.availableSizes), placement: 'auto' };
}

export function buildGenerationRequest(draft: DesignFlowDraft): GenerationRequest {
  if (!draft.photo?.preparedUri) throw new Error('Choose a room photo before generating.');
  if (!draft.intent) throw new Error('Choose what you want to do before generating.');
  const mode = intentToMode(draft.intent);
  if (mode === 'multi-plant') {
    if (!draft.plantType || !draft.plantStyle || !draft.plantOptions) {
      throw new Error('The Restyle setup is incomplete.');
    }
    return {
      imageUri: draft.refinementSourceUri || draft.photo.preparedUri,
      imagePrepared: true,
      originalImageUri: draft.photo.originalUri,
      mode,
      plantType: draft.plantType,
      plantStyle: draft.plantStyle,
      plantOptions: draft.plantOptions,
      prompt: draft.prompt?.trim() || undefined,
    };
  }
  if (!draft.individualPlant) throw new Error('Choose a plant before generating.');
  if (!draft.individualPlant.plant.availableSizes.includes(draft.individualPlant.size)) {
    throw new Error('The selected plant does not support that size.');
  }
  if (mode === 'replace-plant' && (!draft.location || draft.locationPhotoRevision !== draft.photo.revision)) {
    throw new Error('Mark the plant you want to replace before generating.');
  }
  return {
    imageUri: draft.refinementSourceUri || draft.photo.preparedUri,
    imagePrepared: true,
    originalImageUri: draft.photo.originalUri,
    mode,
    individualPlant: draft.individualPlant,
    individualPlantId: draft.individualPlant.plant.id,
    location: draft.location,
    prompt: draft.prompt?.trim() || undefined,
  };
}
