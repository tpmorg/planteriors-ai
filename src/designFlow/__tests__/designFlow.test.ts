import {
  applyPhotoRevision,
  buildGenerationRequest,
  createDesignDraft,
  getDefaultPlantSize,
  pruneRecoverableResults,
  restyleFromLabels,
  restyleLabels,
  restylePlanToDesignPlants,
  selectPlant,
  shouldResumeAfterPurchase,
} from '../designFlow';

const TEST_PLANT = {
  id: 'test-plant',
  name: 'Test Plant',
  scientificName: 'Planta testii',
  description: 'A test plant',
  icon: 'Leaf',
  category: 'tropical' as const,
  lightRequirement: 'bright-indirect' as const,
  waterRequirement: 'moderate' as const,
  availableSizes: ['medium', 'large'] as const,
  suitablePlacements: ['floor'] as const,
  careLevel: 'easy' as const,
  growthRate: 'moderate' as const,
  petSafe: false,
};

describe('design flow request adapter', () => {
  it('sends the default Restyle style choice with display labels', () => {
    const draft = createDesignDraft('user-1');
    const request = buildGenerationRequest({
      ...draft,
      intent: 'restyle',
      photo: { originalUri: 'file:///room.jpg', preparedUri: 'file:///prepared.jpg', revision: 1 },
    });

    expect(request.mode).toBe('multi-plant');
    expect(request.restyle).toEqual({ styleId: 'japandi', amount: 'restrained' });
    expect(request.plantType?.name).toBe('Japandi');
    expect(request.plantStyle?.name).toBe('Restrained');
    expect(request.plantOptions).toBeUndefined();
  });

  it('round-trips a saved Restyle design back to its style choice', () => {
    const { plantType, plantStyle } = restyleLabels({ styleId: 'mid-century', amount: 'generous' });
    expect(restyleFromLabels(plantType.name, plantStyle.name)).toEqual({ styleId: 'mid-century', amount: 'generous' });
    expect(restyleFromLabels('Tropical', 'Contemporary')).toBeNull();
  });

  it('turns a Restyle plan into design plants with library care and light', () => {
    const [plant] = restylePlanToDesignPlants({
      styleId: 'japandi', styleName: 'Japandi', amount: 'restrained', rationale: 'Calm corner.',
      plants: [{ speciesId: 'snake-plant', name: 'Snake Plant', scientificName: 'Sansevieria trifasciata', role: 'supporting', size: 'medium', placement: 'surface', position: 'on the side table', vessel: 'charcoal cylinder' }],
    });
    expect(plant).toMatchObject({ commonName: 'Snake Plant', placement: 'table', careLevel: 'easy', lightRequirement: 'low-to-bright' });
  });

  it('requires a current-photo target for Replace', () => {
    const plant = selectPlant({ ...TEST_PLANT, availableSizes: [...TEST_PLANT.availableSizes], suitablePlacements: [...TEST_PLANT.suitablePlacements] });
    const draft = {
      ...createDesignDraft('user-1'),
      intent: 'replace' as const,
      individualPlant: plant,
      photo: { originalUri: 'file:///room.jpg', preparedUri: 'file:///prepared.jpg', revision: 2 },
      location: { x: 0.2, y: 0.2, width: 0.3, height: 0.4 },
      locationPhotoRevision: 1,
    };

    expect(() => buildGenerationRequest(draft)).toThrow('Mark the plant');
    expect(buildGenerationRequest({ ...draft, locationPhotoRevision: 2 }).mode).toBe('replace-plant');
  });

  it('invalidates placement coordinates when the photo revision changes', () => {
    const draft = {
      ...createDesignDraft('user-1'),
      location: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      locationPhotoRevision: 1,
    };
    const updated = applyPhotoRevision(draft, {
      originalUri: 'file:///other.jpg',
      preparedUri: 'file:///other-prepared.jpg',
      revision: 2,
    });

    expect(updated.location).toBeUndefined();
    expect(updated.locationPhotoRevision).toBeUndefined();
  });

  it('uses medium when supported and explicit size priority otherwise', () => {
    expect(getDefaultPlantSize(['large', 'medium'])).toBe('medium');
    expect(getDefaultPlantSize(['large', 'small'])).toBe('small');
  });

  it('does not submit stale Restyle fields for Add', () => {
    const selection = selectPlant({ ...TEST_PLANT, availableSizes: [...TEST_PLANT.availableSizes], suitablePlacements: [...TEST_PLANT.suitablePlacements] });
    const request = buildGenerationRequest({
      ...createDesignDraft('user-1'),
      intent: 'add',
      individualPlant: selection,
      photo: { originalUri: 'file:///room.jpg', preparedUri: 'file:///prepared.jpg', revision: 1 },
    });
    expect(request.mode).toBe('individual');
    expect(request.plantType).toBeUndefined();
    expect(request.plantOptions).toBeUndefined();
  });

  it('keeps only the newest three recovery results within seven days', () => {
    const now = 1_800_000_000_000;
    const results = [0, 1, 2, 3, 4].map((index) => ({
      requestId: `request-${index}`,
      imageUri: `file:///result-${index}.jpg`,
      createdAt: index === 0 ? now - 8 * 24 * 60 * 60 * 1000 : now - index * 1000,
    }));
    expect(pruneRecoverableResults(results, now).map((result) => result.requestId)).toEqual([
      'request-3', 'request-2', 'request-1',
    ]);
  });

  it('resumes only for a purchase event newer than the pending-flow baseline', () => {
    const pendingDraft = {
      resumeAfterPurchase: true,
      purchaseEventBaselineId: 3,
    };

    expect(shouldResumeAfterPurchase(pendingDraft, {
      id: 4,
      kind: 'room_pack',
      productId: 'room-pack-5',
      completedAt: 1_800_000_000_000,
    })).toBe(true);
    expect(shouldResumeAfterPurchase(pendingDraft, {
      id: 3,
      kind: 'monthly',
      completedAt: 1_800_000_000_000,
    })).toBe(false);
    expect(shouldResumeAfterPurchase({ ...pendingDraft, resumeAfterPurchase: false }, {
      id: 4,
      kind: 'monthly',
      completedAt: 1_800_000_000_000,
    })).toBe(false);
    expect(shouldResumeAfterPurchase(pendingDraft, null)).toBe(false);
  });
});
