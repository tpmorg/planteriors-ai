import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Share,
  Dimensions,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionSheet } from '../components/ActionSheet';
import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
  Directions,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { Collection, PlantSearchResult, SavedDesign } from '../types';
import { databaseService } from '../services/databaseService';
import { createPlantIdentificationService } from '../services/plantIdentificationService';
import { useTheme } from '../contexts/ThemeContext';
import { CollectionPickerModal } from '../components/CollectionPickerModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getPlantById as getSeedPlantById,
  searchPlants as searchSeedPlants,
} from '../data/plantDatabase';
import { saveDesignImageToDevice } from '../utils/imageSave';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';

interface DesignDetailScreenProps {
  design: SavedDesign;
  designs?: SavedDesign[];
  initialIndex?: number;
  onBack: () => void;
  onDesignDeleted: () => void;
  onRefineDesign: (design: SavedDesign, refinementPrompt: string) => void;
  onReplacePlant: (design: SavedDesign) => void;
  onOpenPlantDetail: (plant: PlantSearchResult) => void;
}

interface RefinementMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

interface PlantProfile {
  id: string;
  name: string;
  scientificName: string;
  description?: string;
  category?: string;
  icon?: string;
  careLevel?: string;
  lightRequirement?: string;
  waterRequirement?: string;
  petSafe?: boolean;
  availableSizes?: string[];
  suitablePlacements?: string[];
  localImagePath?: string;
  primaryImageUrl?: string;
  imageUrl?: number;
  userAdded?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Helper function to get design display text
const getDesignDisplayText = (design: SavedDesign): { title: string; subtitle: string; shareMessage: string } => {
  if ((design.mode === 'individual' || design.mode === 'replace-plant') && design.individualPlant) {
    const { name, size, placement } = design.individualPlant;
    const placementLabel = placement === 'auto' ? 'no preference' : placement;
    const isReplacement = design.mode === 'replace-plant';
    return {
      title: name,
      subtitle: isReplacement ? `${size} • replacement` : `${size} • ${placementLabel}`,
      shareMessage: isReplacement
        ? `Check out my plant design! Replaced my plant with a ${size} ${name}.`
        : `Check out my plant design! Added a ${size} ${name} (${placementLabel}) to my room.`,
    };
  }
  // Multi-plant mode or fallback for legacy data
  const typeName = design.plantType?.name || 'Custom';
  const styleName = design.plantStyle?.name || 'Design';
  return {
    title: typeName,
    subtitle: `${styleName} Style`,
    shareMessage: `Check out my plant design! Created with ${typeName} in ${styleName} style.`,
  };
};

const normalizePlantValue = (value?: string) =>
  (value || '').trim().toLowerCase();

const findSeedPlantByName = (name?: string) => {
  if (!name) return undefined;
  const normalizedName = normalizePlantValue(name);
  return searchSeedPlants(name).find(
    (plant) =>
      normalizePlantValue(plant.name) === normalizedName ||
      normalizePlantValue(plant.scientificName) === normalizedName ||
      normalizePlantValue(plant.name).includes(normalizedName) ||
      normalizePlantValue(plant.scientificName).includes(normalizedName)
  );
};

const mapSeedPlantProfile = (seedPlant: ReturnType<typeof getSeedPlantById>) => {
  if (!seedPlant) return null;
  return {
    id: seedPlant.id,
    name: seedPlant.name,
    scientificName: seedPlant.scientificName,
    description: seedPlant.description,
    category: seedPlant.category,
    icon: seedPlant.icon,
    careLevel: seedPlant.careLevel,
    lightRequirement: seedPlant.lightRequirement,
    waterRequirement: seedPlant.waterRequirement,
    petSafe: seedPlant.petSafe,
    availableSizes: seedPlant.availableSizes,
    suitablePlacements: seedPlant.suitablePlacements,
    imageUrl: seedPlant.imageUrl,
    userAdded: false,
  };
};

const buildPlantSearchResult = (
  individualPlant: NonNullable<SavedDesign['individualPlant']>,
  profile: PlantProfile | null
): PlantSearchResult => {
  const resolved = profile && profile.name ? profile : null;

  return {
    id: resolved?.id || individualPlant.id || individualPlant.name.toLowerCase().replace(/\s+/g, '-'),
    name: resolved?.name || individualPlant.name,
    scientificName: resolved?.scientificName || individualPlant.scientificName,
    description: resolved?.description,
    category: resolved?.category || 'tropical',
    icon: resolved?.icon || 'Leaf',
    careLevel: resolved?.careLevel || 'moderate',
    lightRequirement: resolved?.lightRequirement || 'bright-indirect',
    waterRequirement: resolved?.waterRequirement || 'moderate',
    petSafe: resolved?.petSafe ?? false,
    availableSizes: (resolved?.availableSizes as PlantSearchResult['availableSizes'] | undefined)
      || [individualPlant.size],
    suitablePlacements: (resolved?.suitablePlacements as PlantSearchResult['suitablePlacements'] | undefined)
      || (individualPlant.placement === 'auto'
        ? ['floor', 'shelf', 'hanging']
        : [individualPlant.placement]),
    primaryImageUrl: resolved?.primaryImageUrl,
    localImagePath: resolved?.localImagePath,
    isPopular: !resolved?.userAdded,
    userAdded: resolved?.userAdded,
  };
};

export const DesignDetailScreen: React.FC<DesignDetailScreenProps> = ({
  design: initialDesign,
  designs: initialDesigns = [],
  initialIndex = 0,
  onBack,
  onDesignDeleted,
  onRefineDesign,
  onReplacePlant,
  onOpenPlantDetail,
}) => {
  const insets = useSafeAreaInsets();
  const modalOpenTranslateY = Math.max(insets.top + 56, screenHeight * 0.22);
  const modalBaseHeight = screenHeight - modalOpenTranslateY;
  const modalHeight = modalBaseHeight * 0.8;
  const modalOpenY = screenHeight - modalHeight;
  const [designList, setDesignList] = useState<SavedDesign[]>(
    initialDesigns.length > 0 ? initialDesigns : [initialDesign]
  );
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (initialDesigns.length === 0) return 0;
    const found = initialDesigns.findIndex((d) => d.id === initialDesign.id);
    if (found !== -1) return found;
    if (initialIndex >= 0 && initialIndex < initialDesigns.length) return initialIndex;
    return 0;
  });
  const [design, setDesign] = useState<SavedDesign>(() => {
    const initialFromList = (initialDesigns.length > 0
      ? initialDesigns.find((d) => d.id === initialDesign.id)
      : undefined);
    return initialFromList || initialDesign;
  });
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingToDevice, setIsSavingToDevice] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRefineModal, setShowRefineModal] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [refinementInput, setRefinementInput] = useState('');
  const [refinementMessages, setRefinementMessages] = useState<RefinementMessage[]>([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      text: 'Tell me what to change. I will create a new iteration from this design.',
    },
  ]);
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionName, setActiveCollectionName] = useState<string | null>(null);
  const [plantProfile, setPlantProfile] = useState<PlantProfile | null>(null);
  const plantProfileRequestIdRef = useRef(0);
  const [isIdentifyingDesignPlants, setIsIdentifyingDesignPlants] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const isImageTransitioningRef = useRef(false);
  const isMountedRef = useRef(true);
  const { user } = useAuth();
  const { showToast } = useToast();

  // Animated values for image zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const imageOpacity = useSharedValue(1);

  // Modal animation
  const modalTranslateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);

  const { theme } = useTheme();
  const styles = createStyles(theme);
  const displayText = getDesignDisplayText(design);
  const createdDate = new Date(design.createdAt);
  const headerDate = createdDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const headerSubtitle = displayText.subtitle;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const onHide = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resolvePlantProfile = async (plantId?: string, plantName?: string, scientificName?: string) => {
    const requestId = ++plantProfileRequestIdRef.current;
    const isStale = () =>
      !isMountedRef.current || requestId !== plantProfileRequestIdRef.current;
    const commitPlantProfile = (profile: PlantProfile | null) => {
      if (isStale()) return;
      setPlantProfile(profile);
    };
    const safeSearchPlants = async (query: string) => {
      try {
        return await databaseService.searchPlants(query, { limit: 8 });
      } catch {
        return [];
      }
    };
    const safeGetPlantById = async (id: string) => {
      try {
        return await databaseService.getPlantById(id);
      } catch {
        return null;
      }
    };

    if (!plantId && !plantName && !scientificName) {
      commitPlantProfile(null);
      return;
    }

    try {
      if (plantId) {
        const profile =
          (await safeGetPlantById(plantId)) ||
          getSeedPlantById(plantId);
        if (profile) {
          commitPlantProfile(profile as PlantProfile);
          return;
        }
      }

      const normalize = (value?: string) =>
        (value || '').trim().toLowerCase();
      const queries = Array.from(
        new Set(
          [plantName, scientificName]
            .filter((value): value is string => Boolean(value && value.trim().length > 0))
            .map((value) => value.trim())
        )
      );

      let matchedPlant: PlantProfile | null = null;

      for (const query of queries) {
        const results = await safeSearchPlants(query);
        const match = results.find((candidate: any) => {
          const candidateName = normalize(candidate.name);
          const candidateScientific = normalize(candidate.scientificName);
          return (
            candidateName === normalize(plantName) ||
            candidateScientific === normalize(scientificName) ||
            (plantName && candidateName.includes(normalize(plantName))) ||
            (scientificName && candidateScientific.includes(normalize(scientificName)))
          );
        });
        if (match) {
          matchedPlant = match as PlantProfile;
          break;
        }
      }

      if (!matchedPlant && plantId) {
        const seedById = getSeedPlantById(plantId);
        if (seedById) {
          matchedPlant = mapSeedPlantProfile(seedById);
        }
      }

      if (!matchedPlant) {
        const staticNameMatch = plantName ? findSeedPlantByName(plantName) : undefined;
        if (staticNameMatch) {
          matchedPlant = mapSeedPlantProfile(staticNameMatch);
        }
      }

      if (!matchedPlant) {
        const staticScientificMatch = scientificName
          ? findSeedPlantByName(scientificName)
          : undefined;
        if (staticScientificMatch) {
          matchedPlant = mapSeedPlantProfile(staticScientificMatch);
        }
      }

      commitPlantProfile(matchedPlant);
    } catch (error) {
      if (__DEV__) {
        console.warn('Plant profile lookup skipped:', error);
      }
      commitPlantProfile(null);
    }
  };

  useEffect(() => {
    const individualPlant =
      design.mode === 'individual' || design.mode === 'replace-plant'
        ? design.individualPlant
        : null;
    if (!individualPlant?.name) {
      setPlantProfile(null);
      return;
    }

    resolvePlantProfile(individualPlant.id, individualPlant.name, individualPlant.scientificName);
  }, [design.mode, design.individualPlant?.id, design.individualPlant?.name, design.individualPlant?.scientificName]);

  const showPlantProfile = () => {
    if (
      (design.mode !== 'individual' && design.mode !== 'replace-plant') ||
      !design.individualPlant
    ) {
      return;
    }

    const plantResult = buildPlantSearchResult(design.individualPlant, plantProfile);

    if (showInfoModal) {
      hideModal();
      setTimeout(() => {
        onOpenPlantDetail(plantResult);
      }, 120);
      return;
    }

    onOpenPlantDetail(plantResult);
  };

  const startPlantReplacement = () => {
    if (showInfoModal) {
      hideModal();
    }
    onReplacePlant(design);
  };

  const toggleCompare = () => {
    if (showInfoModal) {
      hideModal();
    }
    setIsCompareMode((prev) => !prev);
  };

  const identifyGeneratedDesignPlants = async () => {
    if (design.mode !== 'multi-plant' || isIdentifyingDesignPlants) return;

    const imageUri = design.localImagePath || design.generatedImageUri;
    if (!imageUri) {
      showToast('No generated image available', 'error');
      return;
    }

    try {
      setIsIdentifyingDesignPlants(true);
      const service = createPlantIdentificationService();
      const generatedPlants = await service.identifyPlantsInGeneratedDesign(imageUri);

      if (generatedPlants.length === 0) {
        showToast('No clear plant matches found', 'info');
        return;
      }

      await databaseService.updateGeneratedPlants(design.id, generatedPlants);
      const updatedDesign = { ...design, generatedPlants };
      setDesign(updatedDesign);
      setDesignList((prev) =>
        prev.map((item) => item.id === updatedDesign.id ? updatedDesign : item)
      );
      showToast('Plant matches identified', 'success');
    } catch (error) {
      console.error('Failed to identify generated design plants:', error);
      showToast('Could not identify plants', 'error');
    } finally {
      setIsIdentifyingDesignPlants(false);
    }
  };

  useEffect(() => {
    const resolveCollectionName = async () => {
      if (!design.collectionId) {
        setActiveCollectionName(null);
        return;
      }

      const localMatch = collections.find((c) => c.id === design.collectionId);
      if (localMatch) {
        setActiveCollectionName(localMatch.name);
        return;
      }

      try {
        const result = await databaseService.getCollections(user?.id);
        const matched = result.find((c) => c.id === design.collectionId);
        setActiveCollectionName(matched?.name ?? null);
      } catch {
        setActiveCollectionName(null);
      }
    };

    resolveCollectionName();
  }, [collections, design.collectionId, user?.id]);

  const openCollections = async () => {
    try {
      const result = await databaseService.getCollections(user?.id);
      setCollections(result);
      setShowCollectionsModal(true);
    } catch (error) {
      console.error('Failed to load collections:', error);
      setShowCollectionsModal(true);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getImageUri = () => {
    return design.localImagePath || design.generatedImageUri;
  };

  const showModal = () => {
    setShowInfoModal(true);
    modalTranslateY.value = withTiming(modalOpenY, { duration: 300 });
    backdropOpacity.value = withTiming(0.5, { duration: 300 });
  };

  const hideModal = () => {
    modalTranslateY.value = withTiming(screenHeight, { duration: 300 });
    backdropOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(() => setShowInfoModal(false), 300);
  };

  const openRefineModal = () => {
    setShowRefineModal(true);
  };

  const closeRefineModal = () => {
    setShowRefineModal(false);
  };

  const submitRefinement = () => {
    const prompt = refinementInput.trim();
    if (!prompt) {
      Alert.alert('Add a refinement', 'Describe what you want to change before generating a new version.');
      return;
    }

    const userMessage: RefinementMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
    };
    const assistantMessage: RefinementMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: 'Generating a new iteration with your latest refinement.',
    };

    setRefinementMessages((prev) => [...prev, userMessage, assistantMessage]);
    setRefinementInput('');
    setShowRefineModal(false);
    showToast('Starting refinement', 'info');
    onRefineDesign(design, prompt);
  };

  const toggleFavorite = async () => {
    try {
      await databaseService.toggleFavorite(design.id);
      setDesign(prev => {
        const nextFavorite = !prev.isFavorite;
        const updated = {
          ...prev,
          isFavorite: nextFavorite,
        };
        setDesignList((prevList) =>
          prevList.map((item) => (item.id === updated.id ? updated : item))
        );
        showToast(nextFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
        return updated;
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      showToast('Could not update favorite', 'error');
    }
  };

  const deleteDesign = () => {
    Alert.alert(
      'Delete Design',
      'Are you sure you want to delete this design? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteDesign(design.id);
              showToast('Design deleted', 'success');
              onDesignDeleted();
            } catch (error) {
              console.error('Failed to delete design:', error);
              showToast('Could not delete design', 'error');
            }
          },
        },
      ]
    );
  };

  const shareDesign = async () => {
    if (isSharing) return;

    setIsSharing(true);
    try {
      const imageUri = getImageUri();

      if (imageUri.startsWith('data:')) {
        const fileName = `plant_design_${design.id}.png`;
        const tempPath = `${FileSystem.cacheDirectory}${fileName}`;

        const base64Data = imageUri.split(',')[1];
        await FileSystem.writeAsStringAsync(tempPath, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tempPath, {
            mimeType: 'image/png',
            dialogTitle: 'Share Plant Design',
          });
        } else {
          const displayText = getDesignDisplayText(design);
          await Share.share({
            message: displayText.shareMessage,
            title: 'Planterior Design',
          });
        }
      } else if (imageUri.startsWith('file://') || design.localImagePath) {
        const filePath = design.localImagePath || imageUri;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'image/png',
            dialogTitle: 'Share Plant Design',
          });
        }
      } else {
        const displayText = getDesignDisplayText(design);
        await Share.share({
          message: displayText.shareMessage,
          url: imageUri,
          title: 'Planterior Design',
        });
      }
      showToast('Share sheet opened', 'info');
    } catch (error) {
      console.error('Failed to share design:', error);
      showToast('Could not share design', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const saveDesignToDevice = async () => {
    if (isSavingToDevice) return;

    setIsSavingToDevice(true);
    try {
      const didSave = await saveDesignImageToDevice(design);
      if (didSave) {
        showToast('Saved to Photos', 'success');
      }
    } catch (error) {
      console.error('Failed to save design to device:', error);
      showToast('Could not save image', 'error');
    } finally {
      setIsSavingToDevice(false);
    }
  };

  const resetImageTransform = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const commitImageNavigation = (index: number) => {
    const nextDesign = designList[index];
    if (!nextDesign || !isMountedRef.current) {
      isImageTransitioningRef.current = false;
      imageOpacity.value = withTiming(1, { duration: 120 });
      return;
    }

    setCurrentIndex(index);
    setDesign(nextDesign);
    setIsCompareMode(false);
    if (showInfoModal) {
      hideModal();
    }
    resetImageTransform();
    requestAnimationFrame(() => {
      imageOpacity.value = withTiming(1, { duration: 170 });
      isImageTransitioningRef.current = false;
    });
  };

  const navigateToIndex = (index: number) => {
    if (
      index < 0 ||
      index >= designList.length ||
      index === currentIndex ||
      isImageTransitioningRef.current
    ) {
      return;
    }

    isImageTransitioningRef.current = true;
    imageOpacity.value = withTiming(0.28, { duration: 90 }, () => {
      runOnJS(commitImageNavigation)(index);
    });
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      navigateToIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < designList.length - 1) {
      navigateToIndex(currentIndex + 1);
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * event.scale, 3));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Modal pan gesture for pull-to-close (header drag only, downward).
  const modalHeaderPanGesture = Gesture.Pan()
    .activeOffsetY([8, Number.POSITIVE_INFINITY])
    .onUpdate((event) => {
      if (event.translationY < 0) {
        return;
      }
      const newY = modalOpenY + Math.max(0, event.translationY);
      modalTranslateY.value = newY;

      // Update backdrop opacity based on drag distance
      const dragProgress = Math.max(0, event.translationY) / modalHeight;
      backdropOpacity.value = 0.5 * (1 - dragProgress);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        // Close modal if dragged down enough or with sufficient velocity
        runOnJS(hideModal)();
      } else {
        // Snap back to open position
        modalTranslateY.value = withTiming(modalOpenY, { duration: 200 });
        backdropOpacity.value = withTiming(0.5, { duration: 200 });
      }
    });

  const swipeUpGesture = Gesture.Fling()
    .direction(Directions.UP)
    .onEnd(() => {
      if (scale.value <= 1 && !showInfoModal) {
        runOnJS(showModal)();
      }
    });

  const swipeLeftGesture = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => {
      if (scale.value <= 1 && !showInfoModal) {
        runOnJS(goToNext)();
      }
    });

  const swipeRightGesture = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => {
      if (scale.value <= 1 && !showInfoModal) {
        runOnJS(goToPrevious)();
      }
    });

  const imageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const imageFadeStyle = useAnimatedStyle(() => {
    return {
      opacity: imageOpacity.value,
    };
  });

  const modalStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: modalTranslateY.value }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.value,
    };
  });


  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={[styles.detailHeader, { top: insets.top + 6 }]}>
          <AppButton
            variant="icon"
            overlay
            icon="ArrowLeft"
            onPress={onBack}
            accessibilityLabel="Back"
            style={styles.headerBackButton}
            testID="design-detail-back"
          />
          <View style={styles.detailHeaderText}>
            <Text style={styles.detailHeaderTitle} numberOfLines={1}>
              {headerDate}
            </Text>
            <Text style={styles.detailHeaderSubtitle} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          </View>
          <View style={styles.detailHeaderSpacer} />
        </View>

        {/* Full-screen zoomable image */}
        <View style={styles.imageContainer}>
          {isCompareMode ? (
            <BeforeAfterSlider
              originalUri={design.originalImageUri}
              generatedUri={design.generatedImageUri}
            />
          ) : (
            <GestureDetector
              gesture={Gesture.Simultaneous(
                doubleTapGesture,
                pinchGesture,
                panGesture,
                swipeUpGesture,
                swipeLeftGesture,
                swipeRightGesture
              )}
            >
              <Animated.View style={styles.imageWrapper}>
                <Animated.Image
                  source={{ uri: getImageUri() }}
                  style={[styles.image, imageStyle, imageFadeStyle]}
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>
          )}

          {design.collectionId && (
            <View style={[styles.collectionBadge, { bottom: insets.bottom + 138 }]}>
              <Text style={styles.collectionBadgeText} numberOfLines={1}>
                {activeCollectionName || 'Collection'}
              </Text>
            </View>
          )}
          {designList.length > 1 && (
            <View style={[styles.imageCounter, { bottom: insets.bottom + 138 }]}>
              <Text style={styles.imageCounterText}>
                {currentIndex + 1} / {designList.length}
              </Text>
            </View>
          )}

          {/* Refinement trigger temporarily disabled */}
          {false && (
            <Pressable
              onPress={openRefineModal}
              style={({ pressed }) => [styles.aiRefineTrigger, pressed && styles.pressedSurface]}
              accessibilityRole="button"
              accessibilityLabel="Refine this design with AI"
            >
              <View style={styles.aiRefineOuterGlow}>
                <View style={styles.aiRefineInnerRing}>
                  <AppIcon name="Lightning" size={22} color="#d7ffe9" weight="fill" />
                </View>
              </View>
            </Pressable>
          )}
        </View>

        <View style={[styles.bottomDock, { bottom: insets.bottom + 14 }]}>
          <View style={styles.utilityActionsRow}>
            <AppButton
              variant="chip"
              size="sm"
              overlay
              icon="ArrowsClockwise"
              title="Replace Plant"
              onPress={startPlantReplacement}
              style={styles.utilityAction}
              textStyle={styles.utilityActionLabel}
              accessibilityHint="Choose a different plant for this room image"
              testID="design-detail-replace-plant"
            />

            <AppButton
              variant="chip"
              size="sm"
              overlay
              selected={isCompareMode}
              icon="SlidersHorizontal"
              title={isCompareMode ? 'Done' : 'Compare'}
              onPress={toggleCompare}
              style={styles.utilityAction}
              textStyle={styles.utilityActionLabel}
              accessibilityLabel={isCompareMode ? 'Exit compare mode' : 'Compare original and AI design'}
              testID="design-detail-compare"
            />
          </View>

          <View style={styles.bottomActionBar}>
            <AppButton
              variant="ghost"
              overlay
              icon="Heart"
              iconColor={design.isFavorite ? '#ef4444' : undefined}
              iconWeight={design.isFavorite ? 'fill' : 'regular'}
              title="Favorite"
              onPress={toggleFavorite}
              style={styles.dockAction}
              textStyle={styles.dockActionLabel}
              testID="design-detail-favorite"
            />

            <AppButton
              variant="ghost"
              overlay
              icon="FolderPlus"
              title="Collect"
              onPress={openCollections}
              style={styles.dockAction}
              textStyle={styles.dockActionLabel}
              testID="design-detail-collect"
            />

            <AppButton
              variant="ghost"
              overlay
              icon="ShareNetwork"
              title="Share"
              loading={isSharing}
              onPress={shareDesign}
              style={styles.dockAction}
              textStyle={styles.dockActionLabel}
              testID="design-detail-share"
            />

            <AppButton
              variant="ghost"
              overlay
              icon="CaretUp"
              title="More"
              onPress={() => setShowActionsMenu(true)}
              style={styles.dockAction}
              textStyle={styles.dockActionLabel}
              accessibilityLabel="More actions"
              testID="design-detail-more"
            />
          </View>
        </View>

        <ActionSheet
          visible={showActionsMenu}
          title="Design actions"
          onDismiss={() => setShowActionsMenu(false)}
          actions={[
            {
              key: 'details',
              label: 'Details',
              icon: 'Info',
              onPress: () => {
                setShowActionsMenu(false);
                showModal();
              },
            },
            {
              key: 'save',
              label: 'Save to device',
              icon: isSavingToDevice ? 'Hourglass' : 'DownloadSimple',
              loading: isSavingToDevice,
              onPress: () => {
                setShowActionsMenu(false);
                saveDesignToDevice();
              },
            },
            {
              key: 'delete',
              label: 'Delete design',
              icon: 'Trash',
              destructive: true,
              onPress: () => {
                setShowActionsMenu(false);
                deleteDesign();
              },
            },
          ]}
        />

        {/* Custom Animated Modal */}
        {showInfoModal && (
          <>
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, backdropStyle]}>
              <Pressable
                style={styles.backdropTouchable}
                onPress={hideModal}
                accessibilityRole="button"
                accessibilityLabel="Close design details"
              />
            </Animated.View>

            {/* Modal Panel */}
            <Animated.View style={[styles.modalPanel, modalStyle, { height: modalHeight }]}>
              <SafeAreaView edges={['bottom']} style={styles.modalSafeArea}>
                {/* Draggable Header */}
                <GestureDetector gesture={modalHeaderPanGesture}>
                  <Animated.View style={styles.modalHeader}>
                    <Pressable
                      onPress={hideModal}
                      style={styles.modalHeaderTouchable}
                      accessibilityRole="button"
                      accessibilityLabel="Close design details"
                      accessibilityHint="Or swipe down to close"
                    >
                      <View style={styles.modalHandle} />
                    </Pressable>
                  </Animated.View>
                </GestureDetector>

                {/* Modal Content */}
                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Pressable
                    style={({ pressed }) => [styles.quickReplaceButton, pressed && styles.pressedSurface]}
                    onPress={startPlantReplacement}
                    accessibilityRole="button"
                    accessibilityLabel="Replace plant"
                    accessibilityHint="Use this image and choose a different plant"
                  >
                    <View style={styles.quickReplaceIcon}>
                      <AppIcon name="ArrowsClockwise" size={18} color={theme.colors.surface} />
                    </View>
                    <View style={styles.quickReplaceText}>
                      <Text style={styles.quickReplaceTitle}>Replace Plant</Text>
                      <Text style={styles.quickReplaceDescription}>
                        Use this image and choose a different plant
                      </Text>
                    </View>
                    <AppIcon name="CaretRight" size={18} color={theme.colors.textSecondary} />
                  </Pressable>

                  <View style={styles.infoGrid}>
                    {/* Individual plant mode info */}
                    {(design.mode === 'individual' || design.mode === 'replace-plant') && design.individualPlant && (
                      <>
                        <Pressable
                          style={({ pressed }) => [styles.infoItem, pressed && styles.pressedSurface]}
                          onPress={showPlantProfile}
                          accessibilityRole="button"
                          accessibilityLabel={`Plant: ${design.individualPlant.name}`}
                          accessibilityHint="Opens the plant profile"
                        >
                          <AppIcon name="Leaf" size={20} color={theme.colors.primary} />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Plant</Text>
                            <Text style={styles.infoValue}>{design.individualPlant.name}</Text>
                            <Text style={styles.infoDescription}>
                              {design.individualPlant.scientificName}
                            </Text>
                          </View>
                          <AppIcon name="CaretRight" size={16} color={theme.colors.textSecondary} />
                        </Pressable>

                        <View style={styles.infoItem}>
                          <AppIcon name="ArrowsOut" size={20} color={theme.colors.primary} />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Size</Text>
                            <Text style={styles.infoValue}>{design.individualPlant.size}</Text>
                          </View>
                        </View>

                        <View style={styles.infoItem}>
                          <AppIcon name="MapPin" size={20} color={theme.colors.primary} />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>
                              {design.mode === 'replace-plant' ? 'Mode' : 'Placement'}
                            </Text>
                            <Text style={styles.infoValue}>
                              {design.mode === 'replace-plant'
                                ? 'Replacement'
                                : design.individualPlant.placement}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}

                    {/* Multi-plant mode info */}
                    {design.mode === 'multi-plant' && design.plantType && (
                      <View style={styles.infoItem}>
                        <AppIcon name="Leaf" size={20} color={theme.colors.primary} />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Plant Type</Text>
                          <Text style={styles.infoValue}>{design.plantType.name}</Text>
                          <Text style={styles.infoDescription}>
                            {design.plantType.description}
                          </Text>
                        </View>
                      </View>
                    )}

                    {design.mode === 'multi-plant' && design.plantStyle && (
                      <View style={styles.infoItem}>
                        <AppIcon name="Palette" size={20} color={theme.colors.primary} />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Style</Text>
                          <Text style={styles.infoValue}>{design.plantStyle.name}</Text>
                          <Text style={styles.infoDescription}>
                            {design.plantStyle.description}
                          </Text>
                        </View>
                      </View>
                    )}

                    {design.mode === 'multi-plant' && (
                      <View style={styles.infoItem}>
                        <AppIcon name="MagnifyingGlass" size={20} color={theme.colors.primary} />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Plants in this design</Text>
                          {design.generatedPlants && design.generatedPlants.length > 0 ? (
                            <View style={styles.generatedPlantsList}>
                              {design.generatedPlants.map((plant, index) => (
                                <View
                                  key={`${plant.commonName}-${index}`}
                                  style={styles.generatedPlantItem}
                                >
                                  <View style={styles.generatedPlantHeader}>
                                    <Text style={styles.infoValue}>{plant.commonName}</Text>
                                    <Text style={styles.generatedPlantConfidence}>
                                      {Math.round(plant.confidence * 100)}%
                                    </Text>
                                  </View>
                                  {plant.scientificName && (
                                    <Text style={styles.generatedPlantScientific}>
                                      {plant.scientificName}
                                    </Text>
                                  )}
                                  <Text style={styles.infoDescription}>
                                    {plant.visibleCount > 1 ? `${plant.visibleCount} visible • ` : ""}
                                    {plant.placement} • {plant.careLevel} care • {plant.lightRequirement}
                                  </Text>
                                  {plant.notes && (
                                    <Text style={styles.generatedPlantNotes}>{plant.notes}</Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          ) : (
                            <>
                              <Text style={styles.infoDescription}>
                                Get suggested plant matches from the generated image.
                              </Text>
                              <AppButton
                                variant="primary"
                                size="sm"
                                icon="MagnifyingGlass"
                                title={isIdentifyingDesignPlants ? 'Identifying plants...' : 'Identify plants'}
                                loading={isIdentifyingDesignPlants}
                                onPress={identifyGeneratedDesignPlants}
                              />
                            </>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Shopping List is temporarily hidden. The reusable section and nearby-shops modal remain available for reactivation. */}

                    {design.customPrompt && (
                      <View style={styles.infoItem}>
                        <AppIcon name="ChatCircleText" size={20} color={theme.colors.primary} />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Custom Requirements</Text>
                          <Text style={styles.infoDescription}>
                            {design.customPrompt}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.infoItem}>
                      <AppIcon name="Clock" size={20} color={theme.colors.primary} />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Created</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(design.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

              </SafeAreaView>
            </Animated.View>
          </>
        )}

        {/* Refinement modal temporarily disabled */}
        {false && showRefineModal && (
          <KeyboardAvoidingView
            style={[styles.refineOverlay, isKeyboardVisible && styles.refineOverlayKeyboard]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={insets.top + 14}
          >
            <View style={[styles.refinePanel, isKeyboardVisible && styles.refinePanelKeyboard]}>
              <View style={styles.refineHeader}>
                <Text style={styles.refineTitle}>Refine Design</Text>
                <AppButton
                  variant="icon"
                  size="sm"
                  icon="X"
                  onPress={closeRefineModal}
                  accessibilityLabel="Close refine design"
                />
              </View>

              <ScrollView
                style={[styles.refineMessages, isKeyboardVisible && styles.refineMessagesKeyboard]}
                contentContainerStyle={styles.refineMessagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {refinementMessages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.refineMessageBubble,
                      message.role === 'user' ? styles.refineUserBubble : styles.refineAssistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.refineMessageText,
                        message.role === 'user' ? styles.refineUserText : styles.refineAssistantText,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.refineComposer}>
                <TextInput
                  value={refinementInput}
                  onChangeText={setRefinementInput}
                  placeholder="Try: make plants larger and move one near the window"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[styles.refineInput, isKeyboardVisible && styles.refineInputKeyboard]}
                  multiline
                  maxLength={280}
                />
              </View>

              <AppButton
                variant="primary"
                size="md"
                icon="ArrowUpRight"
                title="Generate Iteration"
                onPress={submitRefinement}
                elevated
              />
            </View>
          </KeyboardAvoidingView>
        )}

        <CollectionPickerModal
          visible={showCollectionsModal}
          collections={collections}
          selectedCollectionId={design.collectionId ?? null}
          title="Add to Collection"
          allowNone
          onDismiss={() => setShowCollectionsModal(false)}
          onCreate={async (name) => {
            try {
              const created = await databaseService.createCollection(name, user?.id);
              setCollections((prev) => [created, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
              await databaseService.setDesignCollection(design.id, created.id);
              setDesign((prev) => {
                const updated = { ...prev, collectionId: created.id };
                setDesignList((prevList) =>
                  prevList.map((item) => (item.id === updated.id ? updated : item))
                );
                return updated;
              });
              setShowCollectionsModal(false);
              showToast(`Added to ${created.name}`, 'success');
            } catch (error) {
              console.error('Failed to create/select collection:', error);
              showToast('Could not add to collection', 'error');
            }
          }}
          onSelect={async (collectionId) => {
            try {
              await databaseService.setDesignCollection(design.id, collectionId);
              const selectedCollection = collections.find((c) => c.id === collectionId);
              setDesign((prev) => {
                const updated = { ...prev, collectionId };
                setDesignList((prevList) =>
                  prevList.map((item) => (item.id === updated.id ? updated : item))
                );
                return updated;
              });
              setShowCollectionsModal(false);
              showToast(
                collectionId
                  ? `Moved to ${selectedCollection?.name || 'collection'}`
                  : 'Removed from collection',
                'success'
              );
            } catch (error) {
              console.error('Failed to set collection:', error);
              showToast('Could not update collection', 'error');
            }
          }}
        />

      </View>
    </GestureHandlerRootView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  detailHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,16,16,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  detailHeaderText: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  detailHeaderTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  detailHeaderSubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  detailHeaderSpacer: {
    width: 44,
    height: 44,
  },
  bottomDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 3,
    gap: 10,
  },
  utilityAction: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 17,
  },
  utilityActionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  utilityActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomActionBar: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(10,10,10,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  dockAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'column',
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  dockActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCounter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(16,16,16,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  imageCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  aiRefineTrigger: {
    position: 'absolute',
    right: 16,
    bottom: 26,
  },
  aiRefineOuterGlow: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(67,255,162,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(169,255,214,0.8)',
    shadowColor: '#8effc4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },
  aiRefineInnerRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(194,255,225,0.8)',
    backgroundColor: 'rgba(16,55,35,0.9)',
  },
  collectionBadge: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: screenWidth * 0.6,
    backgroundColor: 'rgba(16,16,16,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  collectionBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  backdropTouchable: {
    flex: 1,
  },
  modalPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalHeaderTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHandle: {
    width: 44,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginRight: 14,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    fontFamily: 'serif',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: theme.colors.borderLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  generatedPlantsList: {
    gap: 12,
  },
  generatedPlantItem: {
    gap: 3,
  },
  generatedPlantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  generatedPlantConfidence: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  generatedPlantScientific: {
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
    marginTop: -2,
  },
  generatedPlantNotes: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  quickReplaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  quickReplaceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  quickReplaceText: {
    flex: 1,
  },
  quickReplaceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  quickReplaceDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  refineOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  refineOverlayKeyboard: {
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  refinePanel: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    maxHeight: screenHeight * 0.72,
  },
  refinePanelKeyboard: {
    maxHeight: screenHeight * 0.45,
    paddingTop: 10,
    paddingBottom: 10,
  },
  refineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  refineTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  refineMessages: {
    maxHeight: screenHeight * 0.34,
  },
  refineMessagesKeyboard: {
    maxHeight: screenHeight * 0.14,
  },
  refineMessagesContent: {
    gap: 8,
    paddingBottom: 12,
  },
  refineMessageBubble: {
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderWidth: 1,
  },
  refineAssistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: theme.colors.borderLight,
    borderColor: theme.colors.border,
  },
  refineUserBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  refineMessageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  refineAssistantText: {
    color: theme.colors.text,
  },
  refineUserText: {
    color: theme.colors.surface,
  },
  refineComposer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    minHeight: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refineInput: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 19,
    textAlignVertical: 'top',
    minHeight: 72,
  },
  refineInputKeyboard: {
    minHeight: 52,
    maxHeight: 84,
  },
  pressedSurface: {
    opacity: 0.8,
  },
});
