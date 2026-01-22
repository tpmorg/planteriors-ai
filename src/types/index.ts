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
  plantType: PlantType;
  plantStyle: PlantStyle;
  plantOptions?: PlantOptions;
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
  plantType: {
    name: string;
    description: string;
  };
  plantStyle: {
    name: string;
    description: string;
  };
  customPrompt?: string;
  createdAt: Date;
  isFavorite: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}