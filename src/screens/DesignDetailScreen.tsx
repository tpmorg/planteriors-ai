import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Dimensions,
  Modal,
  ScrollView,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { SavedDesign } from '../types';
import { databaseService } from '../services/databaseService';

interface DesignDetailScreenProps {
  design: SavedDesign;
  onBack: () => void;
  onDesignDeleted: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Helper function to get design display text
const getDesignDisplayText = (design: SavedDesign): { title: string; subtitle: string; shareMessage: string } => {
  if (design.mode === 'individual' && design.individualPlant) {
    const { name, size, placement } = design.individualPlant;
    return {
      title: name,
      subtitle: `${size} • ${placement}`,
      shareMessage: `Check out my plant design! Added a ${size} ${name} (${placement}) to my room.`,
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
  onBack,
  onDesignDeleted,
}) => {
  const insets = useSafeAreaInsets();
  const [design, setDesign] = useState<SavedDesign>(initialDesign);
  const [isSharing, setIsSharing] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

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
    modalTranslateY.value = withTiming(screenHeight * 0.5, { duration: 300 });
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
      setDesign(prev => ({
        ...prev,
        isFavorite: !prev.isFavorite,
      }));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      Alert.alert('Error', 'Failed to update favorite');
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
              onDesignDeleted();
            } catch (error) {
              console.error('Failed to delete design:', error);
              Alert.alert('Error', 'Failed to delete design');
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
    } catch (error) {
      console.error('Failed to share design:', error);
      Alert.alert('Error', 'Failed to share design');
    } finally {
      setIsSharing(false);
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

  // Modal pan gesture for pull-to-close
  const modalPanGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newY = screenHeight * 0.5 + Math.max(0, event.translationY);
      modalTranslateY.value = newY;

      // Update backdrop opacity based on drag distance
      const dragProgress = Math.max(0, event.translationY) / (screenHeight * 0.5);
      backdropOpacity.value = 0.5 * (1 - dragProgress);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        // Close modal if dragged down enough or with sufficient velocity
        runOnJS(hideModal)();
      } else {
        // Snap back to 50% position
        modalTranslateY.value = withTiming(screenHeight * 0.5, { duration: 200 });
        backdropOpacity.value = withTiming(0.5, { duration: 200 });
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
      <View style={styles.container}>
        {/* Header with overlay - positioned below status bar */}
        <View style={[styles.header, { top: insets.top }]}>
          <TouchableOpacity onPress={onBack} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={showModal}
              style={styles.headerButton}
            >
              <Ionicons name="information-circle-outline" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleFavorite}
              style={styles.headerButton}
            >
              <Ionicons
                name={design.isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={design.isFavorite ? '#dc2626' : 'white'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={shareDesign}
              style={styles.headerButton}
              disabled={isSharing}
            >
              <Ionicons
                name={isSharing ? 'hourglass-outline' : 'share-outline'}
                size={24}
                color="white"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={deleteDesign} style={styles.headerButton}>
              <Ionicons name="trash-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Full-screen zoomable image */}
        <View style={styles.imageContainer}>
          <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
            <Animated.View style={styles.imageWrapper}>
              <Animated.Image
                source={{ uri: getImageUri() }}
                style={[styles.image, imageStyle]}
                resizeMode="contain"
              />
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
            <Animated.View style={[styles.modalPanel, modalStyle]}>
              {/* Draggable Header */}
              <GestureDetector gesture={modalPanGesture}>
                <Animated.View style={styles.modalHeader}>
                  <TouchableOpacity
                    onPress={hideModal}
                    style={styles.modalHeaderTouchable}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalHandle} />
                    <Text style={styles.modalTitle}>Design Details</Text>
                  </TouchableOpacity>
                </Animated.View>
              </GestureDetector>

              {/* Modal Content */}
              <ScrollView style={styles.modalContent}>
                {(() => {
                  const displayText = getDesignDisplayText(design);
                  return (
                    <View style={styles.titleSection}>
                      <Text style={styles.plantTypeTitle}>{displayText.title}</Text>
                      <Text style={styles.plantStyleSubtitle}>
                        {displayText.subtitle}
                      </Text>
                    </View>
                  );
                })()}

                <View style={styles.infoGrid}>
                  {/* Individual plant mode info */}
                  {design.mode === 'individual' && design.individualPlant && (
                    <>
                      <View style={styles.infoItem}>
                        <Ionicons name="leaf-outline" size={20} color="#2d5016" />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Plant</Text>
                          <Text style={styles.infoValue}>{design.individualPlant.name}</Text>
                          <Text style={styles.infoDescription}>
                            {design.individualPlant.scientificName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.infoItem}>
                        <Ionicons name="resize-outline" size={20} color="#2d5016" />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Size</Text>
                          <Text style={styles.infoValue}>{design.individualPlant.size}</Text>
                        </View>
                      </View>

                      <View style={styles.infoItem}>
                        <Ionicons name="location-outline" size={20} color="#2d5016" />
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
                      <Ionicons name="leaf-outline" size={20} color="#2d5016" />
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
                      <Ionicons name="color-palette-outline" size={20} color="#2d5016" />
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
                      <Ionicons name="chatbox-outline" size={20} color="#2d5016" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Custom Requirements</Text>
                        <Text style={styles.infoDescription}>
                          {design.customPrompt}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.infoItem}>
                    <Ionicons name="time-outline" size={20} color="#2d5016" />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Created</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(design.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          </>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    height: screenHeight * 0.5,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalHeaderTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d5016',
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  plantTypeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d5016',
    textAlign: 'center',
  },
  plantStyleSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  infoGrid: {
    gap: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d5016',
    marginBottom: 2,
  },
  infoDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
});