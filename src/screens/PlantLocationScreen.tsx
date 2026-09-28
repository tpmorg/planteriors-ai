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

  const plantName = request.individualPlant?.plant.name || 'Plant';
  const plantSize = request.individualPlant?.size || 'medium';

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.container}>
      <View style={styles.header}>
        <AppButton
          variant="icon"
          size="md"
          icon="ArrowLeft"
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <Text style={styles.headerTitle}>{isReplaceMode ? 'Mark Plant' : 'Place Plant'}</Text>
        {hasSelection ? <AppButton
          variant="icon"
          size="md"
          icon="ArrowCounterClockwise"
          onPress={handleReset}
          accessibilityLabel="Reset selection"
          accessibilityHint="Clears the marked area"
        /> : <View style={styles.headerActionSpacer} />}
      </View>

      <View style={styles.guidance}>
        <Text style={styles.guidanceText}>
          {placementMode === 'auto'
            ? `AI will find a natural spot for ${plantName}.`
            : hasSelection
              ? 'Spot selected. Tap or drag to adjust.'
              : isReplaceMode
                ? 'Tap or drag around the plant to replace.'
                : `Tap or drag where the ${plantSize} ${plantName} should go.`}
        </Text>
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

            <Animated.View style={[selectionAnimatedStyle]} pointerEvents="none">
              <View style={styles.selectionBox} />
            </Animated.View>
          </View>
        </GestureDetector>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <View style={styles.footerContent}>
          <AppButton
            variant="primary"
            size="lg"
            title={placementMode === 'auto' ? 'Generate design' : isReplaceMode ? 'Confirm target' : 'Confirm spot'}
            disabled={placementMode === 'choose' && !hasSelection}
            onPress={handleContinue}
            elevated
            fullWidth
          />
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
    headerActionSpacer: {
      width: 48,
      height: 48,
    },
    guidance: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
    },
    guidanceText: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      textAlign: 'center',
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
    selectionBox: {
      flex: 1,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      backgroundColor: theme.isDark ? 'rgba(134, 239, 172, 0.16)' : 'rgba(37, 112, 71, 0.12)',
      borderRadius: 10,
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingBottom: 6,
    },
    footerContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 0,
    },
  });

export default PlantLocationScreen;
