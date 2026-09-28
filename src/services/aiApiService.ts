import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { auth } from '../config/firebase';
import { GenerationRequest, IdentifiedDesignPlant, PlantIdentificationResult, RestylePlan } from '../types';
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

/** Total attempts (first try + backoffs) for a retryable request. */
const REQUEST_MAX_ATTEMPTS = 4;
const RATE_LIMIT_BASE_DELAY_MS = 1000;
const RATE_LIMIT_MAX_DELAY_MS = 15000;
/** Ceiling for a server-supplied `pollAfterMs`, so a job cannot stall the UI. */
const POLL_MAX_DELAY_MS = 10000;
const DEFAULT_POLL_DELAY_MS = 1500;

export const PLANT_PLACEMENT_SURFACE_RULES = [
  'Apply these placement rules only to newly generated plants; never move or alter plants already present in the source photo.',
  'Before placing each new plant, identify the type, rigidity, stability, and load-bearing suitability of its supporting surface.',
  'Place new plants only on the floor or on a stable, rigid shelf that can safely support the plant and its pot.',
  'Never place a new plant on a couch, sofa, chair, bed, cushion, pillow, upholstered furniture, soft surface, fabric, or on the seat, arm, or back of furniture.',
  'If a requested or automatic location is unsuitable, move only the new plant to the nearest valid floor or shelf.',
  'These surface-safety rules override all other placement instructions.',
].join(' ');

export const ADD_PLANT_PRESERVATION_RULES = [
  'This is strictly an ADD operation, not a replacement operation.',
  'Add one new selected plant while preserving every existing plant and every existing room object exactly as shown.',
  'Do not remove, replace, move, resize, restyle, cover, or obscure any existing plant, including plants near the destination.',
  'When a target rectangle is provided, it marks destination space for the new plant; it never selects an existing object for editing.',
  'Use additive insertion only. If the exact destination is obstructed, place the new plant on the nearest valid empty floor or shelf without modifying existing content.',
].join(' ');

export const REPLACE_PLANT_PRESERVATION_RULES = [
  'This is a REPLACE operation.',
  'Replace only the existing plant inside the target rectangle.',
  'Preserve every other plant, object, surface, and room detail exactly as shown.',
].join(' ');

export function buildGenerationInstructions(
  mode: GenerationRequest['mode'],
  customInstructions?: string,
): string {
  const userInstructions = customInstructions?.trim();
  const operationRules = mode === 'individual'
    ? ADD_PLANT_PRESERVATION_RULES
    : mode === 'replace-plant'
      ? REPLACE_PLANT_PRESERVATION_RULES
      : '';
  return [userInstructions, operationRules, PLANT_PLACEMENT_SURFACE_RULES]
    .filter(Boolean)
    .join('\n\n');
}

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
    idempotencyKey?: string,
  ): Promise<{ imageUri: string; isGenerated: true; jobId: string; restylePlan?: RestylePlan }> {
    onPhase?.('preparing');
    const uploadId = await this.uploadImage(request.imageUri, onPhase, request.imagePrepared);
    onPhase?.('generating');

    const body = this.generationPayload(uploadId, request);
    let response: { jobId: string; job: ApiJob };
    try {
      response = await this.request<{ jobId: string; job: ApiJob }>(
        '/api/v1/generations',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey || Crypto.randomUUID() },
          body: JSON.stringify(body),
        },
      );
    } catch (error) {
      if (error instanceof AiApiError && error.status >= 400 && error.status < 500 && error.status !== 408) {
        throw error;
      }
      throw new AiApiError('The request was interrupted. Check its status before generating again.', 'request_unknown', 408, true);
    }
    return this.finishGeneration(response.job || { id: response.jobId, status: 'queued' }, onPhase);
  }

  async recoverGeneration(
    idempotencyKey: string,
    onPhase?: (phase: 'preparing' | 'uploading' | 'generating' | 'downloading') => void,
  ): Promise<{ imageUri: string; isGenerated: true; jobId: string; restylePlan?: RestylePlan } | null> {
    let response: { job: ApiJob | null };
    try {
      response = await this.request<{ job: ApiJob | null }>(
        `/api/v1/generations?requestKey=${encodeURIComponent(idempotencyKey)}`,
      );
    } catch (error) {
      if (error instanceof AiApiError && error.status === 401) throw error;
      throw new AiApiError('Could not check the previous request. Try checking again when connected.', 'request_unknown', 408, true);
    }
    if (!Object.prototype.hasOwnProperty.call(response, 'job')) {
      throw new AiApiError('This app version cannot check the previous request yet. Try again later.', 'request_unknown', 408, true);
    }
    if (!response.job) return null;
    onPhase?.('generating');
    return this.finishGeneration(response.job, onPhase);
  }

  private async finishGeneration(
    initialJob: ApiJob,
    onPhase?: (phase: 'preparing' | 'uploading' | 'generating' | 'downloading') => void,
  ) {
    const job = await this.waitForJob(initialJob);
    if (!job.resultUrl) throw this.jobError(job, 'Generation returned no image.');

    onPhase?.('downloading');
    let imageUri: string;
    try {
      imageUri = await this.downloadResult(job.id, job.resultUrl);
    } catch {
      throw new AiApiError('The result could not be downloaded. Check the request again.', 'request_unknown', 408, true);
    }
    const restylePlan = (job.result as { restylePlan?: RestylePlan } | null | undefined)?.restylePlan;
    return { imageUri, isGenerated: true as const, jobId: job.id, restylePlan };
  }

  async identifyPlant(imageUri: string): Promise<PlantIdentificationResult> {
    return this.identify<PlantIdentificationResult>(imageUri, 'identify-plant');
  }

  async identifyDesignPlants(imageUri: string): Promise<IdentifiedDesignPlant[]> {
    const result = await this.identify<{ plants: IdentifiedDesignPlant[] }>(imageUri, 'analyze-design');
    return Array.isArray(result.plants) ? result.plants : [];
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
    isPrepared: boolean = false,
  ) {
    const jpegUri = isPrepared ? imageUri : await compressImageForAI(imageUri);
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
    const customInstructions = buildGenerationInstructions(request.mode, request.prompt);
    if (request.mode === 'multi-plant' && request.restyle) {
      // Household rules (pets) are omitted until they exist as an account setting; the server defaults them.
      return {
        uploadId,
        mode: request.mode,
        restyle: request.restyle,
        customInstructions,
      };
    }
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
        customInstructions,
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
      customInstructions,
    };
  }

  private async waitForJob(job: ApiJob): Promise<ApiJob> {
    let current = job;
    while (current.status === 'queued' || current.status === 'running') {
      await this.pause(current.pollAfterMs || DEFAULT_POLL_DELAY_MS, POLL_MAX_DELAY_MS);
      let response: { job: ApiJob };
      try {
        response = await this.request<{ job: ApiJob }>(`/api/v1/generations/${encodeURIComponent(current.id)}`);
      } catch {
        throw new AiApiError('The request was interrupted. Check its status before generating again.', 'request_unknown', 408, true);
      }
      current = response.job;
    }
    if (current.status !== 'succeeded') throw this.jobError(current, 'Generation failed.');
    return current;
  }

  private async waitForIdentification<T>(job: ApiJob<T>): Promise<ApiJob<T>> {
    let current = job;
    while (current.status === 'queued' || current.status === 'running') {
      await this.pause(current.pollAfterMs || DEFAULT_POLL_DELAY_MS, POLL_MAX_DELAY_MS);
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
    const headers = {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    };

    for (let attempt = 0; attempt < REQUEST_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.getAiApiTimeout());
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
        // Reusing the original `init` means a repeated POST keeps its
        // Idempotency-Key, so a backoff retry cannot double-spend allowance.
        if (response.status === 401 && !refreshToken) return this.request<T>(path, init, true);
        if (!response.ok) throw this.apiError(response.status, payload);
        return payload;
      } catch (error) {
        if (error instanceof AiApiError) {
          if (!this.shouldBackOff(error, attempt)) throw error;
          await this.pause(RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt, RATE_LIMIT_MAX_DELAY_MS);
          continue;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AiApiError('The AI service took too long to respond. Please try again.', 'timeout', 408, true);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new AiApiError('The AI service is busy. Please try again shortly.', 'rate_limited', 429, true);
  }

  private apiError(status: number, payload: ApiErrorPayload) {
    // Honour an explicit server decision; otherwise default throttling and
    // server errors to retryable so a transient 429 does not lose the job.
    const retryable =
      typeof payload.error?.retryable === 'boolean'
        ? payload.error.retryable
        : status === 429 || status >= 500;

    return new AiApiError(
      payload.error?.message || `AI service request failed (${status}).`,
      payload.error?.code || 'request_failed',
      status,
      retryable,
      payload.requestId,
    );
  }

  private shouldBackOff(error: AiApiError, attempt: number) {
    return error.status === 429 && error.retryable && attempt < REQUEST_MAX_ATTEMPTS - 1;
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

  private pause(ms: number, maxMs: number = 5000) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(500, Math.min(ms, maxMs))));
  }
}

export const aiApiService = new AiApiService();
