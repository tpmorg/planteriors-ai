import { aiApiService } from '../aiApiService';
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

describe('aiApiService rate-limit handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
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
