import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';

import { applyPhotoRevision, createDesignDraft, pruneRecoverableResults } from '../designFlow/designFlow';
import type {
  DesignFlowDraft,
  DesignFlowEntryPoint,
  DesignFlowStep,
  DesignIntent,
  IndividualPlantSelection,
  PlantLocation,
} from '../types';
import { compressImageForAI } from '../utils/imageUtils';

const STORAGE_PREFIX = '@planterior/design-draft/v1/';

type DraftPatch = Partial<Omit<DesignFlowDraft, 'id' | 'ownerId' | 'schemaVersion' | 'createdAt'>>;

interface DesignFlowContextValue {
  draft: DesignFlowDraft;
  isRestoring: boolean;
  updateDraft: (patch: DraftPatch) => void;
  setStep: (step: DesignFlowStep) => void;
  setIntent: (intent: DesignIntent) => void;
  setPlant: (selection: IndividualPlantSelection) => void;
  setLocation: (location?: PlantLocation) => void;
  setPhoto: (uri: string) => Promise<void>;
  resetDraft: (entryPoint?: DesignFlowEntryPoint) => void;
}

const DesignFlowContext = createContext<DesignFlowContextValue | null>(null);

function getImageSize(uri: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve({}));
  });
}

export function DesignFlowProvider({ ownerId, children }: { ownerId: string; children: React.ReactNode }) {
  const [draft, setDraft] = useState(() => createDesignDraft(ownerId));
  const [isRestoring, setIsRestoring] = useState(true);
  const storageKey = `${STORAGE_PREFIX}${ownerId}`;

  useEffect(() => {
    let mounted = true;
    setIsRestoring(true);
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (!mounted) return;
        if (!value) {
          setDraft(createDesignDraft(ownerId));
          return;
        }
        const restored = JSON.parse(value) as DesignFlowDraft;
        if (restored.ownerId === ownerId && restored.schemaVersion === 1) {
          const recovered = { ...restored, results: pruneRecoverableResults(restored.results || []) };
          setDraft(recovered.step === 'generating'
            ? { ...recovered, step: 'recoverable-error', requestStatus: 'unknown', updatedAt: Date.now() }
            : recovered);
        } else {
          setDraft(createDesignDraft(ownerId));
        }
      })
      .catch((error) => {
        console.warn('Failed to restore design draft:', error);
        if (mounted) setDraft(createDesignDraft(ownerId));
      })
      .finally(() => {
        if (mounted) setIsRestoring(false);
      });
    return () => { mounted = false; };
  }, [ownerId, storageKey]);

  useEffect(() => {
    if (isRestoring || draft.ownerId !== ownerId) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(draft)).catch((error) => {
      console.warn('Failed to persist design draft:', error);
    });
  }, [draft, isRestoring, ownerId, storageKey]);

  const updateDraft = useCallback((patch: DraftPatch) => {
    setDraft((current) => ({ ...current, ...patch, updatedAt: Date.now() }));
  }, []);

  const setStep = useCallback((step: DesignFlowStep) => updateDraft({ step }), [updateDraft]);

  const setIntent = useCallback((intent: DesignIntent) => {
    setDraft((current) => ({
      ...current,
      intent,
      step: intent === 'restyle' ? 'ready' : intent === 'replace' ? 'target' : 'plant',
      individualPlant: intent === 'restyle' ? undefined : current.individualPlant,
      location: undefined,
      locationPhotoRevision: undefined,
      refinementSourceUri: undefined,
      updatedAt: Date.now(),
    }));
  }, []);

  const setPlant = useCallback((individualPlant: IndividualPlantSelection) => {
    updateDraft({ individualPlant, step: 'ready' });
  }, [updateDraft]);

  const setLocation = useCallback((location?: PlantLocation) => {
    setDraft((current) => ({
      ...current,
      location,
      locationPhotoRevision: location ? current.photo?.revision : undefined,
      updatedAt: Date.now(),
    }));
  }, []);

  const setPhoto = useCallback(async (uri: string) => {
    const [preparedUri, dimensions] = await Promise.all([
      compressImageForAI(uri),
      getImageSize(uri),
    ]);
    setDraft((current) => {
      const revision = (current.photo?.revision || 0) + 1;
      const orientation = dimensions.width && dimensions.height
        ? dimensions.width === dimensions.height ? 'square' : dimensions.width > dimensions.height ? 'landscape' : 'portrait'
        : undefined;
      return {
        ...applyPhotoRevision(current, { originalUri: uri, preparedUri, revision, ...dimensions, orientation }),
        step: current.individualPlant && current.entryPoint === 'plant-detail' ? 'ready' : 'intent',
        updatedAt: Date.now(),
      };
    });
  }, []);

  const resetDraft = useCallback((entryPoint: DesignFlowEntryPoint = 'new-design') => {
    setDraft(createDesignDraft(ownerId, entryPoint));
  }, [ownerId]);

  const value = useMemo(() => ({
    draft, isRestoring, updateDraft, setStep, setIntent, setPlant, setLocation, setPhoto, resetDraft,
  }), [draft, isRestoring, resetDraft, setIntent, setLocation, setPhoto, setPlant, setStep, updateDraft]);

  return <DesignFlowContext.Provider value={value}>{children}</DesignFlowContext.Provider>;
}

export function useDesignFlow() {
  const value = useContext(DesignFlowContext);
  if (!value) throw new Error('useDesignFlow must be used inside DesignFlowProvider');
  return value;
}
