import type {
  DesignFlowDraft,
  DesignPhotoAsset,
  DesignFlowEntryPoint,
  DesignIntent,
  GenerationRequest,
  IndividualPlant,
  IndividualPlantSelection,
  PurchaseCompletionEvent,
  PlantStyle,
  PlantType,
  PlantSearchResult,
  PlantSize,
  IdentifiedDesignPlant,
  RestyleAmount,
  RestyleChoice,
  RestylePlan,
  RestyleStyleId,
} from '../types';
import { getPlantById } from '../data/plantDatabase';

// Restyle styles are design recipes defined on the server (planterior-ai-web lib/ai/restyle);
// the app only needs their ids and copy.
export const RESTYLE_STYLES: Array<{ id: RestyleStyleId; name: string; tagline: string }> = [
  { id: 'japandi', name: 'Japandi', tagline: 'Calm, sparse, sculptural. One plant carries the room.' },
  { id: 'mid-century', name: 'Mid-century', tagline: 'Bold leaves as sculpture, lifted on legs, warm wood and glaze.' },
];

export const RESTYLE_AMOUNTS: Array<{ id: RestyleAmount; name: string; description: string }> = [
  { id: 'restrained', name: 'Restrained', description: 'A few well-placed plants' },
  { id: 'generous', name: 'Generous', description: 'More green, same design sense' },
];

export const DEFAULT_RESTYLE: RestyleChoice = { styleId: 'japandi', amount: 'restrained' };

// Saved designs, the gallery, and sync label multi-plant designs by plantType/plantStyle names,
// so Restyle fills those with the style and amount instead of changing the saved schema.
export function restyleLabels(choice: RestyleChoice): { plantType: PlantType; plantStyle: PlantStyle } {
  const style = RESTYLE_STYLES.find((value) => value.id === choice.styleId) || RESTYLE_STYLES[0];
  const amount = RESTYLE_AMOUNTS.find((value) => value.id === choice.amount) || RESTYLE_AMOUNTS[0];
  const plantStyle = { id: amount.id, name: amount.name, description: amount.description, icon: 'Leaf' };
  return { plantType: { id: style.id, name: style.name, description: style.tagline, icon: 'Plant', styles: [plantStyle] }, plantStyle };
}

// Recovers the Restyle choice behind a saved design's labels, or null for older designs.
export function restyleFromLabels(plantTypeName?: string, plantStyleName?: string): RestyleChoice | null {
  const style = RESTYLE_STYLES.find((value) => value.name === plantTypeName);
  const amount = RESTYLE_AMOUNTS.find((value) => value.name === plantStyleName);
  return style && amount ? { styleId: style.id, amount: amount.id } : null;
}

// Planned plants become the design's plant list right away, with care and light from the library.
export function restylePlanToDesignPlants(plan: RestylePlan): IdentifiedDesignPlant[] {
  return plan.plants.map((plant) => {
    const libraryPlant = getPlantById(plant.speciesId);
    return {
      commonName: plant.name,
      scientificName: plant.scientificName,
      confidence: 1,
      placement: plant.placement === 'surface' ? 'table' : plant.placement === 'raised' ? 'floor' : plant.placement,
      visibleCount: 1,
      careLevel: libraryPlant?.careLevel || 'moderate',
      lightRequirement: libraryPlant?.lightRequirement || 'bright-indirect',
      notes: `${plant.position}. ${plant.vessel}.`,
    };
  });
}

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
  return {
    id: `design-${now}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    entryPoint,
    step: 'photo',
    restyle: DEFAULT_RESTYLE,
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
    // Drafts persisted before style-led Restyle have no choice yet and take the default.
    const restyle = draft.restyle || DEFAULT_RESTYLE;
    return {
      imageUri: draft.refinementSourceUri || draft.photo.preparedUri,
      imagePrepared: true,
      originalImageUri: draft.photo.originalUri,
      mode,
      restyle,
      ...restyleLabels(restyle),
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
