export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'apple';
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

export interface GeneratedImage {
  id: string;
  originalImageUri: string;
  generatedImageUri: string;
  plantType: PlantType;
  plantStyle: PlantStyle;
  prompt: string;
  createdAt: Date;
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
export type PlantSelectionMode = 'multi-plant' | 'individual';

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
  growthRate: GrowthRate;
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
  petSafe?: boolean;
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
  period: 'month' | 'year';
  features: string[];
  savings?: string;
  rcPackage?: any; // RevenueCat PurchasesPackage for purchase flow
}

export interface SubscriptionStatus {
  isActive: boolean;
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
