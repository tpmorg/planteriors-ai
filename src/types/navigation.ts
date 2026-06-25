import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { StackScreenProps } from '@react-navigation/stack';

import type {
  GenerationRequest,
  PlantSearchResult,
  SavedDesign,
} from './index';

export type RootStackParamList = {
  Auth: undefined;
  MainApp: NavigatorScreenParams<TabParamList> | undefined;
  DesignFlow: NavigatorScreenParams<DesignFlowStackParamList> | undefined;
  DesignDetail: { design: SavedDesign; designs?: SavedDesign[]; initialIndex?: number };
  PlantDetail: { plant: PlantSearchResult };
  Subscription: undefined;
  PlantIdentify: { capturedImageUri?: string; capturedImageAt?: number } | undefined;
  PlantCamera: undefined;
  Onboarding: { fromSettings?: boolean } | undefined;
};

export type DesignFlowStackParamList = {
  Camera: { mode?: 'room' | 'plant-id' } | undefined;
  PlantSelection: { imageUri: string; initialMode?: GenerationRequest['mode'] };
  PlantLocation: {
    imageUri: string;
    request: Omit<GenerationRequest, 'imageUri' | 'location'>;
  };
  Generation: { request: GenerationRequest };
};

export type TabParamList = {
  Gallery: undefined;
  Library: undefined;
  Account: undefined;
  Settings: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

export type DesignFlowScreenProps<T extends keyof DesignFlowStackParamList> =
  StackScreenProps<DesignFlowStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;
