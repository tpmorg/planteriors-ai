import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, Text } from 'react-native';
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
import { AppIcon } from './AppIcon';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { theme } = useTheme();

  // Animation values
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const driftX = useSharedValue(-10);
  const glowOpacity = useSharedValue(0.45);

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

    driftX.value = withRepeat(
      withTiming(10, {
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withTiming(0.8, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const animatedBlobStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: driftX.value }],
      opacity: glowOpacity.value,
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Animated.View
        style={[
          styles.blobA,
          {
            backgroundColor: theme.isDark ? 'rgba(86,194,138,0.2)' : 'rgba(78,107,87,0.15)',
          },
          animatedBlobStyle,
        ]}
      />
      <View
        style={[
          styles.blobB,
          {
            backgroundColor: theme.isDark ? 'rgba(181,122,82,0.17)' : 'rgba(181,122,82,0.12)',
          },
        ]}
      />
      <View style={styles.leafTop}>
        <AppIcon
          name="Leaf"
          size={100}
          color={theme.isDark ? 'rgba(86,194,138,0.23)' : 'rgba(47,122,82,0.16)'}
        />
      </View>
      <View style={styles.leafBottom}>
        <AppIcon
          name="Plant"
          size={96}
          color={theme.isDark ? 'rgba(181,122,82,0.22)' : 'rgba(181,122,82,0.17)'}
        />
      </View>

      <Animated.View style={[styles.logoContainer, animatedStyle]}>
        <View style={[styles.logoRing, { borderColor: theme.colors.border }]} />
        <Image
          source={theme.isDark ? require('../../assets/logo-dark.png') : require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={[styles.title, { color: theme.colors.text }]}>Planterior AI</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Curating your space
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blobA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: 90,
    left: -80,
  },
  blobB: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    bottom: -80,
    right: -100,
  },
  leafTop: {
    position: 'absolute',
    top: 110,
    right: 12,
    transform: [{ rotate: '-16deg' }],
  },
  leafBottom: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    transform: [{ rotate: '12deg' }],
  },
  logoContainer: {
    width: width * 0.6,
    maxWidth: 400,
    aspectRatio: 1, // Square logo (1024x1024)
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoRing: {
    position: 'absolute',
    width: '88%',
    height: '88%',
    borderRadius: 999,
    borderWidth: 1,
  },
  logo: {
    width: '78%',
    height: '78%',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'serif',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
