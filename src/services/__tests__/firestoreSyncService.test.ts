const mockGetDocs = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockDownloadAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'device-id'),
  randomUUID: jest.fn(() => 'remote-id'),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...parts: string[]) => parts.join('/')),
  doc: jest.fn((...parts: string[]) => parts.join('/')),
  getCountFromServer: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  orderBy: jest.fn(() => 'updatedAt-desc'),
  query: jest.fn((value: unknown) => value),
  setDoc: jest.fn(async () => undefined),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => 1000 })),
    fromMillis: jest.fn((value: number) => ({ toMillis: () => value })),
  },
}));

jest.mock('firebase/storage', () => ({
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  ref: jest.fn((_storage: unknown, path: string) => path),
  uploadBytes: jest.fn(),
}));

jest.mock('../../config/firebase', () => ({
  firestore: {},
  storage: {},
}));

jest.mock('../databaseService', () => ({
  databaseService: {
    getCollectionRestoreState: jest.fn(),
    getDesignRestoreState: jest.fn(),
    upsertRestoredCollection: jest.fn(),
    upsertRestoredDesign: jest.fn(),
  },
}));

import { databaseService } from '../databaseService';
import { firestoreSyncService, shouldPreserveLocalRecord } from '../firestoreSyncService';

const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;

const timestamp = (value: number) => ({ toMillis: () => value });

const cloudDesign = (overrides: Record<string, unknown> = {}) => ({
  id: 'cloud-design',
  collectionId: null,
  mode: 'multi-plant',
  originalImagePath: 'users/user-1/designs/cloud-design/original.jpg',
  generatedImagePath: 'users/user-1/designs/cloud-design/generated.jpg',
  originalImageUrl: null,
  generatedImageUrl: null,
  customPrompt: null,
  plantTypeName: null,
  plantTypeDescription: null,
  plantStyleName: null,
  plantStyleDescription: null,
  individualPlantName: null,
  individualPlantScientificName: null,
  individualPlantSize: null,
  individualPlantPlacement: null,
  individualPlantId: null,
  generatedPlants: null,
  isFavorite: false,
  createdAt: timestamp(100),
  updatedAt: timestamp(200),
  deletedAt: null,
  deviceId: 'cloud-device',
  version: 2,
  ...overrides,
});

const designSnapshot = (data: ReturnType<typeof cloudDesign>) => ({
  id: 'cloud-design',
  data: () => data,
});

describe('Firestore restore merge safety', () => {
  let warnSpy: jest.SpyInstance;

  beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs
      .mockResolvedValueOnce({ docs: [], size: 0 })
      .mockResolvedValueOnce({ docs: [designSnapshot(cloudDesign())], size: 1 });
    mockDatabaseService.getDesignRestoreState.mockResolvedValue(null);
    mockDatabaseService.upsertRestoredDesign.mockResolvedValue('1');
    mockGetInfoAsync.mockResolvedValue({ exists: false });
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockDownloadAsync.mockResolvedValue({ status: 200, uri: 'file:///downloaded.jpg' });
  });

  it('preserves pending or newer local records', () => {
    expect(shouldPreserveLocalRecord(
      { syncStatus: 'pending_upload', updatedAt: 100, version: 1 },
      200,
      2
    )).toBe(true);
    expect(shouldPreserveLocalRecord(
      { syncStatus: 'synced', updatedAt: 300, version: 3 },
      200,
      2
    )).toBe(true);
    expect(shouldPreserveLocalRecord(
      { syncStatus: 'synced', updatedAt: 100, version: 1 },
      200,
      2
    )).toBe(false);
  });

  it('does not overwrite an unsynced local design', async () => {
    mockDatabaseService.getDesignRestoreState.mockResolvedValue({
      id: 7,
      originalImageUri: 'file:///local-original.jpg',
      generatedImageUri: 'file:///local-generated.jpg',
      localImagePath: 'file:///local-generated.jpg',
      updatedAt: 300,
      syncStatus: 'pending_upload',
      version: 3,
    });

    const result = await firestoreSyncService.restoreUserData('user-1');

    expect(mockDatabaseService.upsertRestoredDesign).not.toHaveBeenCalled();
    expect(mockGetDownloadURL).not.toHaveBeenCalled();
    expect(result.designs).toBe(0);
  });

  it('keeps existing local image references when cloud images are unavailable', async () => {
    mockDatabaseService.getDesignRestoreState.mockResolvedValue({
      id: 7,
      originalImageUri: 'file:///local-original.jpg',
      generatedImageUri: 'file:///local-generated.jpg',
      localImagePath: 'file:///local-generated.jpg',
      updatedAt: 100,
      syncStatus: 'synced',
      version: 1,
    });
    mockGetDownloadURL.mockRejectedValue(new Error('missing object'));

    await firestoreSyncService.restoreUserData('user-1');

    expect(mockDatabaseService.upsertRestoredDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        originalImageUri: 'file:///local-original.jpg',
        generatedImageUri: 'file:///local-generated.jpg',
        localImagePath: 'file:///local-generated.jpg',
      })
    );
    expect(mockDownloadAsync).not.toHaveBeenCalled();
  });

  it('resolves legacy Storage paths before inserting a cloud-only design', async () => {
    mockGetDownloadURL.mockImplementation(async (path: string) => `https://storage.example/${path}`);
    mockGetInfoAsync.mockImplementation(async (path: string) => {
      if (path.endsWith('synced-designs/')) return { exists: true };
      if (mockDownloadAsync.mock.calls.some((call) => call[1] === path)) {
        return { exists: true, size: 128 };
      }
      return { exists: false };
    });

    await firestoreSyncService.restoreUserData('user-1');

    expect(mockGetDownloadURL).toHaveBeenCalledTimes(2);
    expect(mockDatabaseService.upsertRestoredDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        generatedImageUri: expect.stringContaining('file:///documents/synced-designs/'),
        localImagePath: expect.stringContaining('file:///documents/synced-designs/'),
      })
    );
  });
});
