import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  beforeLabel?: string;
  afterLabel?: string;
  modeTitle?: string;
  modeDescription?: string;
}

interface OnboardingScreenProps {
  fromSettings?: boolean;
  onComplete: () => Promise<void> | void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  fromSettings = false,
  onComplete,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const slides: OnboardingSlide[] = [
    {
      id: 'welcome',
      title: 'Welcome to Planterior AI',
      description:
        'Turn real room photos into polished plant-forward interiors with guided AI layouts.',
    },
    {
      id: 'before-after',
      title: 'See the Transformation',
      description:
        'Use your own room photo and generate an after-image that feels magazine-ready and realistic.',
      beforeLabel: 'Before',
      afterLabel: 'After',
    },
    {
      id: 'single-mode',
      title: 'Single Plant Mode',
      description:
        'Pick one exact plant, choose its size and placement, and preview it naturally in your space.',
      modeTitle: 'Great for precision',
      modeDescription: 'Perfect when you know the plant you want to test.',
    },
    {
      id: 'multi-mode',
      title: 'Multi-Plant Mode',
      description:
        'Choose a style direction and let AI compose multiple plants for a cohesive interior look.',
      modeTitle: 'Great for inspiration',
      modeDescription: 'Best for discovering a complete look quickly.',
    },
  ];

  const isLast = currentIndex === slides.length - 1;

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    setCurrentIndex(Math.max(0, Math.min(slides.length - 1, newIndex)));
  };

  const handleBack = () => {
    if (currentIndex === 0) {
      return;
    }
    listRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    setCurrentIndex((prev) => prev - 1);
  };

  const handleContinue = async () => {
    if (!isLast) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    setIsCompleting(true);
    try {
      await onComplete();
    } finally {
      setIsCompleting(false);
    }
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View style={styles.card}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDescription}>{item.description}</Text>

        {item.beforeLabel && item.afterLabel && (
          <View style={styles.beforeAfterRow}>
            <View style={styles.imageMock}>
              <View style={styles.mockHeader}>
                <AppIcon name="ImageSquare" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.mockHeaderText}>{item.beforeLabel}</Text>
              </View>
              <View style={styles.mockArtBefore} />
              <Text style={styles.mockCaption}>Placeholder image</Text>
            </View>

            <View style={styles.imageMock}>
              <View style={styles.mockHeader}>
                <AppIcon name="Sparkle" size={16} color={theme.colors.primary} />
                <Text style={styles.mockHeaderText}>{item.afterLabel}</Text>
              </View>
              <View style={styles.mockArtAfter} />
              <Text style={styles.mockCaption}>Generated preview</Text>
            </View>
          </View>
        )}

        {item.modeTitle && item.modeDescription && (
          <View style={styles.modeInfo}>
            <View style={styles.modeRow}>
              <AppIcon
                name={item.id === 'single-mode' ? 'Plant' : 'SquaresFour'}
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.modeTitle}>{item.modeTitle}</Text>
            </View>
            <Text style={styles.modeDescription}>{item.modeDescription}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />

      <View style={styles.header}>
        <Text style={styles.headerText}>
          {fromSettings ? 'Onboarding Preview' : 'Getting Started'}
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH}
        snapToAlignment="center"
        contentContainerStyle={styles.slidesContainer}
        onMomentumScrollEnd={handleScrollEnd}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[styles.dot, index === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Text style={styles.swipeHint}>Swipe to explore • use back/continue anytime</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, currentIndex === 0 && styles.secondaryButtonDisabled]}
            onPress={handleBack}
            disabled={currentIndex === 0 || isCompleting}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, isCompleting && styles.primaryButtonDisabled]}
            onPress={handleContinue}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {isLast ? (fromSettings ? 'Done' : 'Get Started') : 'Continue'}
                </Text>
                <AppIcon
                  name={isLast ? 'CheckCircle' : 'ArrowRight'}
                  size={18}
                  color={theme.colors.surface}
                />
              </>
            )}
          </TouchableOpacity>
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
    backdropBlobA: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: theme.isDark ? 'rgba(143,179,154,0.12)' : 'rgba(78,107,87,0.11)',
      top: -90,
      left: -90,
    },
    backdropBlobB: {
      position: 'absolute',
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: theme.isDark ? 'rgba(181,122,82,0.08)' : 'rgba(181,122,82,0.08)',
      bottom: -120,
      right: -90,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 10,
    },
    headerText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    slidesContainer: {
      paddingHorizontal: 20,
    },
    slide: {
      width: CARD_WIDTH,
      paddingRight: 8,
    },
    card: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 22,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.isDark ? 0.26 : 0.1,
      shadowRadius: 18,
      elevation: 5,
    },
    slideTitle: {
      fontSize: 33,
      lineHeight: 40,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'serif',
    },
    slideDescription: {
      marginTop: 12,
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.textSecondary,
    },
    beforeAfterRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 22,
    },
    imageMock: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.isDark ? theme.colors.card : '#faf7f2',
      padding: 10,
    },
    mockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    mockHeaderText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
    },
    mockArtBefore: {
      height: 120,
      borderRadius: 10,
      backgroundColor: theme.isDark ? '#2f3a34' : '#e9e1d2',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mockArtAfter: {
      height: 120,
      borderRadius: 10,
      backgroundColor: theme.isDark ? '#335543' : '#d9ebde',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mockCaption: {
      marginTop: 8,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    modeInfo: {
      marginTop: 22,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.isDark ? theme.colors.card : '#f9f6f0',
      padding: 14,
      gap: 6,
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modeTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    modeDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 20,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 12,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: theme.colors.primary,
    },
    swipeHint: {
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginBottom: 16,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    secondaryButton: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    secondaryButtonDisabled: {
      opacity: 0.45,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    primaryButton: {
      flex: 1.4,
      height: 52,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: theme.isDark ? 0.28 : 0.16,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.surface,
    },
  });

