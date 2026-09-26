import { GenerationRequest, RestylePlan } from '../types';
import { aiApiService } from './aiApiService';

/** Compatibility wrapper while generation is owned by the Planterior API. */
export class GeminiService {
  async generatePlantImage(
    request: GenerationRequest,
    onPhase?: (phase: 'preparing' | 'uploading' | 'generating' | 'downloading') => void,
  ): Promise<{ imageUri: string; isGenerated: boolean; jobId: string; restylePlan?: RestylePlan }> {
    return aiApiService.generatePlantImage(request, onPhase);
  }
}

export const createGeminiService = () => new GeminiService();
