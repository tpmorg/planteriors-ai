import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { useTheme } from '../contexts/ThemeContext';

interface OnboardingSlide {
  id: string;
  image: ImageSourcePropType;
}

interface OnboardingScreenProps {
  fromSettings?: boolean;
  onComplete: () => Promise<void> | void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  fromSettings = false,
  onComplete,
}) => {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const isTablet = Platform.OS === 'ios' && Math.min(width, height) >= 768;
  const pageWidth = width;
  const contentWidth = isTablet ? Math.min(width - 56, 980) : width - 28;

  const styles = useMemo(
    () => createStyles(theme, isTablet, pageWidth, contentWidth, height),
    [theme, isTablet, pageWidth, contentWidth, height]
  );

  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const slides: OnboardingSlide[] = [
    {
      id: 'welcome',
      image: require('../../assets/onboarding/ob-1.png'),
    },
    {
      id: 'capture',
      image: require('../../assets/onboarding/ob-2.png'),
    },
    {
      id: 'select',
      image: require('../../assets/onboarding/ob-3.png'),
    },
    {
      id: 'generate',
      image: require('../../assets/onboarding/ob-4.png'),
    },
  ];

  const isLast = currentIndex === slides.length - 1;

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setCurrentIndex(Math.max(0, Math.min(slides.length - 1, newIndex)));
  };

  const handleBack = () => {
    if (currentIndex === 0) return;
    const nextIndex = currentIndex - 1;
    listRef.current?.scrollToOffset({ offset: nextIndex * pageWidth, animated: true });
    setCurrentIndex(nextIndex);
  };

  const handleContinue = async () => {
    if (!isLast) {
      const nextIndex = currentIndex + 1;
      listRef.current?.scrollToOffset({ offset: nextIndex * pageWidth, animated: true });
      setCurrentIndex(nextIndex);
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
    <View style={styles.page}>
      <View style={styles.slideBody}>
        <View style={styles.imageStage}>
          <Image source={item.image} style={styles.heroImage} resizeMode="contain" />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
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
        bounces={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageWidth}
        onMomentumScrollEnd={handleScrollEnd}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => (
            <View key={slide.id} style={[styles.dot, index === currentIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actionsRow}>
          <AppButton
            variant="secondary"
            size="lg"
            title="Back"
            onPress={handleBack}
            disabled={currentIndex === 0 || isCompleting}
            style={styles.backButton}
            testID="onboarding-back"
          />

          <AppButton
            variant="primary"
            size="lg"
            elevated
            title={isLast ? (fromSettings ? 'Done' : 'Get Started') : 'Continue'}
            icon={isLast ? 'CheckCircle' : 'ArrowRight'}
            iconPosition="right"
            loading={isCompleting}
            onPress={handleContinue}
            style={styles.continueButton}
            testID="onboarding-continue"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (
  theme: any,
  isTablet: boolean,
  pageWidth: number,
  contentWidth: number,
  screenHeight: number
) => {
  const stageHeight = isTablet
    ? Math.min(Math.round(screenHeight * 0.78), 980)
    : Math.min(Math.round(screenHeight * 0.72), 760);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: isTablet ? 28 : 16,
      paddingTop: 6,
      paddingBottom: 8,
    },
    headerText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      letterSpacing: 0.35,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    page: {
      width: pageWidth,
      alignItems: 'center',
      paddingHorizontal: isTablet ? 20 : 14,
    },
    slideBody: {
      width: contentWidth,
      flex: 1,
      justifyContent: 'center',
    },
    imageStage: {
      height: stageHeight,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.isDark ? theme.colors.card : '#f3f4f6',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.isDark ? 0.24 : 0.12,
      shadowRadius: 14,
      elevation: 6,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    footer: {
      paddingHorizontal: isTablet ? 28 : 16,
      paddingTop: 6,
      paddingBottom: isTablet ? 24 : 18,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 14,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      width: 24,
      backgroundColor: theme.colors.primary,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    backButton: {
      flex: 1,
    },
    continueButton: {
      flex: 1.4,
    },
  });
};
