import { databaseService } from './databaseService';
import { aiApiService } from './aiApiService';
import {
  CareLevel,
  IdentifiedDesignPlant,
  LightRequirement,
  PlacementType,
  PlantCategoryType,
  PlantIdentificationResult,
  PlantSize,
  WaterRequirement,
} from '../types';

type IdentificationPayload = {
  commonName: string;
  scientificName: string;
  confidence: number;
  description: string;
  category: string;
  careLevel: string;
  lightRequirement: string;
  waterRequirement: string;
  petSafe: boolean;
  availableSizes: string[];
  suitablePlacements: string[];
  healthAssessment?: string;
  careTips: string[];
};

type DesignPlantPayload = {
  plants: Array<{
    commonName: string;
    scientificName?: string;
    confidence: number;
    placement: string;
    visibleCount: number;
    careLevel: string;
    lightRequirement: string;
    notes: string;
  }>;
};

export class PlantIdentificationService {
  async identifyPlantFromImage(imageUri: string): Promise<PlantIdentificationResult> {
    return this.normalize(await aiApiService.identifyPlant(imageUri));
  }

  async identifyPlantsInGeneratedDesign(imageUri: string): Promise<IdentifiedDesignPlant[]> {
    return this.normalizeDesignPlants({ plants: await aiApiService.identifyDesignPlants(imageUri) });
  }

  async saveIdentificationToPlantDb(
    result: PlantIdentificationResult,
    sourceImageUri?: string
  ): Promise<string> {
    const plantId = this.toPlantId(result.scientificName);

    await databaseService.savePlant({
      id: plantId,
      name: result.commonName,
      scientificName: result.scientificName,
      description: result.description,
      category: result.category,
      icon: 'Leaf',
      careLevel: result.careLevel,
      lightRequirement: result.lightRequirement,
      waterRequirement: result.waterRequirement,
      petSafe: result.petSafe,
      availableSizes: result.availableSizes,
      suitablePlacements: result.suitablePlacements,
      isPopular: false,
      userAdded: true,
    });

    if (sourceImageUri) {
      await databaseService.savePlantImage(plantId, {
        imageUrl: sourceImageUri,
        localPath: sourceImageUri.startsWith('file://') ? sourceImageUri : undefined,
        isPrimary: true,
        source: 'user',
      });
    }

    return plantId;
  }

  private buildPrompt(): string {
    return `Identify the plant in this image and return JSON only.

Return EXACTLY this schema:
{
  "commonName": string,
  "scientificName": string,
  "confidence": number, // 0.0 to 1.0
  "description": string, // concise 1-2 sentence summary
  "category": "tropical" | "succulent" | "flowering" | "fern" | "palm" | "vine",
  "careLevel": "easy" | "moderate" | "difficult",
  "lightRequirement": "low" | "low-to-bright" | "bright-indirect" | "bright-direct",
  "waterRequirement": "low" | "moderate" | "high",
  "petSafe": boolean,
  "availableSizes": ["small" | "medium" | "large"],
  "suitablePlacements": ["floor" | "shelf" | "hanging" | "auto"],
  "healthAssessment": string, // optional note if visible stress/pests/yellowing
  "careTips": string[] // 3-5 practical tips
}

Rules:
- No markdown, no code fences, valid JSON only.
- If uncertain, lower confidence.
- Prefer practical indoor-care guidance.`;
  }

  private buildDesignPlantPrompt(): string {
    return `Identify the likely houseplants visible in this generated interior design image and return JSON only.

Return EXACTLY this schema:
{
  "plants": [
    {
      "commonName": string,
      "scientificName": string,
      "confidence": number,
      "placement": "floor" | "shelf" | "hanging" | "table" | "windowsill" | "counter" | "unknown",
      "visibleCount": number,
      "careLevel": "easy" | "moderate" | "difficult",
      "lightRequirement": "low" | "low-to-bright" | "bright-indirect" | "bright-direct",
      "notes": string
    }
  ]
}

Rules:
- No markdown, no code fences, valid JSON only.
- Return at most 6 distinct plant matches.
- Group repeated plants into one item and set visibleCount.
- Prefer common indoor plant names users can shop for.
- If the image is ambiguous, choose the closest likely match and lower confidence.
- Notes should be one short practical sentence about why this plant fits the design.`;
  }

  private extractTextResponse(response: any): string {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!parts || !Array.isArray(parts)) {
      throw new Error('No candidate response from model');
    }

    const textPart = parts.find((part: any) => typeof part?.text === 'string');
    if (!textPart?.text) {
      throw new Error('No text payload returned from model');
    }

    return textPart.text;
  }

  private extractJson(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return trimmed.slice(start, end + 1);
    }

    return trimmed;
  }

  private normalize(payload: IdentificationPayload): PlantIdentificationResult {
    return {
      commonName: (payload.commonName || 'Unknown Plant').trim(),
      scientificName: (payload.scientificName || 'Unknown species').trim(),
      confidence: this.normalizeConfidence(payload.confidence),
      description: (payload.description || '').trim(),
      category: this.normalizeCategory(payload.category),
      careLevel: this.normalizeCareLevel(payload.careLevel),
      lightRequirement: this.normalizeLight(payload.lightRequirement),
      waterRequirement: this.normalizeWater(payload.waterRequirement),
      petSafe: Boolean(payload.petSafe),
      availableSizes: this.normalizeSizes(payload.availableSizes),
      suitablePlacements: this.normalizePlacements(payload.suitablePlacements),
      healthAssessment: payload.healthAssessment?.trim() || undefined,
      careTips: (payload.careTips || []).map((tip) => tip.trim()).filter(Boolean).slice(0, 5),
    };
  }

  private normalizeDesignPlants(payload: DesignPlantPayload): IdentifiedDesignPlant[] {
    const plants = Array.isArray(payload.plants) ? payload.plants : [];
    return plants
      .map((plant) => ({
        commonName: (plant.commonName || 'Unknown Plant').trim(),
        scientificName: plant.scientificName?.trim() || undefined,
        confidence: this.normalizeConfidence(plant.confidence),
        placement: this.normalizeDesignPlacement(plant.placement),
        visibleCount: this.normalizeVisibleCount(plant.visibleCount),
        careLevel: this.normalizeCareLevel(plant.careLevel),
        lightRequirement: this.normalizeLight(plant.lightRequirement),
        notes: (plant.notes || '').trim(),
      }))
      .filter((plant) => plant.commonName.length > 0)
      .slice(0, 6);
  }

  private normalizeDesignPlacement(value: string): IdentifiedDesignPlant['placement'] {
    const allowed: IdentifiedDesignPlant['placement'][] = [
      'floor',
      'shelf',
      'hanging',
      'table',
      'windowsill',
      'counter',
      'unknown',
    ];
    const candidate = (value || '').toLowerCase() as IdentifiedDesignPlant['placement'];
    return allowed.includes(candidate) ? candidate : 'unknown';
  }

  private normalizeVisibleCount(value: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return 1;
    return Math.max(1, Math.min(20, Math.round(value)));
  }

  private normalizeConfidence(value: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
    return Math.max(0, Math.min(1, value));
  }

  private normalizeCategory(value: string): PlantCategoryType {
    const allowed: PlantCategoryType[] = ['tropical', 'succulent', 'flowering', 'fern', 'palm', 'vine'];
    const candidate = (value || '').toLowerCase() as PlantCategoryType;
    return allowed.includes(candidate) ? candidate : 'tropical';
  }

  private normalizeCareLevel(value: string): CareLevel {
    const allowed: CareLevel[] = ['easy', 'moderate', 'difficult'];
    const candidate = (value || '').toLowerCase() as CareLevel;
    return allowed.includes(candidate) ? candidate : 'moderate';
  }

  private normalizeLight(value: string): LightRequirement {
    const allowed: LightRequirement[] = ['low', 'low-to-bright', 'bright-indirect', 'bright-direct'];
    const candidate = (value || '').toLowerCase() as LightRequirement;
    return allowed.includes(candidate) ? candidate : 'bright-indirect';
  }

  private normalizeWater(value: string): WaterRequirement {
    const allowed: WaterRequirement[] = ['low', 'moderate', 'high'];
    const candidate = (value || '').toLowerCase() as WaterRequirement;
    return allowed.includes(candidate) ? candidate : 'moderate';
  }

  private normalizeSizes(values: string[]): PlantSize[] {
    const allowed: PlantSize[] = ['small', 'medium', 'large'];
    const normalized = (values || [])
      .map((value) => value.toLowerCase() as PlantSize)
      .filter((value) => allowed.includes(value));
    return normalized.length > 0 ? Array.from(new Set(normalized)) : ['medium'];
  }

  private normalizePlacements(values: string[]): PlacementType[] {
    const allowed: PlacementType[] = ['floor', 'shelf', 'hanging', 'auto'];
    const normalized = (values || [])
      .map((value) => value.toLowerCase() as PlacementType)
      .filter((value) => allowed.includes(value));
    return normalized.length > 0 ? Array.from(new Set(normalized)) : ['auto'];
  }

  private toPlantId(scientificName: string): string {
    const slug = scientificName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `id-${slug || 'unknown'}-${Date.now()}`;
  }

}

export const createPlantIdentificationService = () => new PlantIdentificationService();
