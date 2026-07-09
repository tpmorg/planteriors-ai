import React from 'react';
import { View, StyleSheet, Image, Text, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

interface BeforeAfterSliderProps {
  originalUri: string;
  generatedUri: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalUri,
  generatedUri,
}) => {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0.5);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      progress.value = Math.max(0.05, Math.min(0.95, event.x / width));
    });

  const overlayStyle = useAnimatedStyle(() => ({
    width: width * progress.value,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: width * progress.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.container, { width, height }]}>
        {/* Generated image (background) */}
        <Image
          source={{ uri: generatedUri }}
          style={styles.image}
          resizeMode="contain"
        />

        {/* Original image overlay, clipped by animated width */}
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Image
            source={{ uri: originalUri }}
            style={[styles.image, { width }]}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Labels — positioned at the bottom corners of the image area */}
        <View style={[styles.label, styles.labelOriginal]}>
          <View style={styles.labelPill}>
            <Text style={styles.labelText}>Original</Text>
          </View>
        </View>
        <View style={[styles.label, styles.labelGenerated]}>
          <View style={styles.labelPill}>
            <Text style={styles.labelText}>AI</Text>
          </View>
        </View>

        {/* Draggable handle */}
        <Animated.View style={[styles.handle, handleStyle]}>
          <View style={styles.handleTrack} />
          <View style={styles.handleKnob}>
            <View style={styles.arrowLeft} />
            <View style={styles.arrowRight} />
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  handleKnob: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  arrowLeft: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#111',
    marginRight: 1,
  },
  arrowRight: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#111',
    marginLeft: 1,
  },
  label: {
    position: 'absolute',
    bottom: 100,
    zIndex: 2,
  },
  labelOriginal: {
    left: 16,
  },
  labelGenerated: {
    right: 16,
  },
  labelPill: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  labelText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
