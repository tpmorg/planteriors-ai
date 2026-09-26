import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '../components/AppIcon';
import { AppButton } from '../components/AppButton';
import { CameraScreen } from '../screens/CameraScreen';
import { PlantLocationScreen } from '../screens/PlantLocationScreen';
import { GenerationScreen } from '../screens/GenerationScreen';
import { DesignIntentScreen } from '../screens/DesignIntentScreen';
import { DesignReadyScreen } from '../screens/DesignReadyScreen';
import { DesignCustomizeScreen } from '../screens/DesignCustomizeScreen';
import { PlantChooserScreen } from '../screens/PlantChooserScreen';
import { GalleryScreen } from '../screens/GalleryScreen';
import { DesignDetailScreen } from '../screens/DesignDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { PlantDetailScreen } from '../screens/PlantDetailScreen';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { DesignFlowProvider, useDesignFlow } from '../contexts/DesignFlowContext';
import { buildGenerationRequest, pruneRecoverableResults, shouldResumeAfterPurchase } from '../designFlow/designFlow';
import { cropImageToAspect } from '../utils/imageUtils';
import { INDIVIDUAL_PLANTS } from '../data/plantDatabase';
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
  CareLevel,
  GeneratedImage,
  GenerationRequest,
  IndividualPlant,
  IndividualPlantSelection,
  LightRequirement,
  PlantLocation,
  PlantCategoryType,
  PlantSearchResult,
  PlantSize,
  SavedDesign,
  WaterRequirement,
} from '../types';

const DesignFlowStack = createStackNavigator<DesignFlowStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { tabBarStyle } = useTabBar();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;
  const showCreateEntryButton = activeRouteName === 'Gallery';
  const handleOpenCreateEntry = () => {
    navigation.getParent()?.navigate('DesignFlow', {
      screen: 'Camera',
      params: { mode: 'room' },
    });
  };

  return (
    <>
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
        } else if (route.name === 'Favorites') {
          iconName = 'Heart';
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
          <Pressable
            key={route.key}
            testID={`main-tab-${route.name.toLowerCase()}`}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={typeof label === 'string' ? label : route.name}
            accessibilityState={{ selected: isFocused }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              minHeight: 48,
              justifyContent: 'center',
              paddingVertical: 4,
              opacity: pressed ? 0.7 : 1,
            })}
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
          </Pressable>
        );
        })}
      </Animated.View>

      {showCreateEntryButton ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
          <AppButton
            variant="primary"
            size="lg"
            icon="Plus"
            iconWeight="bold"
            fullWidth={false}
            elevated
            onPress={handleOpenCreateEntry}
            accessibilityLabel="Start with a photo"
            accessibilityHint="Open the room photo flow"
            style={{
              position: 'absolute',
              bottom: 90 + Math.max(insets.bottom, 8),
              right: 18,
              width: 74,
              height: 74,
              borderRadius: 37,
              zIndex: 10,
            }}
          />
        </View>
      ) : null}
    </>
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
      <Tab.Screen name="Favorites" component={FavoritesScreenWrapper} />
      <Tab.Screen name="Settings" component={SettingsScreenWrapper} />
    </Tab.Navigator>
  );
}

function useRestoreTabBarOnFocus() {
  const { setTabBarVisible } = useTabBar();

  useFocusEffect(
    useCallback(() => {
      setTabBarVisible(true);
    }, [setTabBarVisible])
  );
}

function SettingsScreenWrapper({ navigation }: TabScreenProps<'Settings'>) {
  useRestoreTabBarOnFocus();

  const handleOpenOnboarding = () => {
    navigation.getParent()?.navigate('Onboarding', { fromSettings: true });
  };

  return <SettingsScreen onOpenOnboarding={handleOpenOnboarding} />;
}

function LibraryScreenWrapper({ navigation }: TabScreenProps<'Library'>) {
  useRestoreTabBarOnFocus();

  const handlePlantSelect = useCallback((plant: PlantSearchResult) => {
    navigation.getParent()?.navigate('PlantDetail', { plant });
  }, [navigation]);

  return <LibraryScreen onPlantSelect={handlePlantSelect} />;
}

function FavoritesScreenWrapper({ navigation }: TabScreenProps<'Favorites'>) {
  useRestoreTabBarOnFocus();

  const handleDesignSelect = useCallback((
    design: SavedDesign,
    designs: SavedDesign[],
    initialIndex: number
  ) => {
    navigation.getParent()?.navigate('DesignDetail', { design, designs, initialIndex });
  }, [navigation]);

  return <FavoritesScreen onDesignSelect={handleDesignSelect} />;
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
  const { user } = useAuth();
  return (
    <DesignFlowProvider ownerId={user?.id || 'anonymous'}>
      <DesignFlowNavigatorContent />
    </DesignFlowProvider>
  );
}

function DesignFlowNavigatorContent() {
  const { draft, isRestoring } = useDesignFlow();
  if (isRestoring) return null;
  const initialRouteName: keyof DesignFlowStackParamList =
    draft.step === 'intent' ? 'Intent'
      : draft.step === 'plant' ? 'PlantChooser'
        : draft.step === 'target' ? 'PlantLocation'
          : draft.step === 'customization' ? (draft.intent === 'restyle' ? 'Ready' : 'Customize')
            : draft.step === 'ready' || draft.step === 'recoverable-error' ? 'Ready'
              : draft.step === 'result' && draft.results.length > 0 ? 'Generation'
              : 'Camera';
  return (
    <DesignFlowStack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <DesignFlowStack.Screen name="Camera" component={CameraScreenWrapper} />
      <DesignFlowStack.Screen name="Intent" component={DesignIntentScreenWrapper} />
      <DesignFlowStack.Screen name="PlantChooser" component={PlantChooserScreenWrapper} />
      <DesignFlowStack.Screen name="PlantLocation" component={PlantLocationScreenWrapper} initialParams={{ purpose: draft.intent === 'replace' ? 'replace' : 'add' }} />
      <DesignFlowStack.Screen name="Ready" component={DesignReadyScreenWrapper} />
      <DesignFlowStack.Screen name="Customize" component={DesignCustomizeScreenWrapper} />
      <DesignFlowStack.Screen name="Generation" component={GenerationScreenWrapper} />
    </DesignFlowStack.Navigator>
  );
}

function CameraScreenWrapper({ navigation, route }: DesignFlowScreenProps<'Camera'>) {
  const { user } = useAuth();
  const { mode, initialIntent, initialIndividualSelection, initialPhotoUri, preserveDraft } = route.params || {};
  const { setPhoto, updateDraft, resetDraft } = useDesignFlow();
  const [recentSourceImages, setRecentSourceImages] = useState<string[]>([]);

  useEffect(() => {
    if (!preserveDraft) {
      resetDraft(initialIndividualSelection ? 'plant-detail' : initialPhotoUri ? 'reuse-room' : 'new-design');
    }
    if (!initialPhotoUri) return;
    let active = true;
    setPhoto(initialPhotoUri).then(() => {
      if (!active) return;
      updateDraft({ intent: initialIntent || 'replace', individualPlant: initialIndividualSelection });
      if (initialIntent === 'add' && initialIndividualSelection) {
        navigation.replace('Ready');
      } else if (initialIntent === 'replace') {
        navigation.replace('PlantLocation', { purpose: 'replace' });
      } else {
        navigation.replace('Intent');
      }
    }).catch((error) => console.error('Failed to prepare prefilled design photo:', error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadRecentImages = async () => {
      try {
        const images = await databaseService.getRecentSourceImageUris(user?.id, 24);
        if (mounted) {
          const checks = await Promise.all(images.map((uri) => new Promise<string | null>((resolve) => {
            Image.getSize(uri, () => resolve(uri), () => resolve(null));
          })));
          if (mounted) setRecentSourceImages(checks.filter((uri): uri is string => !!uri));
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

  const handleImageTaken = async (imageUri: string) => {
    await setPhoto(imageUri);
    if (preserveDraft) {
      updateDraft({ step: 'ready' });
      navigation.navigate('Ready');
      return;
    }
    if (initialIndividualSelection) {
      updateDraft({ intent: 'add', individualPlant: initialIndividualSelection, step: 'ready' });
      navigation.navigate('Ready');
      return;
    }
    navigation.navigate('Intent');
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

function closeDesignFlow(navigation: any) {
  navigation.getParent()?.goBack();
}

function DesignIntentScreenWrapper({ navigation }: DesignFlowScreenProps<'Intent'>) {
  const { draft, setIntent } = useDesignFlow();
  if (!draft.photo) return null;
  const choose = (intent: 'restyle' | 'add' | 'replace') => {
    setIntent(intent);
    if (intent === 'restyle') navigation.navigate('Ready');
    else if (intent === 'replace') navigation.navigate('PlantLocation', { purpose: 'replace' });
    else navigation.navigate('PlantChooser');
  };
  return <DesignIntentScreen imageUri={draft.photo.originalUri} onSelect={choose} onBack={() => navigation.goBack()} onClose={() => closeDesignFlow(navigation)} />;
}

function PlantChooserScreenWrapper({ navigation }: DesignFlowScreenProps<'PlantChooser'>) {
  const { draft, setPlant } = useDesignFlow();
  return <PlantChooserScreen backgroundImageUri={draft.photo?.originalUri} onSelect={(selection) => { setPlant(selection); navigation.navigate('Ready'); }} onBack={() => navigation.goBack()} onClose={() => closeDesignFlow(navigation)} />;
}

function PlantLocationScreenWrapper({
  route,
  navigation,
}: DesignFlowScreenProps<'PlantLocation'>) {
  const { purpose } = route.params;
  const { draft, setLocation, updateDraft } = useDesignFlow();
  if (!draft.photo) return null;
  return <PlantLocationScreen imageUri={draft.photo.originalUri} request={{ mode: purpose === 'replace' ? 'replace-plant' : 'individual', individualPlant: draft.individualPlant }} onLocationSelected={(location) => {
    if (!location && purpose === 'replace') return;
    setLocation(location || undefined);
    if (purpose === 'replace' && !draft.individualPlant) {
      updateDraft({ step: 'plant' });
      navigation.navigate('PlantChooser');
    } else {
      updateDraft({ step: 'ready' });
      navigation.navigate('Ready');
    }
  }} onBack={() => navigation.goBack()} initialPlacementMode="choose" />;
}

function DesignReadyScreenWrapper({ navigation }: DesignFlowScreenProps<'Ready'>) {
  const { draft, updateDraft, setPhoto } = useDesignFlow();
  const { user } = useAuth();
  const { refreshStatus, freeGenerationsRemaining, purchaseCompletion } = useSubscription();
  const submissionRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Ready remains mounted while Generation is on top of it. If generation
      // fails and the user comes back to edit the request, unlock submission so
      // the corrected draft can be sent while still guarding rapid double taps.
      submissionRef.current = false;
    }, [])
  );

  const generate = async (skipAccessCheck: boolean = false) => {
    if (submissionRef.current) return;
    submissionRef.current = true;
    try {
      const request = buildGenerationRequest(draft);
      if (user?.id && !skipAccessCheck) {
        const { canGenerate } = await usageTrackingService.canGenerateImage(user.id);
        if (!canGenerate) {
          await refreshStatus();
          updateDraft({
            resumeAfterPurchase: true,
            purchaseEventBaselineId: purchaseCompletion?.id || 0,
          });
          navigation.getParent()?.navigate('Subscription');
          submissionRef.current = false;
          return;
        }
      }
      updateDraft({
        requestId: `request-${Date.now()}`,
        requestStatus: 'submitting',
        step: 'generating',
        resumeAfterPurchase: false,
        purchaseEventBaselineId: undefined,
      });
      navigation.navigate('Generation', { request });
    } catch (error) {
      console.error('Invalid design draft:', error);
      submissionRef.current = false;
    }
  };
  useEffect(() => {
    if (!shouldResumeAfterPurchase(draft, purchaseCompletion)) return;

    submissionRef.current = false;
    void generate(true);
  }, [purchaseCompletion?.id, draft.resumeAfterPurchase, draft.purchaseEventBaselineId]);
  const cropPhoto = async () => {
    if (!draft.photo) return;
    const cropped = await cropImageToAspect(draft.photo.originalUri, 4, 3);
    if (cropped === draft.photo.originalUri) return;
    await setPhoto(cropped);
    updateDraft({ step: 'ready' });
  };
  return <DesignReadyScreen draft={draft} updateDraft={updateDraft} allowanceText={`${freeGenerationsRemaining} design credits available`} onBack={() => navigation.goBack()} onClose={() => closeDesignFlow(navigation)} onGenerate={() => void generate()} onCustomize={() => navigation.navigate('Customize')} onChooseSpot={() => navigation.navigate('PlantLocation', { purpose: 'add' })} onChangeTarget={() => navigation.navigate('PlantLocation', { purpose: 'replace' })} onReplacePhoto={() => navigation.navigate('Camera', { mode: 'room', preserveDraft: true })} onCropPhoto={() => void cropPhoto()} />;
}

function DesignCustomizeScreenWrapper({ navigation }: DesignFlowScreenProps<'Customize'>) {
  const { draft, updateDraft } = useDesignFlow();
  useEffect(() => { updateDraft({ step: 'customization' }); }, []);
  return <DesignCustomizeScreen draft={draft} updateDraft={updateDraft} onChoosePlant={() => { updateDraft({ step: 'plant' }); navigation.navigate('PlantChooser'); }} onChooseSpot={() => { updateDraft({ step: 'target' }); navigation.navigate('PlantLocation', { purpose: draft.intent === 'replace' ? 'replace' : 'add' }); }} onDone={() => { updateDraft({ step: 'ready' }); navigation.navigate('Ready'); }} onBack={() => navigation.goBack()} onClose={() => closeDesignFlow(navigation)} />;
}

function GenerationScreenWrapper({
  route,
  navigation,
}: DesignFlowScreenProps<'Generation'>) {
  const { draft, updateDraft } = useDesignFlow();
  const { purchaseCompletion } = useSubscription();
  let request = route.params?.request;
  if (!request) {
    try {
      request = buildGenerationRequest(draft);
    } catch {
      return null;
    }
  }
  const restoredResult = route.params?.request ? undefined : draft.results[draft.results.length - 1];

  const handleGenerationComplete = (result: GeneratedImage) => {
    updateDraft({
      step: 'result',
      requestStatus: 'succeeded',
      results: draft.results.map((item) => item.imageUri === result.generatedImageUri ? { ...item, savedDesignId: result.id } : item),
    });
    navigation.getParent()?.navigate('MainApp', { screen: 'Gallery' });
  };

  const handleBack = () => {
    updateDraft({
      step: 'ready',
      requestStatus: draft.requestStatus === 'succeeded' ? 'succeeded' : 'failed',
    });
    navigation.goBack();
  };

  const handleUpgradePress = () => {
    const parentNavigation = navigation.getParent();
    updateDraft({
      step: 'ready',
      requestStatus: 'failed',
      resumeAfterPurchase: true,
      purchaseEventBaselineId: purchaseCompletion?.id || 0,
    });
    navigation.goBack();
    parentNavigation?.navigate('Subscription');
  };

  return (
    <GenerationScreen
      request={request}
      initialResultUri={restoredResult?.imageUri}
      initialSavedDesignId={restoredResult?.savedDesignId}
      onGenerationComplete={handleGenerationComplete}
      onBack={handleBack}
      onClose={() => navigation.getParent()?.navigate('MainApp')}
      onResultVisible={(imageUri, jobId) => updateDraft({
        step: 'result',
        jobId,
        requestStatus: 'succeeded',
        results: pruneRecoverableResults([
          ...draft.results.filter((item) => item.imageUri !== imageUri),
          { requestId: draft.requestId || `request-${Date.now()}`, jobId, imageUri, createdAt: Date.now() },
        ]),
      })}
      onRequestUnknown={() => updateDraft({ step: 'recoverable-error', requestStatus: 'unknown' })}
      onUpgradePress={handleUpgradePress}
    />
  );
}

function GalleryScreenWrapper({ navigation }: TabScreenProps<'Gallery'>) {
  useRestoreTabBarOnFocus();

  const handleNewDesign = () => {
    navigation.getParent()?.navigate('DesignFlow', {
      screen: 'Camera',
      params: { mode: 'room' },
    });
  };

  const handleDesignSelect = (
    design: SavedDesign,
    designs: SavedDesign[],
    initialIndex: number
  ) => {
    navigation.getParent()?.navigate('DesignDetail', { design, designs, initialIndex });
  };

  const handleUpgradePress = (initialProductKind?: 'monthly' | 'room_pack') => {
    navigation.getParent()?.navigate(
      'Subscription',
      initialProductKind ? { initialProductKind } : undefined
    );
  };

  return (
    <GalleryScreen
      onNewDesign={handleNewDesign}
      onDesignSelect={handleDesignSelect}
      onUpgradePress={handleUpgradePress}
    />
  );
}

export function DesignDetailScreenWrapper({
  route,
  navigation,
}: RootStackScreenProps<'DesignDetail'>) {
  const { design, designs, initialIndex } = route.params;
  const { user } = useAuth();
  const { refreshStatus } = useSubscription();

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDesignDeleted = () => {
    navigation.navigate('MainApp', { screen: 'Gallery' });
  };

  const navigateToGenerationIfAllowed = useCallback(
    async (request: GenerationRequest) => {
      try {
        if (!user?.id) {
          navigation.navigate('DesignFlow', { screen: 'Generation', params: { request } });
          return;
        }

        const { canGenerate } = await usageTrackingService.canGenerateImage(user.id);
        if (!canGenerate) {
          await refreshStatus();
          navigation.navigate('Subscription');
          return;
        }
      } catch (error) {
        console.error('Failed to verify generation access from design detail:', error);
      }

      navigation.navigate('DesignFlow', { screen: 'Generation', params: { request } });
    },
    [navigation, refreshStatus, user?.id]
  );

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

      void navigateToGenerationIfAllowed(request);
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

    void navigateToGenerationIfAllowed(request);
  };

  const handleReplacePlant = (currentDesign: SavedDesign) => {
    const imageUri = currentDesign.localImagePath || currentDesign.generatedImageUri;

    if (!imageUri) {
      return;
    }

    navigation.navigate('DesignFlow', {
      screen: 'Camera',
      params: { mode: 'room', initialPhotoUri: imageUri, initialIntent: 'replace' },
    });
  };

  const handleOpenPlantDetail = (plant: PlantSearchResult) => {
    navigation.navigate('PlantDetail', { plant });
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
      onOpenPlantDetail={handleOpenPlantDetail}
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

  const handlePlaceInRoom = () => {
    navigation.navigate('DesignFlow', {
      screen: 'Camera',
      params: {
        mode: 'room',
        initialIntent: 'add',
        initialIndividualSelection: createInitialSelectionFromPlant(plant),
      },
    });
  };

  return (
    <PlantDetailScreen
      plant={plant}
      onBack={handleBack}
      onPlaceInRoom={handlePlaceInRoom}
    />
  );
}

function createInitialSelectionFromPlant(plant: PlantSearchResult): IndividualPlantSelection {
  const curatedPlant = INDIVIDUAL_PLANTS.find((candidate) => candidate.id === plant.id);
  const individualPlant = curatedPlant || convertSearchPlantToIndividualPlant(plant);

  return {
    plant: individualPlant,
    size: getDefaultPlantSize(individualPlant.availableSizes),
    placement: 'auto',
  };
}

function convertSearchPlantToIndividualPlant(plant: PlantSearchResult): IndividualPlant {
  return {
    id: plant.id,
    name: plant.name,
    scientificName: plant.scientificName,
    description: plant.description || `A ${plant.category} plant for interior styling.`,
    icon: plant.icon || 'Leaf',
    category: toPlantCategory(plant.category),
    lightRequirement: toLightRequirement(plant.lightRequirement),
    waterRequirement: toWaterRequirement(plant.waterRequirement),
    availableSizes: plant.availableSizes?.length ? plant.availableSizes : ['medium'],
    suitablePlacements: plant.suitablePlacements?.length ? plant.suitablePlacements : ['floor', 'shelf'],
    careLevel: toCareLevel(plant.careLevel),
    growthRate: 'moderate',
    petSafe: plant.petSafe,
  };
}

function getDefaultPlantSize(sizes: PlantSize[]): PlantSize {
  if (sizes.includes('medium')) {
    return 'medium';
  }

  return sizes[0] || 'medium';
}

function toPlantCategory(category?: string): PlantCategoryType {
  const normalizedCategory = (category || '').toLowerCase();
  switch (normalizedCategory) {
    case 'tropical':
    case 'succulent':
    case 'flowering':
    case 'fern':
    case 'palm':
    case 'vine':
      return normalizedCategory as PlantCategoryType;
    default:
      return 'tropical';
  }
}

function toCareLevel(level?: string): CareLevel {
  const normalizedLevel = (level || '').toLowerCase();
  switch (normalizedLevel) {
    case 'easy':
    case 'moderate':
    case 'difficult':
      return normalizedLevel as CareLevel;
    default:
      return 'moderate';
  }
}

function toLightRequirement(requirement?: string): LightRequirement {
  const normalizedRequirement = (requirement || '').toLowerCase();
  switch (normalizedRequirement) {
    case 'low':
    case 'low-to-bright':
    case 'bright-indirect':
    case 'bright-direct':
      return normalizedRequirement as LightRequirement;
    default:
      return 'bright-indirect';
  }
}

function toWaterRequirement(requirement?: string): WaterRequirement {
  const normalizedRequirement = (requirement || '').toLowerCase();
  switch (normalizedRequirement) {
    case 'low':
    case 'moderate':
    case 'high':
      return normalizedRequirement as WaterRequirement;
    default:
      return 'moderate';
  }
}
