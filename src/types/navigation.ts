import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { StackScreenProps } from '@react-navigation/stack';

import type {
  DesignIntent,
  GenerationRequest,
  IndividualPlantSelection,
  PlantSearchResult,
  SavedDesign,
} from './index';

export type RootStackParamList = {
  Auth: undefined;
  MainApp: NavigatorScreenParams<TabParamList> | undefined;
  DesignFlow: NavigatorScreenParams<DesignFlowStackParamList> | undefined;
  DesignDetail: { design: SavedDesign; designs?: SavedDesign[]; initialIndex?: number };
  PlantDetail: { plant: PlantSearchResult };
  Subscription: { initialProductKind?: 'monthly' | 'room_pack' } | undefined;
  Onboarding: { fromSettings?: boolean } | undefined;
};

export type DesignFlowStackParamList = {
  Camera: {
    mode?: 'room' | 'plant-id';
    initialIntent?: DesignIntent;
    initialIndividualSelection?: IndividualPlantSelection;
    initialPhotoUri?: string;
    preserveDraft?: boolean;
  } | undefined;
  Intent: undefined;
  PlantChooser: undefined;
  Ready: undefined;
  Customize: undefined;
  PlantLocation: {
    purpose: 'add' | 'replace';
  };
  Generation: { request?: GenerationRequest } | undefined;
};

export type TabParamList = {
  Gallery: undefined;
  Library: undefined;
  Favorites: undefined;
  Settings: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

export type DesignFlowScreenProps<T extends keyof DesignFlowStackParamList> =
  StackScreenProps<DesignFlowStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;
