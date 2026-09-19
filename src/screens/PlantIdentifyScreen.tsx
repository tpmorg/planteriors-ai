import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { createPlantIdentificationService } from '../services/plantIdentificationService';
import { databaseService } from '../services/databaseService';
import { PlantIdentificationResult } from '../types';

interface PlantIdentifyScreenProps {
  onBack: () => void;
  onOpenCamera: () => void;
  onUpgradePress: () => void;
  onCapturedImageHandled?: () => void;
  capturedImageUri?: string;
  capturedImageAt?: number;
}

export const PlantIdentifyScreen: React.FC<PlantIdentifyScreenProps> = ({
  onBack,
  onOpenCamera,
  onUpgradePress,
  onCapturedImageHandled,
  capturedImageUri,
  capturedImageAt,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { refreshStatus } = useSubscription();
  const styles = createStyles(theme);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<PlantIdentificationResult | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isAlreadyInLibrary, setIsAlreadyInLibrary] = useState(false);
  const lastHandledCaptureRef = useRef<number | null>(null);

  const normalizePlantName = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const checkCommonNameExists = async (commonName: string): Promise<boolean> => {
    const normalizedCandidate = normalizePlantName(commonName);
    if (!normalizedCandidate) return false;

    const queryVariants = Array.from(
      new Set(
        [commonName.trim(), commonName.replace(/\(.*?\)/g, '').trim()].filter(
          (value) => value.length > 0
        )
      )
    );

    const matchesById = new Map<string, any>();
    for (const query of queryVariants) {
      const results = await databaseService.searchPlants(query, { limit: 200 });
      results.forEach((plant: any) => {
        matchesById.set(String(plant.id), plant);
      });
    }

    return Array.from(matchesById.values()).some(
      (plant: any) => normalizePlantName(plant.name || '') === normalizedCandidate
    );
  };

  const ensureCanIdentify = async (): Promise<boolean> => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to identify a plant.');
      return false;
    }
    return true;
  };

  const identifyFromUri = async (uri: string) => {
    const canIdentify = await ensureCanIdentify();
    if (!canIdentify) {
      return;
    }

    setImageUri(uri);
    setResult(null);
    setIsAlreadyInLibrary(false);
    setIsIdentifying(true);
    try {
      const service = createPlantIdentificationService();
      const identified = await service.identifyPlantFromImage(uri);
      setResult(identified);
      setIsCheckingDuplicate(true);
      try {
        const exists = await checkCommonNameExists(identified.commonName);
        setIsAlreadyInLibrary(exists);
      } catch (duplicateError) {
        console.warn('Failed to check plant duplicate status:', duplicateError);
        setIsAlreadyInLibrary(false);
      }
    } catch (error: any) {
      console.error('Failed to identify plant:', error);
      if (error?.code === 'allowance_exhausted' || error?.code === 'forbidden') {
        onUpgradePress();
        return;
      }
      Alert.alert('Identification failed', error?.message || 'Unable to identify this plant right now.');
    } finally {
      setIsCheckingDuplicate(false);
      setIsIdentifying(false);
    }
  };

  const openCameraFlow = () => {
    ensureCanIdentify().then((canIdentify) => {
      if (canIdentify) {
        onOpenCamera();
      }
    });
  };

  const saveToPlantDb = async () => {
    if (!result) return;
    if (isAlreadyInLibrary) {
      Alert.alert('Already in Plant Library', 'This plant already exists in the Plant Library.');
      return;
    }

    setIsSaving(true);
    try {
      const alreadyExists = await checkCommonNameExists(result.commonName);

      if (alreadyExists) {
        setIsAlreadyInLibrary(true);
        Alert.alert('Already in Plant Library', 'This plant already exists in the Plant Library.');
        return;
      }

      const service = createPlantIdentificationService();
      await service.saveIdentificationToPlantDb(result, imageUri || undefined);
      setIsAlreadyInLibrary(true);
      Alert.alert('Saved', `${result.commonName} was added to the Plant Library.`);
    } catch (error) {
      console.error('Failed to save identified plant:', error);
      Alert.alert('Save failed', 'Could not add this plant to the Plant Library.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetFlow = () => {
    setImageUri(null);
    setResult(null);
    setIsIdentifying(false);
    setIsCheckingUsage(false);
    setIsCheckingDuplicate(false);
    setIsAlreadyInLibrary(false);
  };

  useEffect(() => {
    if (!capturedImageUri || !capturedImageAt) {
      return;
    }
    if (lastHandledCaptureRef.current === capturedImageAt) {
      return;
    }
    lastHandledCaptureRef.current = capturedImageAt;
    identifyFromUri(capturedImageUri);
    onCapturedImageHandled?.();
  }, [capturedImageUri, capturedImageAt, onCapturedImageHandled]);

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.header}>
        <AppButton
          variant="icon"
          icon="ArrowLeft"
          iconColor={theme.colors.primary}
          onPress={onBack}
          accessibilityLabel="Back"
          style={styles.headerButton}
          testID="identify-back"
        />
        <Text style={styles.headerTitle}>Identify Plant</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!imageUri && (
          <>
            <View style={styles.heroIcon}>
              <AppIcon name="Plant" size={44} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Identify A Plant</Text>
            <Text style={styles.subtitle}>
              Take a photo or upload one, then we will identify it and provide care guidance.
            </Text>
          </>
        )}

        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
        )}

        {isIdentifying && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Analyzing plant...</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.commonName}>{result.commonName}</Text>
            <Text style={styles.scientificName}>{result.scientificName}</Text>
            <Text style={styles.meta}>
              Confidence: {Math.round(result.confidence * 100)}% • {result.careLevel} care
            </Text>
            <Text style={styles.description}>{result.description}</Text>
            {!!result.healthAssessment && (
              <Text style={styles.health}>Health note: {result.healthAssessment}</Text>
            )}
            <Text style={styles.tipsTitle}>Care Tips</Text>
            {result.careTips.map((tip, index) => (
              <Text key={`${tip}-${index}`} style={styles.tipItem}>• {tip}</Text>
            ))}
            {isCheckingDuplicate && (
              <Text style={styles.duplicateStatusText}>Checking library for duplicates...</Text>
            )}
            {isAlreadyInLibrary && !isCheckingDuplicate && (
              <Text style={styles.duplicateWarningText}>Already in Plant Library.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!result ? (
          <View style={styles.row}>
            <AppButton
              variant="primary"
              icon="Camera"
              title="Take / Upload Photo"
              loading={isCheckingUsage}
              onPress={openCameraFlow}
              style={styles.flexButton}
              testID="identify-camera"
            />
          </View>
        ) : (
          <View style={styles.row}>
            <AppButton
              variant="secondary"
              icon="ArrowClockwise"
              iconColor={theme.colors.primary}
              title="Try Another"
              onPress={resetFlow}
              style={styles.flexButton}
            />
            <AppButton
              variant="primary"
              icon={isAlreadyInLibrary ? 'Prohibit' : 'Check'}
              title={isAlreadyInLibrary ? 'Already In Library' : 'Add To Library'}
              loading={isSaving}
              disabled={isCheckingDuplicate || isAlreadyInLibrary}
              onPress={saveToPlantDb}
              style={styles.flexButton}
              accessibilityLabel={
                isAlreadyInLibrary ? 'Plant already in library' : 'Add identified plant to library'
              }
            />
          </View>
        )}
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
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerButton: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    headerSpacer: {
      width: 44,
      height: 44,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 18,
      gap: 12,
    },
    heroIcon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: 14,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 340,
      alignSelf: 'center',
      marginTop: 8,
    },
    previewImage: {
      width: '100%',
      height: 260,
      borderRadius: 16,
      marginTop: 18,
      backgroundColor: theme.colors.surface,
    },
    loadingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    loadingText: {
      color: theme.colors.text,
      fontWeight: '600',
    },
    resultCard: {
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginTop: 12,
    },
    commonName: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
    },
    scientificName: {
      marginTop: 2,
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    meta: {
      marginTop: 8,
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    description: {
      marginTop: 10,
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    health: {
      marginTop: 10,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    tipsTitle: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    tipItem: {
      marginTop: 6,
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    duplicateStatusText: {
      marginTop: 12,
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    duplicateWarningText: {
      marginTop: 12,
      fontSize: 13,
      color: '#b91c1c',
      fontWeight: '700',
    },
    footer: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      paddingTop: 10,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    flexButton: {
      flex: 1,
    },
  });
