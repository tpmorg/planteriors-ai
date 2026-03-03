import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Collection, SavedDesign } from '../types';
import { databaseService } from '../services/databaseService';
import { useTheme } from '../contexts/ThemeContext';
import { CollectionPickerModal } from '../components/CollectionPickerModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface DesignDetailScreenProps {
  design: SavedDesign;
  designs?: SavedDesign[];
  initialIndex?: number;
  onBack: () => void;
  onDesignDeleted: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Helper function to get design display text
const getDesignDisplayText = (design: SavedDesign): { title: string; subtitle: string; shareMessage: string } => {
  if (design.mode === 'individual' && design.individualPlant) {
    const { name, size, placement } = design.individualPlant;
    const placementLabel = placement === 'auto' ? 'no preference' : placement;
    return {
      title: name,
      subtitle: `${size} • ${placementLabel}`,
      shareMessage: `Check out my plant design! Added a ${size} ${name} (${placementLabel}) to my room.`,
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

export const DesignDetailScreen: React.FC<DesignDetailScreenProps> = ({
  design: initialDesign,
  designs: initialDesigns = [],
  initialIndex = 0,
  onBack,
  onDesignDeleted,
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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionName, setActiveCollectionName] = useState<string | null>(null);
  const { user } = useAuth();
  const { showToast } = useToast();

  // Animated values for image zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Modal animation
  const modalTranslateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);

  const { theme } = useTheme();
  const styles = createStyles(theme);

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

  const resetImageTransform = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const navigateToIndex = (index: number) => {
    if (index < 0 || index >= designList.length) return;
    setCurrentIndex(index);
    setDesign(designList[index]);
    if (showInfoModal) {
      hideModal();
    }
    resetImageTransform();
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

  // Modal pan gesture for pull-to-close
  const modalPanGesture = Gesture.Pan()
    .onUpdate((event) => {
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
      if (!showInfoModal) {
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
        {/* Header with overlay - positioned below status bar */}
        <View style={[styles.header, { top: insets.top }]}>
          <TouchableOpacity onPress={onBack} style={styles.headerButton}>
            <AppIcon name="ArrowLeft" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={showModal}
              style={styles.headerButton}
            >
              <AppIcon name="Info" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity onPress={openCollections} style={styles.headerButton}>
              <AppIcon name="FolderPlus" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleFavorite}
              style={styles.headerButton}
            >
              <AppIcon
                name="Heart"
                size={24}
                color={design.isFavorite ? '#dc2626' : 'white'}
                weight={design.isFavorite ? 'fill' : 'regular'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={shareDesign}
              style={styles.headerButton}
              disabled={isSharing}
            >
              <AppIcon
                name={isSharing ? 'Hourglass' : 'ShareNetwork'}
                size={24}
                color="white"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={deleteDesign} style={styles.headerButton}>
            <AppIcon name="Trash" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Full-screen zoomable image */}
        <View style={styles.imageContainer}>
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
                style={[styles.image, imageStyle]}
                resizeMode="contain"
              />
              {design.collectionId && (
                <View style={styles.collectionBadge}>
                  <Text style={styles.collectionBadgeText} numberOfLines={1}>
                    {activeCollectionName || 'Collection'}
                  </Text>
                </View>
              )}
              {designList.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentIndex + 1} / {designList.length}
                  </Text>
                </View>
              )}
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Custom Animated Modal */}
        {showInfoModal && (
          <>
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, backdropStyle]}>
              <TouchableOpacity
                style={styles.backdropTouchable}
                onPress={hideModal}
                activeOpacity={1}
              />
            </Animated.View>

            {/* Modal Panel */}
            <GestureDetector gesture={modalPanGesture}>
              <Animated.View style={[styles.modalPanel, modalStyle, { height: modalHeight }]}>
                <SafeAreaView edges={['bottom']} style={styles.modalSafeArea}>
                  {/* Draggable Header */}
                  <Animated.View style={styles.modalHeader}>
                    <TouchableOpacity
                      onPress={hideModal}
                      style={styles.modalHeaderTouchable}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalHandle} />
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Modal Content */}
                  <ScrollView
                    style={styles.modalContent}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.infoGrid}>
                      {/* Individual plant mode info */}
                      {design.mode === 'individual' && design.individualPlant && (
                        <>
                          <View style={styles.infoItem}>
                            <AppIcon name="Leaf" size={20} color={theme.colors.primary} />
                            <View style={styles.infoContent}>
                              <Text style={styles.infoLabel}>Plant</Text>
                              <Text style={styles.infoValue}>{design.individualPlant.name}</Text>
                              <Text style={styles.infoDescription}>
                                {design.individualPlant.scientificName}
                              </Text>
                            </View>
                          </View>

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
                              <Text style={styles.infoLabel}>Placement</Text>
                              <Text style={styles.infoValue}>{design.individualPlant.placement}</Text>
                            </View>
                          </View>
                        </>
                      )}

                      {/* Multi-plant mode info */}
                      {design.mode !== 'individual' && design.plantType && (
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

                      {design.mode !== 'individual' && design.plantStyle && (
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
            </GestureDetector>
          </>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.34)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerButton: {
    padding: 9,
    borderRadius: 22,
    backgroundColor: 'rgba(16,16,16,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
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
    bottom: 30,
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
  collectionBadge: {
    position: 'absolute',
    bottom: 30,
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
});
