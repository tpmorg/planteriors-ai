import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { theme } = useTheme();

  // Animation values
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    // Entry animation
    opacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });

    // After entry, start breathing animation
    setTimeout(() => {
      scale.value = withRepeat(
        withTiming(1.05, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1, // Infinite repeat
        true // Reverse (creates the pulse effect: 1.0 → 1.05 → 1.0)
      );
    }, 300);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      <Animated.View style={[styles.logoContainer, animatedStyle]}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: width * 0.6,
    maxWidth: 400,
    aspectRatio: 1, // Square logo (1024x1024)
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});
