import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';
import { PlantLocation, GenerationRequest } from '../types';

interface PlantLocationScreenProps {
  imageUri: string;
  request: Omit<GenerationRequest, 'imageUri' | 'location'>;
  onLocationSelected: (location: PlantLocation | null) => void;
  onBack: () => void;
  initialPlacementMode?: 'choose' | 'auto';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_SELECTION_SIZE = 50; // Minimum selection size in pixels

export const PlantLocationScreen: React.FC<PlantLocationScreenProps> = ({
  imageUri,
  request,
  onLocationSelected,
  onBack,
  initialPlacementMode = 'auto',
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Image container dimensions
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Selection state
  const [hasSelection, setHasSelection] = useState(false);
  const [placementMode, setPlacementMode] = useState<'choose' | 'auto'>(initialPlacementMode);

  // Gesture state for drawing the rectangle
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const selectionX = useSharedValue(0);
  const selectionY = useSharedValue(0);
  const selectionWidth = useSharedValue(0);
  const selectionHeight = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Reference for final selection (for submission)
  const finalSelection = useRef<PlantLocation | null>(null);

  const updateHasSelection = (has: boolean) => {
    setHasSelection(has);
  };

  const updateFinalSelection = (x: number, y: number, width: number, height: number) => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      finalSelection.current = {
        x: x / containerSize.width,
        y: y / containerSize.height,
        width: width / containerSize.width,
        height: height / containerSize.height,
      };
    }
  };

  // Pan gesture for creating/resizing selection
  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      startX.value = e.x;
      startY.value = e.y;
      selectionX.value = e.x;
      selectionY.value = e.y;
      selectionWidth.value = 0;
      selectionHeight.value = 0;
      isDragging.value = true;
    })
    .onUpdate((e) => {
      // Calculate the rectangle from start point to current point
      const currentX = Math.max(0, Math.min(e.x, containerSize.width));
      const currentY = Math.max(0, Math.min(e.y, containerSize.height));

      // Handle dragging in any direction
      const minX = Math.min(startX.value, currentX);
      const maxX = Math.max(startX.value, currentX);
      const minY = Math.min(startY.value, currentY);
      const maxY = Math.max(startY.value, currentY);

      selectionX.value = minX;
      selectionY.value = minY;
      selectionWidth.value = maxX - minX;
      selectionHeight.value = maxY - minY;
    })
    .onEnd(() => {
      isDragging.value = false;

      // Check if selection meets minimum size
      const width = selectionWidth.value;
      const height = selectionHeight.value;

      if (width >= MIN_SELECTION_SIZE && height >= MIN_SELECTION_SIZE) {
        runOnJS(updateHasSelection)(true);
        runOnJS(updateFinalSelection)(
          selectionX.value,
          selectionY.value,
          width,
          height
        );
      } else {
        // Selection too small, reset
        selectionWidth.value = withSpring(0);
        selectionHeight.value = withSpring(0);
        runOnJS(updateHasSelection)(false);
      }
    });

  // Animated style for the selection rectangle
  const selectionAnimatedStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: selectionX.value,
      top: selectionY.value,
      width: selectionWidth.value,
      height: selectionHeight.value,
      opacity: selectionWidth.value > 0 && selectionHeight.value > 0 ? 1 : 0,
    };
  });

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleReset = () => {
    selectionX.value = 0;
    selectionY.value = 0;
    selectionWidth.value = withSpring(0);
    selectionHeight.value = withSpring(0);
    setHasSelection(false);
    finalSelection.current = null;
  };

  const handleContinue = () => {
    if (placementMode === 'auto') {
      onLocationSelected(null);
      return;
    }
    if (finalSelection.current) {
      onLocationSelected(finalSelection.current);
    }
  };

  const handleModeChange = (mode: 'choose' | 'auto') => {
    setPlacementMode(mode);
    if (mode === 'auto') {
      handleReset();
    }
  };

  const plantName = request.individualPlant?.plant.name || 'Plant';
  const plantSize = request.individualPlant?.size || 'medium';
  const isReplaceMode = request.mode === 'replace-plant';

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppIcon name="ArrowLeft" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isReplaceMode ? 'Mark Plant' : 'Place Plant'}</Text>
        <TouchableOpacity
          onPress={handleReset}
          style={[styles.resetButton, !hasSelection && styles.resetButtonDisabled]}
          disabled={!hasSelection}
        >
          <AppIcon
            name="ArrowCounterClockwise"
            size={20}
            color={hasSelection ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructionContainer}>
        <View style={styles.instructionIcon}>
          <AppIcon name="ArrowsOutCardinal" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>
            {isReplaceMode
              ? `Place ${plantName} in the same spot`
              : `Place ${plantName} exactly where you want it`}
          </Text>
          <Text style={styles.instructionSubtitle}>
            {isReplaceMode
              ? 'Drag a box around the current plant so the replacement stays in place.'
              : `Drag a box where the ${plantSize} plant should go.`}
          </Text>
        </View>
      </View>

      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            placementMode === 'choose' && styles.modeButtonActive,
          ]}
          onPress={() => handleModeChange('choose')}
        >
          <Text
            style={[
              styles.modeButtonText,
              placementMode === 'choose' && styles.modeButtonTextActive,
            ]}
          >
            Choose exact spot
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton,
            placementMode === 'auto' && styles.modeButtonActive,
          ]}
          onPress={() => handleModeChange('auto')}
        >
          <Text
            style={[
              styles.modeButtonText,
              placementMode === 'auto' && styles.modeButtonTextActive,
            ]}
          >
            {isReplaceMode ? 'Let AI find the plant' : 'Let AI choose the spot'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Image with Selection Area */}
      <View style={styles.imageSection}>
        <GestureDetector gesture={panGesture}>
          <View
            style={styles.imageContainer}
            onLayout={handleContainerLayout}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.roomImage}
              resizeMode="contain"
            />

            {/* Dark overlay outside selection when has selection */}
            {hasSelection && (
              <View style={styles.overlay} pointerEvents="none" />
            )}

            {/* Selection Rectangle */}
            <Animated.View style={[selectionAnimatedStyle]} pointerEvents="none">
              <View style={styles.selectionBox}>
                {/* Corner handles */}
                <View style={[styles.cornerHandle, styles.topLeft]} />
                <View style={[styles.cornerHandle, styles.topRight]} />
                <View style={[styles.cornerHandle, styles.bottomLeft]} />
                <View style={[styles.cornerHandle, styles.bottomRight]} />

                {/* Center indicator */}
                <View style={styles.centerIndicator}>
                  <AppIcon
                    name={request.individualPlant?.plant.icon || 'Leaf'}
                    size={24}
                    color={theme.colors.primary}
                    style={styles.plantEmoji}
                  />
                </View>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>

        <View
          style={[
            styles.selectionInfo,
            !(hasSelection && placementMode === 'choose') && styles.selectionInfoHidden,
          ]}
          pointerEvents="none"
        >
          <View style={styles.selectionInfoRow}>
            <AppIcon name={request.individualPlant?.plant.icon || 'Leaf'} size={14} color={theme.colors.primary} />
            <Text style={styles.selectionInfoText}>
              {isReplaceMode
                ? `${plantName} will replace the marked plant`
                : `${plantName} will be placed in the selected area`}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.footerContent}>
          {placementMode === 'choose' && !hasSelection ? (
            <Text style={styles.footerHint}>
              {isReplaceMode
                ? 'Tap and drag around the plant you want replaced'
                : 'Tap and drag to mark the exact spot'}
            </Text>
          ) : placementMode === 'choose' ? (
            <View style={styles.selectionPreview}>
              <Text style={styles.selectionPreviewText}>
                Selected area
              </Text>
            </View>
          ) : (
            <View style={styles.selectionPreview}>
              <Text style={styles.selectionPreviewText}>
                {isReplaceMode
                  ? 'AI will identify the current plant to replace'
                  : 'AI will choose the most realistic placement'}
              </Text>
            </View>
          )}

          {placementMode === 'choose' ? (
            <View style={styles.placementActions}>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleReset}
                disabled={!hasSelection}
              >
                <Text style={[styles.retryButtonText, !hasSelection && styles.retryButtonTextDisabled]}>
                  Retry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  !hasSelection && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!hasSelection}
              >
                <Text style={styles.continueButtonText}>Generate Preview</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
            >
              <Text style={styles.continueButtonText}>Generate Preview</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    resetButton: {
      padding: 8,
    },
    resetButtonDisabled: {
      opacity: 0.5,
    },
    instructionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: 8,
      marginBottom: 4,
    },
    instructionIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.isDark ? 'rgba(134, 239, 172, 0.15)' : '#ecfdf5',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    instructionText: {
      flex: 1,
    },
    instructionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    instructionSubtitle: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    modeToggle: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 10,
      paddingBottom: 6,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modeButton: {
      flex: 1,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeButtonActive: {
      backgroundColor: theme.isDark ? 'rgba(134, 239, 172, 0.15)' : '#ecfdf5',
      borderColor: theme.colors.primary,
    },
    modeButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    modeButtonTextActive: {
      color: theme.colors.primary,
    },
    imageSection: {
      flex: 8,
      position: 'relative',
      backgroundColor: theme.isDark ? '#1a1a1a' : '#f0f0f0',
    },
    imageContainer: {
      flex: 1,
      position: 'relative',
    },
    roomImage: {
      width: '100%',
      height: '100%',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    selectionBox: {
      flex: 1,
      borderWidth: 3,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      backgroundColor: 'rgba(134, 239, 172, 0.2)',
      borderRadius: 8,
    },
    cornerHandle: {
      position: 'absolute',
      width: 16,
      height: 16,
      backgroundColor: theme.colors.primary,
      borderRadius: 3,
    },
    topLeft: {
      top: -8,
      left: -8,
    },
    topRight: {
      top: -8,
      right: -8,
    },
    bottomLeft: {
      bottom: -8,
      left: -8,
    },
    bottomRight: {
      bottom: -8,
      right: -8,
    },
    centerIndicator: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -24 }, { translateY: -24 }],
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    plantEmoji: {
      fontSize: 24,
    },
    selectionInfo: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      borderRadius: 10,
      backgroundColor: theme.isDark ? 'rgba(134, 239, 172, 0.15)' : '#ecfdf5',
      paddingVertical: 8,
      paddingHorizontal: 12,
      minHeight: 36,
      justifyContent: 'center',
      zIndex: 3,
    },
    selectionInfoHidden: {
      height: 0,
      minHeight: 0,
      marginTop: 0,
      paddingVertical: 0,
      opacity: 0,
    },
    selectionInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    selectionInfoText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
      textAlign: 'center',
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingBottom: 6,
    },
    footerContent: {
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 6,
    },
    footerHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    selectionPreview: {
      marginBottom: 12,
    },
    selectionPreviewText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
      textAlign: 'center',
    },
    continueButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    continueButtonDisabled: {
      backgroundColor: '#9ca3af',
    },
    continueButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    placementActions: {
      flexDirection: 'row',
      gap: 10,
    },
    retryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    retryButtonText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    retryButtonTextDisabled: {
      color: theme.colors.textSecondary,
    },
  });

export default PlantLocationScreen;
