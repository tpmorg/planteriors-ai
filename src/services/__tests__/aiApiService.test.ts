import {
  ADD_PLANT_PRESERVATION_RULES,
  aiApiService,
  buildGenerationInstructions,
  PLANT_PLACEMENT_SURFACE_RULES,
} from '../aiApiService';
import type { GenerationRequest } from '../../types';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 1024 })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  uploadAsync: jest.fn(async () => ({ status: 200 })),
  downloadAsync: jest.fn(async () => ({ status: 200, uri: 'file:///documents/ai-results/job-1.jpg' })),
  FileSystemUploadType: { BINARY_CONTENT: 'binary' },
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { getIdToken: jest.fn(async () => 'test-token') } },
}));

jest.mock('../../utils/env', () => ({
  env: { getAiApiUrl: () => 'https://api.test', getAiApiTimeout: () => 30000 },
}));

jest.mock('../../utils/imageUtils', () => ({
  compressImageForAI: jest.fn(async (uri: string) => uri),
}));

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

const UPLOAD_SLOT = {
  uploadId: 'upload-1',
  upload: { url: 'https://storage.test/put', method: 'PUT', headers: {} },
};

const SUCCEEDED_JOB = {
  jobId: 'job-1',
  job: { id: 'job-1', status: 'succeeded', resultUrl: 'https://cdn.test/out.jpg' },
};

/** Route fetch by path; each entry is a queue so a route can fail then succeed. */
const mockFetchRoutes = (routes: Record<string, Array<Response>>) => {
  const calls: string[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const path = new URL(url).pathname;
    calls.push(path);
    const queue = routes[path];
    if (!queue || queue.length === 0) throw new Error(`Unexpected request to ${path}`);
    return queue.length > 1 ? queue.shift()! : queue[0];
  }) as unknown as typeof fetch;
  return calls;
};

const request: GenerationRequest = {
  imageUri: 'file:///photo.jpg',
  imagePrepared: true,
  mode: 'multi-plant',
  plantType: {
    id: 'tropical',
    name: 'Tropical',
    description: 'Lush',
    icon: 'Leaf',
    styles: [],
  },
  plantStyle: { id: 'modern', name: 'Modern', description: 'Clean lines', icon: 'PaintBrush' },
  plantOptions: {
    potStyle: { id: 'ceramic', name: 'Ceramic', icon: 'Flower' },
    potColor: { id: 'white', name: 'White', hex: '#ffffff' },
    usePlanterBox: false,
    maintenanceLevel: { id: 'low', name: 'Low', description: 'Easy', icon: 'Drop' },
    placementDensity: { id: 'sparse', name: 'Sparse', description: 'Few', icon: 'Plant' },
  },
};

describe('generation placement instructions', () => {
  it('always requires a suitable rigid floor or shelf and explicitly forbids couches', () => {
    expect(buildGenerationInstructions('multi-plant')).toBe(PLANT_PLACEMENT_SURFACE_RULES);
    expect(PLANT_PLACEMENT_SURFACE_RULES).toContain('type, rigidity, stability, and load-bearing suitability');
    expect(PLANT_PLACEMENT_SURFACE_RULES).toContain('only on the floor or on a stable, rigid shelf');
    expect(PLANT_PLACEMENT_SURFACE_RULES).toContain('Never place a new plant on a couch');
  });

  it('makes Add an insertion-only operation and preserves nearby existing plants', () => {
    const instructions = buildGenerationInstructions('individual', 'Use a charcoal planter.');
    expect(instructions).toBe(`Use a charcoal planter.\n\n${ADD_PLANT_PRESERVATION_RULES}\n\n${PLANT_PLACEMENT_SURFACE_RULES}`);
    expect(instructions).toContain('strictly an ADD operation, not a replacement operation');
    expect(instructions).toContain('including plants near the destination');
    expect(instructions).toContain('Use additive insertion only');
  });
});

describe('aiApiService rate-limit handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends a marked Add as individual mode with insertion-only preservation rules', async () => {
    let generationPayload: Record<string, unknown> | undefined;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/v1/uploads') return jsonResponse(UPLOAD_SLOT);
      if (path === '/api/v1/generations') {
        generationPayload = JSON.parse(String(init?.body));
        return jsonResponse(SUCCEEDED_JOB);
      }
      throw new Error(`Unexpected request to ${path}`);
    }) as unknown as typeof fetch;

    const location = { x: 0.12, y: 0.62, width: 0.18, height: 0.24 };
    await aiApiService.generatePlantImage({
      imageUri: 'file:///photo.jpg',
      imagePrepared: true,
      mode: 'individual',
      individualPlant: {
        plant: {
          id: 'snake-plant',
          name: 'Snake Plant',
          scientificName: 'Dracaena trifasciata',
          description: 'An upright indoor plant',
          icon: 'Leaf',
          category: 'tropical',
          lightRequirement: 'low-to-bright',
          waterRequirement: 'low',
          availableSizes: ['medium'],
          suitablePlacements: ['floor'],
          careLevel: 'easy',
          petSafe: false,
        },
        size: 'medium',
        placement: 'auto',
      },
      location,
    });

    expect(generationPayload).toMatchObject({ mode: 'individual', location });
    expect(generationPayload?.customInstructions).toEqual(expect.stringContaining('strictly an ADD operation'));
    expect(generationPayload?.customInstructions).toEqual(expect.stringContaining('including plants near the destination'));
  });

  it('retries a throttled generation request and still returns the image', async () => {
    const calls = mockFetchRoutes({
      '/api/v1/uploads': [jsonResponse(UPLOAD_SLOT)],
      '/api/v1/generations': [
        // No explicit `retryable` - throttling must default to retryable.
        jsonResponse({ error: { code: 'rate_limited', message: 'Slow down' } }, 429),
        jsonResponse(SUCCEEDED_JOB),
      ],
    });

    const pending = aiApiService.generatePlantImage(request);
    await jest.advanceTimersByTimeAsync(30000);

    await expect(pending).resolves.toMatchObject({ isGenerated: true, jobId: 'job-1' });
    expect(calls.filter((path) => path === '/api/v1/generations')).toHaveLength(2);
  });

  it('recovers a finished request by key without uploading or submitting again', async () => {
    let requestedUrl = '';
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return jsonResponse({ job: SUCCEEDED_JOB.job });
    }) as unknown as typeof fetch;

    await expect(aiApiService.recoverGeneration('saved-request-key')).resolves.toMatchObject({
      isGenerated: true,
      jobId: 'job-1',
    });
    expect(requestedUrl).toContain('requestKey=saved-request-key');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('treats a dropped submission response as unknown and preserves the request key', async () => {
    let submittedKey: string | undefined;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/v1/uploads') return jsonResponse(UPLOAD_SLOT);
      if (path === '/api/v1/generations') {
        submittedKey = (init?.headers as Record<string, string>)?.['Idempotency-Key'];
        throw new TypeError('Network request failed');
      }
      throw new Error(`Unexpected request to ${path}`);
    }) as unknown as typeof fetch;

    await expect(aiApiService.generatePlantImage(request, undefined, 'saved-request-key')).rejects.toMatchObject({
      code: 'request_unknown',
      status: 408,
    });
    expect(submittedKey).toBe('saved-request-key');
  });

  it('does not retry when the server marks the 429 as not retryable', async () => {
    const calls = mockFetchRoutes({
      '/api/v1/uploads': [jsonResponse(UPLOAD_SLOT)],
      '/api/v1/generations': [
        jsonResponse({ error: { code: 'quota_exceeded', retryable: false } }, 429),
        jsonResponse(SUCCEEDED_JOB),
      ],
    });

    const pending = aiApiService.generatePlantImage(request);
    const assertion = expect(pending).rejects.toMatchObject({ status: 429, code: 'quota_exceeded' });
    await jest.advanceTimersByTimeAsync(30000);
    await assertion;

    expect(calls.filter((path) => path === '/api/v1/generations')).toHaveLength(1);
  });

  it('does not retry a validation failure', async () => {
    const calls = mockFetchRoutes({
      '/api/v1/uploads': [jsonResponse(UPLOAD_SLOT)],
      '/api/v1/generations': [jsonResponse({ error: { code: 'invalid_input' } }, 400)],
    });

    const pending = aiApiService.generatePlantImage(request);
    const assertion = expect(pending).rejects.toMatchObject({ status: 400 });
    await jest.advanceTimersByTimeAsync(30000);
    await assertion;

    expect(calls.filter((path) => path === '/api/v1/generations')).toHaveLength(1);
  });

  it('gives up after the attempt budget and preserves the request id for support', async () => {
    const calls = mockFetchRoutes({
      '/api/v1/uploads': [jsonResponse(UPLOAD_SLOT)],
      '/api/v1/generations': [
        jsonResponse({ error: { code: 'rate_limited', retryable: true }, requestId: 'req_9' }, 429),
      ],
    });

    const pending = aiApiService.generatePlantImage(request);
    const assertion = expect(pending).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      retryable: true,
      requestId: 'req_9',
    });
    await jest.advanceTimersByTimeAsync(60000);
    await assertion;

    expect(calls.filter((path) => path === '/api/v1/generations')).toHaveLength(4);
  });

  it('retries a throttled job poll instead of failing the whole generation', async () => {
    const calls = mockFetchRoutes({
      '/api/v1/uploads': [jsonResponse(UPLOAD_SLOT)],
      '/api/v1/generations': [
        jsonResponse({
          jobId: 'job-1',
          job: { id: 'job-1', status: 'running', pollAfterMs: 600 },
        }),
      ],
      '/api/v1/generations/job-1': [
        jsonResponse({ error: { code: 'rate_limited' } }, 429),
        jsonResponse({ job: { id: 'job-1', status: 'succeeded', resultUrl: 'https://cdn.test/out.jpg' } }),
      ],
    });

    const pending = aiApiService.generatePlantImage(request);
    await jest.advanceTimersByTimeAsync(30000);

    await expect(pending).resolves.toMatchObject({ isGenerated: true, jobId: 'job-1' });
    expect(calls.filter((path) => path === '/api/v1/generations/job-1')).toHaveLength(2);
  });
});
