import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { AppButton } from '../components/AppButton';
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
  initialPlacementMode = 'choose',
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Image container dimensions
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Selection state
  const [hasSelection, setHasSelection] = useState(false);
  const isReplaceMode = request.mode === 'replace-plant';
  const [placementMode, setPlacementMode] = useState<'choose' | 'auto'>(
    isReplaceMode ? 'choose' : initialPlacementMode
  );

  useEffect(() => {
    Image.getSize(imageUri, (width, height) => setImageSize({ width, height }), () => setImageSize({ width: 0, height: 0 }));
  }, [imageUri]);

  const imageFrame = useMemo(() => {
    if (!containerSize.width || !containerSize.height || !imageSize.width || !imageSize.height) {
      return { x: 0, y: 0, width: containerSize.width, height: containerSize.height };
    }
    const scale = Math.min(containerSize.width / imageSize.width, containerSize.height / imageSize.height);
    const width = imageSize.width * scale;
    const height = imageSize.height * scale;
    return { x: (containerSize.width - width) / 2, y: (containerSize.height - height) / 2, width, height };
  }, [containerSize, imageSize]);

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
    if (imageFrame.width > 0 && imageFrame.height > 0) {
      finalSelection.current = {
        x: Math.max(0, Math.min(1, (x - imageFrame.x) / imageFrame.width)),
        y: Math.max(0, Math.min(1, (y - imageFrame.y) / imageFrame.height)),
        width: Math.max(0, Math.min(1, width / imageFrame.width)),
        height: Math.max(0, Math.min(1, height / imageFrame.height)),
      };
    }
  };

  // Pan gesture for creating/resizing selection
  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      const x = Math.max(imageFrame.x, Math.min(e.x, imageFrame.x + imageFrame.width));
      const y = Math.max(imageFrame.y, Math.min(e.y, imageFrame.y + imageFrame.height));
      startX.value = x;
      startY.value = y;
      selectionX.value = x;
      selectionY.value = y;
      selectionWidth.value = 0;
      selectionHeight.value = 0;
      isDragging.value = true;
    })
    .onUpdate((e) => {
      // Calculate the rectangle from start point to current point
      const currentX = Math.max(imageFrame.x, Math.min(e.x, imageFrame.x + imageFrame.width));
      const currentY = Math.max(imageFrame.y, Math.min(e.y, imageFrame.y + imageFrame.height));

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

  const tapGesture = Gesture.Tap().onEnd((event) => {
    const width = Math.min(110, imageFrame.width * 0.35);
    const height = Math.min(140, imageFrame.height * 0.4);
    const x = Math.max(imageFrame.x, Math.min(imageFrame.x + imageFrame.width - width, event.x - width / 2));
    const y = Math.max(imageFrame.y, Math.min(imageFrame.y + imageFrame.height - height, event.y - height / 2));
    selectionX.value = x;
    selectionY.value = y;
    selectionWidth.value = withSpring(width);
    selectionHeight.value = withSpring(height);
    runOnJS(updateHasSelection)(true);
    runOnJS(updateFinalSelection)(x, y, width, height);
  });
  const selectionGesture = Gesture.Race(panGesture, tapGesture);

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
    if (isReplaceMode && mode === 'auto') return;
    setPlacementMode(mode);
    if (mode === 'auto') {
      handleReset();
    }
  };

  const nudgeSelection = (dx: number, dy: number) => {
    const x = Math.max(imageFrame.x, Math.min(imageFrame.x + imageFrame.width - selectionWidth.value, selectionX.value + dx));
    const y = Math.max(imageFrame.y, Math.min(imageFrame.y + imageFrame.height - selectionHeight.value, selectionY.value + dy));
    selectionX.value = withSpring(x);
    selectionY.value = withSpring(y);
    updateFinalSelection(x, y, selectionWidth.value, selectionHeight.value);
  };

  const plantName = request.individualPlant?.plant.name || 'Plant';
  const plantSize = request.individualPlant?.size || 'medium';

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <AppButton
          variant="icon"
          size="md"
          icon="ArrowLeft"
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <Text style={styles.headerTitle}>{isReplaceMode ? 'Mark Plant' : 'Place Plant'}</Text>
        <AppButton
          variant="icon"
          size="md"
          icon="ArrowCounterClockwise"
          onPress={handleReset}
          disabled={!hasSelection}
          accessibilityLabel="Reset selection"
          accessibilityHint="Clears the marked area"
        />
      </View>

      {/* Instructions */}
      <View style={styles.instructionContainer}>
        <View style={styles.instructionIcon}>
          <AppIcon name="ArrowsOutCardinal" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>
            {isReplaceMode
              ? 'Mark the plant you want to replace'
              : `Place ${plantName} exactly where you want it`}
          </Text>
          <Text style={styles.instructionSubtitle}>
            {isReplaceMode
              ? 'Drag a box around the current plant so the replacement stays in place.'
              : `Drag a box where the ${plantSize} plant should go.`}
          </Text>
        </View>
      </View>

      {!isReplaceMode ? <View style={styles.modeToggle}>
        <AppButton
          variant="chip"
          selected={placementMode === 'choose'}
          title="Choose exact spot"
          textStyle={styles.modeButtonText}
          onPress={() => handleModeChange('choose')}
          style={styles.modeButton}
        />
        <AppButton
          variant="chip"
          selected={placementMode === 'auto'}
          title="Let AI choose the spot"
          textStyle={styles.modeButtonText}
          onPress={() => handleModeChange('auto')}
          style={styles.modeButton}
        />
      </View> : null}

      {/* Image with Selection Area */}
      <View style={styles.imageSection}>
        <GestureDetector gesture={selectionGesture}>
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
              <View style={styles.adjustRow}>
                <AppButton variant="icon" size="sm" icon="ArrowLeft" onPress={() => nudgeSelection(-8, 0)} accessibilityLabel="Move selection left" />
                <AppButton variant="icon" size="sm" icon="ArrowUp" onPress={() => nudgeSelection(0, -8)} accessibilityLabel="Move selection up" />
                <AppButton variant="icon" size="sm" icon="ArrowDown" onPress={() => nudgeSelection(0, 8)} accessibilityLabel="Move selection down" />
                <AppButton variant="icon" size="sm" icon="ArrowRight" onPress={() => nudgeSelection(8, 0)} accessibilityLabel="Move selection right" />
              </View>
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
              <AppButton
                variant="secondary"
                size="lg"
                icon="ArrowCounterClockwise"
                title="Reset"
                disabled={!hasSelection}
                onPress={handleReset}
                style={styles.placementAction}
              />
              <AppButton
                variant="primary"
                size="lg"
                title={isReplaceMode ? 'Confirm target' : 'Confirm spot'}
                disabled={!hasSelection}
                onPress={handleContinue}
                elevated
                style={styles.placementAction}
              />
            </View>
          ) : (
            <AppButton
              variant="primary"
              size="lg"
              title="Use automatic placement"
              onPress={handleContinue}
              elevated
            />
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
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.primary,
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
    },
    modeButtonText: {
      fontSize: 12,
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
      borderRadius: 14,
      backgroundColor: theme.colors.borderLight,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    selectionPreviewText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
      textAlign: 'center',
    },
    adjustRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
    },
    placementAction: {
      flex: 1,
    },
    placementActions: {
      flexDirection: 'row',
      gap: 10,
    },
  });

export default PlantLocationScreen;
