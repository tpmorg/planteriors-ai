import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'apple';
}

export type SyncStatus = 'pending_upload' | 'synced' | 'pending_delete' | 'failed' | 'conflict';
export type FirestoreUserProvider = 'google' | 'apple';
export type FirestoreSyncSchemaVersion = 1;

export interface FirestoreUserProfile {
  uid: string;
  email: string;
  name: string;
  provider: FirestoreUserProvider;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreSyncMeta {
  schemaVersion: FirestoreSyncSchemaVersion;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSyncAt: Timestamp | null;
  lastRestoreAt: Timestamp | null;
  activeDeviceId: string | null;
}

export interface FirestoreCollectionDoc {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
  deviceId: string;
  version: number;
}

export interface FirestoreDesignDoc {
  id: string;
  collectionId: string | null;
  mode: PlantSelectionMode;
  originalImagePath: string;
  generatedImagePath: string;
  originalImageUrl: string | null;
  generatedImageUrl: string | null;
  customPrompt: string | null;
  plantTypeName: string | null;
  plantTypeDescription: string | null;
  plantStyleName: string | null;
  plantStyleDescription: string | null;
  individualPlantName: string | null;
  individualPlantScientificName: string | null;
  individualPlantSize: PlantSize | null;
  individualPlantPlacement: string | null;
  individualPlantId: string | null;
  generatedPlants: IdentifiedDesignPlant[] | null;
  isFavorite: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
  deviceId: string;
  version: number;
}

export interface LocalSyncMetadata {
  remoteId?: string | null;
  updatedAt: number;
  deletedAt?: number | null;
  lastSyncedAt?: number | null;
  syncStatus: SyncStatus;
  deviceId: string;
  version: number;
}

export interface SyncQueueItem {
  id?: number;
  entityType: 'design' | 'collection';
  entityId: string;
  operation: 'upsert' | 'delete' | 'restore';
  payloadJson?: string | null;
  attempts: number;
  nextAttemptAt?: number | null;
  createdAt: number;
}

export interface PlantStyle {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface PlantType {
  id: string;
  name: string;
  description: string;
  icon: string;
  styles: PlantStyle[];
}

export interface PotStyle {
  id: string;
  name: string;
  icon: string;
}

export interface PotColor {
  id: string;
  name: string;
  hex: string;
}

export interface MaintenanceLevel {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface PlacementDensity {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface PlantOptions {
  potStyle: PotStyle;
  potColor: PotColor;
  usePlanterBox: boolean;
  maintenanceLevel: MaintenanceLevel;
  placementDensity: PlacementDensity;
}

export interface GenerationRequest {
  imageUri: string;
  imagePrepared?: boolean;
  originalImageUri?: string;
  mode: PlantSelectionMode;
  // Multi-plant mode fields (existing)
  plantType?: PlantType;
  plantStyle?: PlantStyle;
  plantOptions?: PlantOptions;
  // Individual plant mode fields (new)
  individualPlant?: IndividualPlantSelection;
  individualPlantId?: string;
  // Location for individual plant placement (optional)
  location?: PlantLocation;
  // Common
  prompt?: string;
}

export type DesignIntent = 'restyle' | 'add' | 'replace';
export type DesignFlowEntryPoint = 'new-design' | 'reuse-room' | 'plant-detail' | 'saved-design';
export type DesignFlowStep =
  | 'photo'
  | 'intent'
  | 'plant'
  | 'target'
  | 'ready'
  | 'customization'
  | 'generating'
  | 'result'
  | 'recoverable-error';

export interface DesignPhotoAsset {
  originalUri: string;
  preparedUri: string;
  width?: number;
  height?: number;
  orientation?: 'portrait' | 'landscape' | 'square';
  revision: number;
}

export interface RecoverableDesignResult {
  requestId: string;
  jobId?: string;
  imageUri: string;
  createdAt: number;
  savedDesignId?: string;
}

export interface DesignFlowDraft {
  id: string;
  ownerId: string;
  schemaVersion: 1;
  createdAt: number;
  updatedAt: number;
  entryPoint: DesignFlowEntryPoint;
  step: DesignFlowStep;
  photo?: DesignPhotoAsset;
  intent?: DesignIntent;
  plantType?: PlantType;
  plantStyle?: PlantStyle;
  plantOptions?: PlantOptions;
  individualPlant?: IndividualPlantSelection;
  location?: PlantLocation;
  locationPhotoRevision?: number;
  prompt?: string;
  refinementSourceUri?: string;
  requestId?: string;
  jobId?: string;
  requestStatus?: 'idle' | 'submitting' | 'unknown' | 'failed' | 'succeeded';
  resumeAfterPurchase?: boolean;
  purchaseEventBaselineId?: number;
  results: RecoverableDesignResult[];
}

export interface PurchaseCompletionEvent {
  id: number;
  kind: 'monthly' | 'room_pack' | 'restore';
  productId?: string;
  completedAt: number;
}

export interface GeneratedImage {
  id: string;
  originalImageUri: string;
  generatedImageUri: string;
  plantType: PlantType;
  plantStyle: PlantStyle;
  generatedPlants?: IdentifiedDesignPlant[];
  prompt: string;
  createdAt: Date;
}

export interface IdentifiedDesignPlant {
  commonName: string;
  scientificName?: string;
  confidence: number;
  placement: 'floor' | 'shelf' | 'hanging' | 'table' | 'windowsill' | 'counter' | 'unknown';
  visibleCount: number;
  careLevel: CareLevel;
  lightRequirement: LightRequirement;
  notes: string;
}

export interface SavedDesign {
  id: string;
  originalImageUri: string;
  generatedImageUri: string;
  localImagePath?: string | null;
  mode: PlantSelectionMode;
  collectionId?: string | null;
  // Multi-plant mode data
  plantType?: {
    name: string;
    description: string;
  };
  plantStyle?: {
    name: string;
    description: string;
  };
  generatedPlants?: IdentifiedDesignPlant[];
  // Individual plant mode data
  individualPlant?: {
    id?: string;
    name: string;
    scientificName: string;
    size: PlantSize;
    placement: PlacementType;
  };
  customPrompt?: string;
  createdAt: Date;
  isFavorite: boolean;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

// Individual Plant Mode Types
export type LightRequirement = 'low' | 'low-to-bright' | 'bright-indirect' | 'bright-direct';
export type WaterRequirement = 'low' | 'moderate' | 'high';
export type PlantSize = 'small' | 'medium' | 'large';
export type PlacementType = 'floor' | 'shelf' | 'hanging' | 'auto';
export type PlantCategoryType = 'tropical' | 'succulent' | 'flowering' | 'fern' | 'palm' | 'vine';
export type CareLevel = 'easy' | 'moderate' | 'difficult';
export type GrowthRate = 'slow' | 'moderate' | 'fast';
export type PlantSelectionMode = 'multi-plant' | 'individual' | 'replace-plant';

export interface IndividualPlant {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  icon: string;
  category: PlantCategoryType;
  lightRequirement: LightRequirement;
  waterRequirement: WaterRequirement;
  availableSizes: PlantSize[];
  suitablePlacements: PlacementType[];
  careLevel: CareLevel;
  growthRate?: GrowthRate;
  petSafe: boolean;
  imageUrl?: number; // require() returns a number for local assets
}

export interface PlantSizeOption {
  id: PlantSize;
  name: string;
  description: string;
  icon: string;
  heightRange: string;
}

export interface PlacementOption {
  id: PlacementType;
  name: string;
  description: string;
  icon: string;
}

export interface IndividualPlantSelection {
  plant: IndividualPlant;
  size: PlantSize;
  placement: PlacementType;
}

// Plant Codex Types
export interface PlantSearchResult {
  id: string;
  name: string;
  scientificName: string;
  description?: string;
  category: string;
  icon: string;
  careLevel: string;
  lightRequirement: string;
  waterRequirement?: string;
  petSafe: boolean;
  availableSizes: PlantSize[];
  suitablePlacements: PlacementType[];
  primaryImageUrl?: string;
  localImagePath?: string;
  searchRank?: number;
  isPopular: boolean;
  userAdded?: boolean;
}

export interface PlantCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface PlantSearchOptions {
  query?: string;
  category?: string;
  careLevel?: string;
  lightRequirement?: string;
  lightRequirements?: string[];
  waterRequirement?: string;
  petSafe?: boolean;
  placement?: PlacementType;
  limit?: number;
  offset?: number;
  source?: 'local' | 'api' | 'all';
}

// Plant Identification (image -> species + care guidance)
export interface PlantIdentificationResult {
  commonName: string;
  scientificName: string;
  confidence: number; // 0..1
  description: string;
  category: PlantCategoryType;
  careLevel: CareLevel;
  lightRequirement: LightRequirement;
  waterRequirement: WaterRequirement;
  petSafe: boolean;
  availableSizes: PlantSize[];
  suitablePlacements: PlacementType[];
  healthAssessment?: string;
  careTips: string[];
}

// Plant location selection for precise placement
export interface PlantLocation {
  // All values are normalized (0-1) relative to image dimensions
  x: number;      // Left edge of selection area
  y: number;      // Top edge of selection area
  width: number;  // Width of selection area
  height: number; // Height of selection area
}

// Subscription & Payment Types
export interface SubscriptionProduct {
  id: string;
  name: string;
  price: string;
  priceValue: number;
  currency: string;
  kind: 'monthly' | 'room_pack';
  period: 'month' | 'one_time';
  designCredits: number;
  features: string[];
  savings?: string;
  rcPackage?: any; // RevenueCat PurchasesPackage for purchase flow
}

export interface SubscriptionStatus {
  isActive: boolean;
  isVerified?: boolean;
  hasPurchased?: boolean;
  type: 'monthly' | 'annual' | null;
  expiryDate: number | null;
  isMock: boolean;
  platform?: 'ios' | 'android';
  purchaseDate?: number;
  entitlementId?: string;
}

export interface UsageStats {
  totalGenerations: number;
  freeUsed: number;
  paidUsed: number;
  firstGeneration: Date | null;
  lastGeneration: Date | null;
}

export interface FreeTrialUsage {
  userId: string;
  generationsUsed: number;
  firstGenerationAt: number | null;
  lastGenerationAt: number | null;
}

export interface SubscriptionData {
  id?: number;
  userId: string;
  subscriptionStatus: 'none' | 'trial' | 'active' | 'expired' | 'cancelled';
  subscriptionType: 'monthly' | 'annual' | null;
  purchaseToken?: string;
  originalTransactionId?: string;
  platform?: 'ios' | 'android';
  purchaseDate?: number;
  expiryDate?: number;
  isMock: boolean;
  createdAt: number;
  updatedAt: number;
}
