import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firestore, storage } from '../config/firebase';
import {
  FirestoreCollectionDoc,
  FirestoreDesignDoc,
  FirestoreSyncMeta,
  FirestoreUserProfile,
  User,
} from '../types';
import { databaseService } from './databaseService';

const SYNC_SCHEMA_VERSION = 1 as const;

const toTimestamp = (value?: Timestamp | null): number | null => {
  if (!value) return null;
  return value.toMillis();
};

const toFirestoreTimestamp = (value?: number | null): Timestamp | null => {
  if (!value) return null;
  return Timestamp.fromMillis(value);
};

const getDeviceId = async (): Promise<string> => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${Math.random()}`
  );
  return digest.slice(0, 32);
};

export class FirestoreSyncService {
  private deviceIdPromise: Promise<string> | null = null;

  private async getDeviceId(): Promise<string> {
    if (!this.deviceIdPromise) {
      this.deviceIdPromise = getDeviceId();
    }
    return this.deviceIdPromise;
  }

  async ensureUserProfile(user: User): Promise<void> {
    const userRef = doc(firestore, 'users', user.id);
    const existing = await getDoc(userRef);
    const now = Timestamp.now();

    const profile: FirestoreUserProfile = {
      uid: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      createdAt: existing.exists() ? (existing.data().createdAt ?? now) : now,
      updatedAt: now,
    };

    await setDoc(userRef, profile, { merge: true });

    const syncMetaRef = doc(firestore, 'users', user.id, 'sync_meta', 'profile');
    const syncMetaSnap = await getDoc(syncMetaRef);
    const syncMeta: FirestoreSyncMeta = {
      schemaVersion: SYNC_SCHEMA_VERSION,
      createdAt: syncMetaSnap.exists() ? (syncMetaSnap.data().createdAt ?? now) : now,
      updatedAt: now,
      lastSyncAt: syncMetaSnap.exists() ? (syncMetaSnap.data().lastSyncAt ?? null) : null,
      lastRestoreAt: syncMetaSnap.exists() ? (syncMetaSnap.data().lastRestoreAt ?? null) : null,
      activeDeviceId: await this.getDeviceId(),
    };

    await setDoc(syncMetaRef, syncMeta, { merge: true });
  }

  async syncUserData(user: User): Promise<{ collections: number; designs: number }> {
    await this.ensureUserProfile(user);
    await databaseService.assignUserIdToExistingDesigns(user.id);

    const deviceId = await this.getDeviceId();
    const collectionRows = await databaseService.getSyncableCollectionRows(user.id);
    const collectionIdMap = new Map<string, string>();

    for (const row of collectionRows) {
      const remoteId = row.remote_id || Crypto.randomUUID();
      const collectionRef = doc(firestore, 'users', user.id, 'collections', remoteId);
      const payload: FirestoreCollectionDoc = {
        id: remoteId,
        name: row.name,
        createdAt: Timestamp.fromMillis(row.created_at),
        updatedAt: Timestamp.fromMillis(row.updated_at ?? row.created_at),
        deletedAt: toFirestoreTimestamp(row.deleted_at),
        deviceId: row.device_id || deviceId,
        version: row.version ?? 1,
      };
      await setDoc(collectionRef, payload, { merge: true });
      await databaseService.markCollectionSynced(String(row.id), remoteId);
      collectionIdMap.set(String(row.id), remoteId);
    }

    const designRows = await databaseService.getSyncableDesignRows(user.id);
    for (const row of designRows) {
      const remoteId = row.remote_id || Crypto.randomUUID();
      const designRef = doc(firestore, 'users', user.id, 'designs', remoteId);

      const originalImagePath = `users/${user.id}/designs/${remoteId}/original.jpg`;
      const generatedImagePath = `users/${user.id}/designs/${remoteId}/generated.jpg`;

      let originalImageUrl: string | null = null;
      let generatedImageUrl: string | null = null;

      if (!row.deleted_at) {
        originalImageUrl = await this.uploadImageIfNeeded(row.original_image_uri, originalImagePath);
        generatedImageUrl = await this.uploadImageIfNeeded(
          row.local_image_path || row.generated_image_uri,
          generatedImagePath
        );
      }

      const payload: FirestoreDesignDoc = {
        id: remoteId,
        collectionId: row.collection_id ? collectionIdMap.get(String(row.collection_id)) || null : null,
        mode: row.mode === 'multi-plant' ? 'multi-plant' : 'individual',
        originalImagePath,
        generatedImagePath,
        originalImageUrl,
        generatedImageUrl,
        customPrompt: row.custom_prompt || null,
        plantTypeName: row.plant_type_name || null,
        plantTypeDescription: row.plant_type_description || null,
        plantStyleName: row.plant_style_name || null,
        plantStyleDescription: row.plant_style_description || null,
        individualPlantName: row.individual_plant_name || null,
        individualPlantScientificName: row.individual_plant_scientific_name || null,
        individualPlantSize: row.individual_plant_size || null,
        individualPlantPlacement: row.individual_plant_placement || null,
        individualPlantId: row.individual_plant_id || null,
        generatedPlants: row.generated_plants_json ? JSON.parse(row.generated_plants_json) : null,
        isFavorite: Boolean(row.is_favorite),
        createdAt: Timestamp.fromMillis(row.created_at),
        updatedAt: Timestamp.fromMillis(row.updated_at ?? row.created_at),
        deletedAt: toFirestoreTimestamp(row.deleted_at),
        deviceId: row.device_id || deviceId,
        version: row.version ?? 1,
      };

      await setDoc(designRef, payload, { merge: true });
      await databaseService.markDesignSynced(String(row.id), remoteId);
    }

    await this.updateSyncMeta(user.id, { lastSyncAt: Timestamp.now() });

    return {
      collections: collectionRows.length,
      designs: designRows.length,
    };
  }

  async getSyncPreflight(userId: string): Promise<{
    localUnsyncedDesigns: number;
    localUnsyncedCollections: number;
    localTotalDesigns: number;
    localTotalCollections: number;
    remoteDesigns: number;
    remoteCollections: number;
    hasPotentialMergeRisk: boolean;
  }> {
    const local = await databaseService.getSyncPreflightCounts(userId);
    const [remoteDesignsSnap, remoteCollectionsSnap] = await Promise.all([
      getCountFromServer(collection(firestore, 'users', userId, 'designs')),
      getCountFromServer(collection(firestore, 'users', userId, 'collections')),
    ]);

    const remoteDesigns = remoteDesignsSnap.data().count;
    const remoteCollections = remoteCollectionsSnap.data().count;

    return {
      localUnsyncedDesigns: local.unsyncedDesigns,
      localUnsyncedCollections: local.unsyncedCollections,
      localTotalDesigns: local.totalLocalDesigns,
      localTotalCollections: local.totalLocalCollections,
      remoteDesigns,
      remoteCollections,
      hasPotentialMergeRisk:
        (local.unsyncedDesigns > 0 || local.unsyncedCollections > 0) &&
        (remoteDesigns > 0 || remoteCollections > 0),
    };
  }

  async restoreUserData(userId: string): Promise<{ collections: number; designs: number }> {
    const collectionsQuery = query(
      collection(firestore, 'users', userId, 'collections'),
      orderBy('updatedAt', 'desc')
    );
    const collectionsSnap = await getDocs(collectionsQuery);
    const localCollectionMap = new Map<string, string>();

    for (const docSnap of collectionsSnap.docs) {
      const data = docSnap.data() as FirestoreCollectionDoc;
      const localId = await databaseService.upsertRestoredCollection({
        userId,
        remoteId: docSnap.id,
        name: data.name,
        createdAt: data.createdAt.toMillis(),
        updatedAt: data.updatedAt.toMillis(),
        deletedAt: toTimestamp(data.deletedAt),
        deviceId: data.deviceId,
        version: data.version,
      });
      localCollectionMap.set(docSnap.id, localId);
    }

    const designsQuery = query(
      collection(firestore, 'users', userId, 'designs'),
      orderBy('updatedAt', 'desc')
    );
    const designsSnap = await getDocs(designsQuery);

    for (const docSnap of designsSnap.docs) {
      const data = docSnap.data() as FirestoreDesignDoc;
      const generatedLocalPath = data.deletedAt
        ? null
        : await this.downloadToCache(data.generatedImageUrl, `${docSnap.id}_generated.jpg`);
      const originalLocalPath = data.deletedAt
        ? null
        : await this.downloadToCache(data.originalImageUrl, `${docSnap.id}_original.jpg`);

      await databaseService.upsertRestoredDesign({
        userId,
        remoteId: docSnap.id,
        originalImageUri: originalLocalPath || data.originalImageUrl || data.originalImagePath,
        generatedImageUri: generatedLocalPath || data.generatedImageUrl || data.generatedImagePath,
        localImagePath: generatedLocalPath,
        mode: data.mode,
        collectionLocalId: data.collectionId ? localCollectionMap.get(data.collectionId) || null : null,
        plantTypeName: data.plantTypeName,
        plantTypeDescription: data.plantTypeDescription,
        plantStyleName: data.plantStyleName,
        plantStyleDescription: data.plantStyleDescription,
        individualPlantName: data.individualPlantName,
        individualPlantScientificName: data.individualPlantScientificName,
        individualPlantSize: data.individualPlantSize,
        individualPlantPlacement: (data.individualPlantPlacement as any) || null,
        individualPlantId: data.individualPlantId,
        generatedPlants: data.generatedPlants,
        customPrompt: data.customPrompt,
        createdAt: data.createdAt.toMillis(),
        updatedAt: data.updatedAt.toMillis(),
        deletedAt: toTimestamp(data.deletedAt),
        isFavorite: data.isFavorite,
        deviceId: data.deviceId,
        version: data.version,
      });
    }

    await this.updateSyncMeta(userId, { lastRestoreAt: Timestamp.now() });

    return {
      collections: collectionsSnap.size,
      designs: designsSnap.size,
    };
  }

  private async updateSyncMeta(
    userId: string,
    updates: Partial<Pick<FirestoreSyncMeta, 'lastSyncAt' | 'lastRestoreAt'>>
  ): Promise<void> {
    const syncMetaRef = doc(firestore, 'users', userId, 'sync_meta', 'profile');
    const existing = await getDoc(syncMetaRef);
    await setDoc(
      syncMetaRef,
      {
        schemaVersion: SYNC_SCHEMA_VERSION,
        createdAt: existing.exists() ? (existing.data().createdAt ?? Timestamp.now()) : Timestamp.now(),
        updatedAt: Timestamp.now(),
        activeDeviceId: await this.getDeviceId(),
        ...updates,
      },
      { merge: true }
    );
  }

  private async uploadImageIfNeeded(uri: string, storagePath: string): Promise<string> {
    const blob = await this.uriToBlob(uri);
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
  }

  private async uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return response.blob();
  }

  private async downloadToCache(url: string | null, fileName: string): Promise<string | null> {
    if (!url) return null;

    const directory = `${FileSystem.documentDirectory}synced-designs/`;
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }

    const localPath = `${directory}${fileName}`;
    await FileSystem.downloadAsync(url, localPath);
    return localPath;
  }
}

export const firestoreSyncService = new FirestoreSyncService();
