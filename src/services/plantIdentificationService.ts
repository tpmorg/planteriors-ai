import { GoogleGenAI } from '@google/genai';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { env } from '../utils/env';
import { databaseService } from './databaseService';
import {
  CareLevel,
  LightRequirement,
  PlacementType,
  PlantCategoryType,
  PlantIdentificationResult,
  PlantSize,
  WaterRequirement,
} from '../types';

const MODEL_NAME = 'gemini-2.5-flash';

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

export class PlantIdentificationService {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async identifyPlantFromImage(imageUri: string): Promise<PlantIdentificationResult> {
    const network = await NetInfo.fetch();
    if (!network.isConnected) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    if (!imageUri.startsWith('file://')) {
      throw new Error('Expected a local file URI for plant identification');
    }

    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
    const mimeType = this.getMimeType(imageUri);

    const response = await this.client.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { text: this.buildPrompt() },
        {
          inlineData: {
            mimeType,
            data: base64,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonText = this.extractTextResponse(response);
    const parsed = JSON.parse(jsonText) as IdentificationPayload;
    return this.normalize(parsed);
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

  private getMimeType(uri: string): string {
    const lower = uri.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}

export const createPlantIdentificationService = (apiKey?: string) => {
  const key = apiKey || env.getGeminiApiKey();
  return new PlantIdentificationService(key);
};
