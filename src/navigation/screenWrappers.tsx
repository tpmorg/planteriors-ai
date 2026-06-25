import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '../components/AppIcon';
import { CameraScreen } from '../screens/CameraScreen';
import { PlantSelectionScreen } from '../screens/PlantSelectionScreen';
import { PlantLocationScreen } from '../screens/PlantLocationScreen';
import { GenerationScreen } from '../screens/GenerationScreen';
import { GalleryScreen } from '../screens/GalleryScreen';
import { DesignDetailScreen } from '../screens/DesignDetailScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PlantIdentifyScreen } from '../screens/PlantIdentifyScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { PlantDetailScreen } from '../screens/PlantDetailScreen';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { databaseService } from '../services/databaseService';
import { onboardingService } from '../services/onboardingService';
import { usageTrackingService } from '../services/usageTrackingService';
import type {
  DesignFlowScreenProps,
  DesignFlowStackParamList,
  RootStackScreenProps,
  TabParamList,
  TabScreenProps,
} from '../types/navigation';
import type {
  GeneratedImage,
  GenerationRequest,
  PlantLocation,
  PlantSearchResult,
  SavedDesign,
} from '../types';

const DesignFlowStack = createStackNavigator<DesignFlowStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { tabBarStyle } = useTabBar();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.tabBarBackground,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 12,
          height: 65 + Math.max(insets.bottom, 8),
          shadowColor: theme.colors.shadow,
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: theme.isDark ? 0.34 : 0.1,
          shadowRadius: theme.isDark ? 14 : 8,
          elevation: 8,
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          paddingHorizontal: 0,
        },
        tabBarStyle,
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;

        let iconName: string;
        let iconWeight: 'regular' | 'fill' = 'regular';
        if (route.name === 'Gallery') {
          iconName = 'Images';
          iconWeight = isFocused ? 'fill' : 'regular';
        } else if (route.name === 'Library') {
          iconName = 'BookOpen';
          iconWeight = isFocused ? 'fill' : 'regular';
        } else if (route.name === 'Account') {
          iconName = 'User';
          iconWeight = isFocused ? 'fill' : 'regular';
        } else if (route.name === 'Settings') {
          iconName = 'Gear';
          iconWeight = isFocused ? 'fill' : 'regular';
        } else {
          iconName = 'Question';
        }

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 4,
            }}
          >
            <AppIcon
              name={iconName}
              size={24}
              color={
                isFocused
                  ? theme.colors.tabBarActive
                  : theme.colors.tabBarInactive
              }
              weight={iconWeight}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '500',
                marginTop: 3,
                color: isFocused
                  ? theme.colors.tabBarActive
                  : theme.colors.tabBarInactive,
              }}
            >
              {typeof label === 'string' ? label : route.name}
            </Text>
            <View
              style={{
                width: 20,
                height: 3,
                borderRadius: 2,
                marginTop: 3,
                backgroundColor: isFocused
                  ? theme.colors.tabBarActive
                  : 'transparent',
              }}
            />
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Gallery" component={GalleryScreenWrapper} />
      <Tab.Screen name="Library" component={LibraryScreenWrapper} />
      <Tab.Screen name="Account" component={AccountScreenWrapper} />
      <Tab.Screen name="Settings" component={SettingsScreenWrapper} />
    </Tab.Navigator>
  );
}

function AccountScreenWrapper({ navigation }: TabScreenProps<'Account'>) {
  const handleUpgradePress = () => {
    navigation.getParent()?.navigate('Subscription');
  };

  return <AccountScreen onUpgradePress={handleUpgradePress} />;
}

function SettingsScreenWrapper({ navigation }: TabScreenProps<'Settings'>) {
  const handleOpenOnboarding = () => {
    navigation.getParent()?.navigate('Onboarding', { fromSettings: true });
  };

  return <SettingsScreen onOpenOnboarding={handleOpenOnboarding} />;
}

function LibraryScreenWrapper({ navigation }: TabScreenProps<'Library'>) {
  const handlePlantSelect = useCallback((plant: PlantSearchResult) => {
    navigation.getParent()?.navigate('PlantDetail', { plant });
  }, [navigation]);

  return <LibraryScreen onPlantSelect={handlePlantSelect} />;
}

export function OnboardingScreenWrapper({
  route,
  navigation,
}: RootStackScreenProps<'Onboarding'>) {
  const fromSettings = route.params?.fromSettings === true;

  const handleComplete = async () => {
    await onboardingService.markCompleted();

    if (fromSettings) {
      navigation.goBack();
      return;
    }

    navigation.replace('MainApp');
  };

  return <OnboardingScreen fromSettings={fromSettings} onComplete={handleComplete} />;
}

export function DesignFlowNavigator() {
  return (
    <DesignFlowStack.Navigator screenOptions={{ headerShown: false }}>
      <DesignFlowStack.Screen name="Camera" component={CameraScreenWrapper} />
      <DesignFlowStack.Screen name="PlantSelection" component={PlantSelectionScreenWrapper} />
      <DesignFlowStack.Screen name="PlantLocation" component={PlantLocationScreenWrapper} />
      <DesignFlowStack.Screen name="Generation" component={GenerationScreenWrapper} />
    </DesignFlowStack.Navigator>
  );
}

function CameraScreenWrapper({ navigation, route }: DesignFlowScreenProps<'Camera'>) {
  const { user } = useAuth();
  const { mode } = route.params || {};
  const [recentSourceImages, setRecentSourceImages] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadRecentImages = async () => {
      try {
        const images = await databaseService.getRecentSourceImageUris(user?.id, 24);
        if (mounted) {
          setRecentSourceImages(images);
        }
      } catch (error) {
        console.error('Failed to load recent source images:', error);
      }
    };

    loadRecentImages();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleImageTaken = (imageUri: string) => {
    navigation.navigate('PlantSelection', { imageUri });
  };

  const handleClose = () => {
    navigation.getParent()?.goBack();
  };

  return (
    <CameraScreen
      onImageTaken={handleImageTaken}
      onClose={handleClose}
      recentSourceImages={recentSourceImages}
      mode={mode}
    />
  );
}

function PlantSelectionScreenWrapper({
  route,
  navigation,
}: DesignFlowScreenProps<'PlantSelection'>) {
  const { imageUri, initialMode } = route.params;

  const handlePlantSelected = (selectionData: Omit<GenerationRequest, 'imageUri'>) => {
    if (selectionData.mode === 'individual' || selectionData.mode === 'replace-plant') {
      navigation.navigate('PlantLocation', { imageUri, request: selectionData });
    } else {
      const request: GenerationRequest = {
        imageUri,
        ...selectionData,
      };
      navigation.navigate('Generation', { request });
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <PlantSelectionScreen
      imageUri={imageUri}
      initialMode={initialMode}
      onPlantSelected={handlePlantSelected}
      onBack={handleBack}
    />
  );
}

function PlantLocationScreenWrapper({
  route,
  navigation,
}: DesignFlowScreenProps<'PlantLocation'>) {
  const { imageUri, request } = route.params;

  const handleLocationSelected = (location: PlantLocation | null) => {
    const fullRequest: GenerationRequest = location
      ? { imageUri, ...request, location }
      : { imageUri, ...request };
    navigation.navigate('Generation', { request: fullRequest });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <PlantLocationScreen
      imageUri={imageUri}
      request={request}
      onLocationSelected={handleLocationSelected}
      onBack={handleBack}
    />
  );
}

function GenerationScreenWrapper({
  route,
  navigation,
}: DesignFlowScreenProps<'Generation'>) {
  const { request } = route.params;

  const handleGenerationComplete = (_result: GeneratedImage) => {
    navigation.getParent()?.navigate('MainApp');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleUpgradePress = () => {
    navigation.getParent()?.navigate('Subscription');
  };

  return (
    <GenerationScreen
      request={request}
      onGenerationComplete={handleGenerationComplete}
      onBack={handleBack}
      onUpgradePress={handleUpgradePress}
    />
  );
}

function GalleryScreenWrapper({ navigation }: TabScreenProps<'Gallery'>) {
  const { user } = useAuth();
  const { refreshStatus } = useSubscription();

  const handleNewDesign = () => {
    navigation.getParent()?.navigate('DesignFlow', { screen: 'Camera' });
  };

  const handleIdentifyPlant = async () => {
    if (!user?.id) {
      navigation.getParent()?.navigate('PlantIdentify');
      return;
    }

    const { canGenerate } = await usageTrackingService.canGenerateImage(user.id);
    if (!canGenerate) {
      await refreshStatus();
      navigation.getParent()?.navigate('Subscription');
      return;
    }

    navigation.getParent()?.navigate('PlantIdentify');
  };

  const handleDesignSelect = (
    design: SavedDesign,
    designs: SavedDesign[],
    initialIndex: number
  ) => {
    navigation.getParent()?.navigate('DesignDetail', { design, designs, initialIndex });
  };

  const handleUpgradePress = () => {
    navigation.getParent()?.navigate('Subscription');
  };

  return (
    <GalleryScreen
      onNewDesign={handleNewDesign}
      onIdentifyPlant={handleIdentifyPlant}
      onDesignSelect={handleDesignSelect}
      onUpgradePress={handleUpgradePress}
    />
  );
}

export function PlantIdentifyScreenWrapper({
  navigation,
  route,
}: RootStackScreenProps<'PlantIdentify'>) {
  const handleBack = () => {
    navigation.goBack();
  };

  const handleOpenCamera = () => {
    navigation.navigate('PlantCamera');
  };

  const handleCapturedImageHandled = React.useCallback(() => {
    navigation.setParams({
      capturedImageUri: undefined,
      capturedImageAt: undefined,
    });
  }, [navigation]);

  const handleUpgradePress = () => {
    navigation.navigate('Subscription');
  };

  return (
    <PlantIdentifyScreen
      onBack={handleBack}
      onOpenCamera={handleOpenCamera}
      onUpgradePress={handleUpgradePress}
      onCapturedImageHandled={handleCapturedImageHandled}
      capturedImageUri={route.params?.capturedImageUri}
      capturedImageAt={route.params?.capturedImageAt}
    />
  );
}

export function PlantCameraScreenWrapper({
  navigation,
}: RootStackScreenProps<'PlantCamera'>) {
  const handleClose = () => {
    navigation.goBack();
  };

  const handleImageTaken = (imageUri: string) => {
    const params = { capturedImageUri: imageUri, capturedImageAt: Date.now() };

    if (typeof navigation.popTo === 'function') {
      navigation.popTo('PlantIdentify', params);
      return;
    }

    navigation.navigate({
      name: 'PlantIdentify',
      params,
      merge: true,
    });
  };

  return (
    <CameraScreen
      mode="plant-id"
      onImageTaken={handleImageTaken}
      onClose={handleClose}
      recentSourceImages={[]}
    />
  );
}

export function DesignDetailScreenWrapper({
  route,
  navigation,
}: RootStackScreenProps<'DesignDetail'>) {
  const { design, designs, initialIndex } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDesignDeleted = () => {
    navigation.navigate('MainApp', { screen: 'Gallery' });
  };

  const handleRefineDesign = (currentDesign: SavedDesign, refinementPrompt: string) => {
    const imageUri = currentDesign.localImagePath || currentDesign.generatedImageUri;
    const normalizedPrompt = refinementPrompt.trim();

    if (!imageUri || !normalizedPrompt) {
      return;
    }

    const basePromptPrefix =
      'Refine this existing generated design while preserving room layout, architecture, and all non-plant objects.';
    const prompt = `${basePromptPrefix} ${normalizedPrompt}`;

    if (currentDesign.mode === 'individual' || currentDesign.mode === 'replace-plant') {
      if (!currentDesign.individualPlant) {
        return;
      }

      const selection = currentDesign.individualPlant;
      const individualPlantId =
        selection.id ||
        `refine-${selection.scientificName.toLowerCase().replace(/\s+/g, '-')}`;
      const suitablePlacements =
        selection.placement === 'auto'
          ? ['floor', 'shelf', 'hanging']
          : [selection.placement];

      const request: GenerationRequest = {
        imageUri,
        mode: currentDesign.mode,
        individualPlant: {
          plant: {
            id: individualPlantId,
            name: selection.name,
            scientificName: selection.scientificName,
            description: `Indoor ${selection.name} arrangement refinement`,
            icon: 'Leaf',
            category: 'tropical',
            lightRequirement: 'bright-indirect',
            waterRequirement: 'moderate',
            availableSizes: [selection.size],
            suitablePlacements: suitablePlacements as (
              | 'floor'
              | 'shelf'
              | 'hanging'
              | 'auto'
            )[],
            careLevel: 'moderate',
            growthRate: 'moderate',
            petSafe: false,
          },
          size: selection.size,
          placement: selection.placement,
        },
        prompt,
      };

      navigation.navigate('DesignFlow', { screen: 'Generation', params: { request } });
      return;
    }

    if (!currentDesign.plantType || !currentDesign.plantStyle) {
      return;
    }

    const styleId = currentDesign.plantStyle.name.toLowerCase().replace(/\s+/g, '-');
    const request: GenerationRequest = {
      imageUri,
      mode: 'multi-plant',
      plantType: {
        id: currentDesign.plantType.name.toLowerCase().replace(/\s+/g, '-'),
        name: currentDesign.plantType.name,
        description: currentDesign.plantType.description,
        icon: 'Leaf',
        styles: [
          {
            id: styleId,
            name: currentDesign.plantStyle.name,
            description: currentDesign.plantStyle.description,
            icon: 'Palette',
          },
        ],
      },
      plantStyle: {
        id: styleId,
        name: currentDesign.plantStyle.name,
        description: currentDesign.plantStyle.description,
        icon: 'Palette',
      },
      prompt,
    };

    navigation.navigate('DesignFlow', { screen: 'Generation', params: { request } });
  };

  const handleReplacePlant = (currentDesign: SavedDesign) => {
    const imageUri = currentDesign.localImagePath || currentDesign.generatedImageUri;

    if (!imageUri) {
      return;
    }

    navigation.navigate('DesignFlow', {
      screen: 'PlantSelection',
      params: { imageUri, initialMode: 'replace-plant' },
    });
  };

  return (
    <DesignDetailScreen
      design={design}
      designs={designs}
      initialIndex={initialIndex}
      onBack={handleBack}
      onDesignDeleted={handleDesignDeleted}
      onRefineDesign={handleRefineDesign}
      onReplacePlant={handleReplacePlant}
    />
  );
}

export function PlantDetailScreenWrapper({
  route,
  navigation,
}: RootStackScreenProps<'PlantDetail'>) {
  const { plant } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <PlantDetailScreen
      plant={plant}
      onBack={handleBack}
    />
  );
}
