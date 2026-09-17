import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { auth } from '../config/firebase';
import { GenerationRequest, IdentifiedDesignPlant, PlantIdentificationResult } from '../types';
import { env } from '../utils/env';
import { compressImageForAI } from '../utils/imageUtils';

type ApiErrorPayload = {
  error?: { code?: string; message?: string; retryable?: boolean };
  requestId?: string;
};

type ApiJob<T = unknown> = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain';
  resultUrl?: string | null;
  result?: T | null;
  error?: { code?: string; message?: string; retryable?: boolean } | null;
  pollAfterMs?: number | null;
};

export type AiUsage = {
  entitlement: { active: boolean };
  generation: { consumed: number; reserved: number; remaining: number | null };
  identification: { consumed: number; reserved: number; remaining: number | null };
  activeJobs: number;
  capabilities: { generation: boolean; identification: boolean };
  policyVersion: string;
};

export class AiApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'AiApiError';
  }
}

class AiApiService {
  private get baseUrl() {
    return env.getAiApiUrl().replace(/\/$/, '');
  }

  async generatePlantImage(
    request: GenerationRequest,
    onPhase?: (phase: 'preparing' | 'uploading' | 'generating' | 'downloading') => void,
  ): Promise<{ imageUri: string; isGenerated: true; jobId: string }> {
    onPhase?.('preparing');
    const uploadId = await this.uploadImage(request.imageUri, onPhase);
    onPhase?.('generating');

    const body = this.generationPayload(uploadId, request);
    const response = await this.request<{ jobId: string; job: ApiJob }>(
      '/api/v1/generations',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': Crypto.randomUUID() },
        body: JSON.stringify(body),
      },
    );
    const job = await this.waitForJob(response.job || { id: response.jobId, status: 'queued' });
    if (!job.resultUrl) throw this.jobError(job, 'Generation returned no image.');

    onPhase?.('downloading');
    const imageUri = await this.downloadResult(job.id, job.resultUrl);
    return { imageUri, isGenerated: true, jobId: job.id };
  }

  async identifyPlant(imageUri: string): Promise<PlantIdentificationResult> {
    return this.identify<PlantIdentificationResult>(imageUri, 'identify-plant');
  }

  async identifyDesignPlants(imageUri: string): Promise<IdentifiedDesignPlant[]> {
    const result = await this.identify<{ plants: IdentifiedDesignPlant[] }>(imageUri, 'analyze-design');
    return Array.isArray(result.plants) ? result.plants : [];
  }

  async saveGeneration(jobId: string): Promise<{ designId: string }> {
    return this.request(`/api/v1/generations/${encodeURIComponent(jobId)}/save`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getUsage(): Promise<AiUsage> {
    return this.request<AiUsage>('/api/v1/usage');
  }

  private async identify<T>(imageUri: string, operation: 'identify-plant' | 'analyze-design'): Promise<T> {
    const uploadId = await this.uploadImage(imageUri);
    const response = await this.request<{ identification: ApiJob<T> }>('/api/v1/identifications', {
      method: 'POST',
      headers: { 'Idempotency-Key': Crypto.randomUUID() },
      body: JSON.stringify({ uploadId, operation }),
    });
    const job = await this.waitForIdentification(response.identification);
    if (!job.result) throw this.jobError(job, 'Identification returned no result.');
    return job.result;
  }

  private async uploadImage(
    imageUri: string,
    onPhase?: (phase: 'preparing' | 'uploading' | 'generating' | 'downloading') => void,
  ) {
    const jpegUri = await compressImageForAI(imageUri);
    const info = await FileSystem.getInfoAsync(jpegUri);
    if (!info.exists || typeof info.size !== 'number') throw new Error('Prepared image could not be read.');

    const slot = await this.request<{
      uploadId: string;
      upload: { url: string; method: 'POST' | 'PUT' | 'PATCH'; headers: Record<string, string> };
    }>('/api/v1/uploads', {
      method: 'POST',
      body: JSON.stringify({ contentType: 'image/jpeg', byteLength: info.size }),
    });

    onPhase?.('uploading');
    const uploadResponse = await FileSystem.uploadAsync(slot.upload.url, jpegUri, {
      httpMethod: slot.upload.method,
      headers: slot.upload.headers,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Photo upload failed (${uploadResponse.status}).`);
    }
    return slot.uploadId;
  }

  private generationPayload(uploadId: string, request: GenerationRequest) {
    if (request.mode === 'multi-plant') {
      if (!request.plantType || !request.plantStyle || !request.plantOptions) {
        throw new Error('Plant type, style, and options are required.');
      }
      const density = request.plantOptions.placementDensity.id === 'sparse'
        ? 'minimal'
        : request.plantOptions.placementDensity.id;
      return {
        uploadId,
        mode: request.mode,
        plantType: { id: request.plantType.id, name: request.plantType.name, description: request.plantType.description },
        plantStyle: { id: request.plantStyle.id, name: request.plantStyle.name, description: request.plantStyle.description },
        options: {
          potStyle: request.plantOptions.potStyle.name,
          potColor: request.plantOptions.potColor.name,
          usePlanterBox: request.plantOptions.usePlanterBox,
          maintenanceLevel: request.plantOptions.maintenanceLevel.id,
          placementDensity: density,
        },
        customInstructions: request.prompt || undefined,
      };
    }

    if (!request.individualPlant) throw new Error('An individual plant selection is required.');
    const plant = request.individualPlant.plant;
    return {
      uploadId,
      mode: request.mode,
      individualPlant: {
        id: plant.id,
        name: plant.name,
        scientificName: plant.scientificName,
        description: plant.description,
        size: request.individualPlant.size,
        placement: request.individualPlant.placement,
        lightRequirement: plant.lightRequirement,
      },
      location: request.location,
      customInstructions: request.prompt || undefined,
    };
  }

  private async waitForJob(job: ApiJob): Promise<ApiJob> {
    let current = job;
    while (current.status === 'queued' || current.status === 'running') {
      await this.pause(current.pollAfterMs || 1500);
      const response = await this.request<{ job: ApiJob }>(`/api/v1/generations/${encodeURIComponent(current.id)}`);
      current = response.job;
    }
    if (current.status !== 'succeeded') throw this.jobError(current, 'Generation failed.');
    return current;
  }

  private async waitForIdentification<T>(job: ApiJob<T>): Promise<ApiJob<T>> {
    let current = job;
    while (current.status === 'queued' || current.status === 'running') {
      await this.pause(current.pollAfterMs || 1500);
      const response = await this.request<{ identification: ApiJob<T> }>(`/api/v1/identifications/${encodeURIComponent(current.id)}`);
      current = response.identification;
    }
    if (current.status !== 'succeeded') throw this.jobError(current, 'Identification failed.');
    return current;
  }

  private async request<T>(path: string, init: RequestInit = {}, refreshToken = false): Promise<T> {
    const user = auth.currentUser;
    if (!user) throw new AiApiError('Please sign in to continue.', 'unauthorized', 401, false);
    const token = await user.getIdToken(refreshToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.getAiApiTimeout());
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
      if (response.status === 401 && !refreshToken) return this.request<T>(path, init, true);
      if (!response.ok) {
        throw new AiApiError(
          payload.error?.message || `AI service request failed (${response.status}).`,
          payload.error?.code || 'request_failed',
          response.status,
          Boolean(payload.error?.retryable),
          payload.requestId,
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof AiApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiApiError('The AI service took too long to respond. Please try again.', 'timeout', 408, true);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async downloadResult(jobId: string, url: string) {
    const directory = `${FileSystem.documentDirectory}ai-results/`;
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const destination = `${directory}${jobId}.jpg`;
    const result = await FileSystem.downloadAsync(url, destination);
    if (result.status < 200 || result.status >= 300) throw new Error('Generated image download failed.');
    return result.uri;
  }

  private jobError(job: ApiJob, fallback: string) {
    return new AiApiError(job.error?.message || fallback, job.error?.code || job.status, 400, Boolean(job.error?.retryable));
  }

  private pause(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(500, Math.min(ms, 5000))));
  }
}

export const aiApiService = new AiApiService();
