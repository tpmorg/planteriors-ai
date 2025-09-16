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

export interface GenerationRequest {
  imageUri: string;
  plantType: PlantType;
  plantStyle: PlantStyle;
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

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}