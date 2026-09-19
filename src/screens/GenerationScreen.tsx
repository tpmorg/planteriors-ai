import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from '../components/AppIcon';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { GenerationRequest, GeneratedImage } from "../types";
import { createGeminiService } from "../services/geminiService";
import { AiApiError } from "../services/aiApiService";
import { databaseService } from "../services/databaseService";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { PaywallModal } from "../components/PaywallModal";
import { useNetwork, useNetworkGuard } from "../contexts/NetworkContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";

interface GenerationScreenProps {
  request: GenerationRequest;
  onGenerationComplete: (result: GeneratedImage) => void;
  onBack: () => void;
  onAdjust: (imageUri: string) => void;
  onClose: () => void;
  onResultVisible?: (imageUri: string, jobId: string) => void;
  initialResultUri?: string;
  initialSavedDesignId?: string;
  onRequestUnknown?: () => void;
  onUpgradePress?: () => void;
}

// API key is now managed through environment configuration

export const GenerationScreen: React.FC<GenerationScreenProps> = ({
  request,
  onGenerationComplete,
  onBack,
  onAdjust,
  onClose,
  onResultVisible,
  initialResultUri,
  initialSavedDesignId,
  onRequestUnknown,
  onUpgradePress,
}) => {
  const { user } = useAuth();
  const { refreshStatus } = useSubscription();
  const { theme } = useTheme();
  const requireNetwork = useNetworkGuard();
  const { reportNetworkIssue, reportNetworkSuccess } = useNetwork();
  const { showToast } = useToast();
  const { width, height } = useWindowDimensions();
  const isTablet = Platform.OS === "ios" && Math.min(width, height) >= 768;
  const styles = createStyles(theme, isTablet);

  const [isGenerating, setIsGenerating] = useState(false); // Changed to false initially
  const [isCheckingUsage, setIsCheckingUsage] = useState(!initialResultUri); // New state for usage check
  const [currentStatus, setCurrentStatus] = useState("");
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(
    initialResultUri || null,
  );
  const [isImageGenerated, setIsImageGenerated] = useState<boolean>(!!initialResultUri);
  const [error, setError] = useState<string | null>(null);
  const [apiCallStarted, setApiCallStarted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestUnknown, setIsRequestUnknown] = useState(false);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(initialSavedDesignId || null);
  const generationInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isSinglePlantRequest =
    (request.mode === 'individual' || request.mode === 'replace-plant') &&
    !!request.individualPlant;
  const requestPlantSummary = isSinglePlantRequest
    ? `${request.individualPlant!.plant.name} • ${request.individualPlant!.size} • ${
        request.mode === 'replace-plant' ? 'replacement' : request.individualPlant!.placement
      }`
    : `${request.plantType?.name} • ${request.plantStyle?.name} Style`;
  const requestActionLabel =
    request.mode === 'replace-plant'
      ? 'Replacing plant with:'
      : 'Creating your design with:';

  useEffect(() => {
    if (!initialResultUri) checkUsageAndStart();
  }, []);

  const checkUsageAndStart = async () => {
    if (!user) {
      setError("User not authenticated");
      setIsCheckingUsage(false);
      return;
    }

    try {
      setIsRequestUnknown(false);
      setIsCheckingUsage(true);

      if (!requireNetwork()) {
        setError("No internet connection. Please check your network and try again.");
        setIsCheckingUsage(false);
        return;
      }

      // The server performs the authoritative allowance check.
      setIsCheckingUsage(false);
      setIsGenerating(true);
      startGeneration();
    } catch (error) {
      console.error('Error checking usage:', error);
      setError(error instanceof Error ? error.message : 'Unable to start generation');
      setIsCheckingUsage(false);
    }
  };

  useEffect(() => {
    if (apiCallStarted) {
      // Start pulsing animation when API call begins
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      return () => pulse.stop();
    }
  }, [apiCallStarted, pulseAnim]);

  useEffect(() => {
    if (generatedImageUri) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [generatedImageUri, fadeAnim, scaleAnim]);

  const startGeneration = async () => {
    if (generationInFlightRef.current) return;
    generationInFlightRef.current = true;
    try {
      setCurrentStatus("Preparing photo...");
      setApiCallStarted(true);

      const geminiService = createGeminiService();
      const { imageUri: generatedUri, isGenerated, jobId } = await geminiService.generatePlantImage(
        request,
        (phase) => setCurrentStatus({
          preparing: 'Preparing photo...',
          uploading: 'Uploading photo...',
          generating: 'Generating design...',
          downloading: 'Downloading result...',
        }[phase])
      );
      reportNetworkSuccess('generation');
      setCurrentStatus("Generation complete!");

      setGeneratedImageUri(generatedUri);
      setIsImageGenerated(isGenerated);
      setIsGenerating(false);
      if (isGenerated) {
        onResultVisible?.(generatedUri, jobId);
        refreshStatus().catch((refreshError) => {
          console.warn('Failed to refresh RevenueCat credits after generation:', refreshError);
        });
      }

      // Only show success state for actually generated images
      if (!isGenerated) {
        setError(
          "AI generation failed - API returned text description instead of image. This might be a temporary issue with the Gemini model.",
        );
      }
    } catch (err) {
      console.error("Generation error:", err);
      reportNetworkIssue('generation', err);
      if (err instanceof AiApiError && (err.code === 'allowance_exhausted' || err.code === 'forbidden')) {
        setShowPaywall(true);
      } else if (err instanceof AiApiError && err.code === 'timeout') {
        setIsRequestUnknown(true);
        onRequestUnknown?.();
        setError('The request was interrupted, so its final status is unknown. Edit the setup before deciding whether to submit a new generation.');
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate image");
      }
      setIsGenerating(false);
    } finally {
      generationInFlightRef.current = false;
    }
  };

  const handleRetry = () => {
    setError(null);
    setCurrentStatus("");
    setGeneratedImageUri(null);
    setIsImageGenerated(false);
    setApiCallStarted(false);
    setIsGenerating(true);
    startGeneration();
  };

  const handleUseResult = async () => {
    if (generatedImageUri && isImageGenerated && user && !saveInFlightRef.current && !savedDesignId) {
      saveInFlightRef.current = true;
      try {
        setIsSaving(true);
        console.log("Saving design locally...");

        const savedDesign = await databaseService.saveDesign({
          originalImageUri: request.originalImageUri || request.imageUri,
          generatedImageUri: generatedImageUri,
          userId: user.id, // NEW: Add user ID
          mode: request.mode,
          // Multi-plant mode fields
          plantTypeName: request.plantType?.name,
          plantTypeDescription: request.plantType?.description,
          plantStyleName: request.plantStyle?.name,
          plantStyleDescription: request.plantStyle?.description,
          // Individual plant mode fields
          individualPlantName: request.individualPlant?.plant.name,
          individualPlantScientificName: request.individualPlant?.plant.scientificName,
          individualPlantSize: request.individualPlant?.size,
          individualPlantPlacement: request.individualPlant?.placement,
          individualPlantId: request.individualPlant?.plant.id,
          customPrompt: request.prompt,
        });

        const result: GeneratedImage = {
          id: savedDesign.id,
          originalImageUri: request.originalImageUri || request.imageUri,
          generatedImageUri: generatedImageUri,
          plantType: request.plantType!,
          plantStyle: request.plantStyle!,
          prompt: request.prompt || "",
          createdAt: new Date(),
        };

        console.log("Design saved locally with ID:", savedDesign.id);
        showToast("Saved on this device", "success");
        setSavedDesignId(savedDesign.id);
        onGenerationComplete(result);

      } catch (error) {
        console.error("Failed to save design locally:", error);
        showToast("Failed to save on this device", "error");
      } finally {
        setIsSaving(false);
        saveInFlightRef.current = false;
      }
    }
  };

  if (error && !generatedImageUri) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.backdropBlobA} />
        <View style={styles.backdropBlobB} />
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <AppIcon name="ArrowLeft" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Generation Failed</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.errorContainer}>
          <AppIcon name="WarningCircle" size={64} color="#dc2626" />
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>

          {generatedImageUri && !isImageGenerated && (
            <View style={styles.placeholderInfo}>
              <Text style={styles.placeholderInfoText}>
                For debugging: A placeholder image was returned instead of a
                generated one. Check the console logs for API response details.
              </Text>
            </View>
          )}

          {!isRequestUnknown ? <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <AppIcon name="ArrowClockwise" size={20} color="white" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity> : null}

          <TouchableOpacity
            style={styles.backToSelectionButton}
            onPress={onBack}
          >
            <Text style={styles.backToSelectionText}>Edit setup</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (generatedImageUri && !isGenerating && isImageGenerated) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.fullScreenContainer}>
        <Animated.View
          style={[
            styles.resultContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <BeforeAfterSlider originalUri={request.imageUri} generatedUri={generatedImageUri} />

          {/* Overlay header with back button */}
          <View style={styles.resultHeader}>
            <TouchableOpacity onPress={onBack} style={styles.overlayBackButton}>
              <AppIcon name="ArrowLeft" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.overlayBackButton} accessibilityLabel="Close result">
              <AppIcon name="X" size={22} color="white" />
            </TouchableOpacity>
          </View>

          {/* Compact info overlay at bottom */}
          <View style={styles.resultOverlay}>
            <Text style={styles.resultSubtitle}>{requestPlantSummary}</Text>
            {error ? <Text style={styles.previousResultError}>The new version failed. Your previous result is still here.</Text> : null}
          </View>

          {/* Action buttons overlaid at bottom */}
          <View style={styles.resultActionsOverlay}>
            <TouchableOpacity style={styles.generateAgainButton} onPress={() => onAdjust(generatedImageUri)}>
              <AppIcon name="SlidersHorizontal" size={19} color="white" />
              <Text style={styles.generateAgainText}>Adjust</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.generateAgainButton, isRequestUnknown && styles.buttonDisabled]} disabled={isRequestUnknown} onPress={() => { setError(null); setSavedDesignId(null); setIsGenerating(true); void startGeneration(); }}>
              <AppIcon name="ArrowClockwise" size={19} color="white" />
              <Text style={styles.generateAgainText}>Another version</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.useResultButton, (isSaving || !!savedDesignId) && styles.buttonDisabled]}
              onPress={handleUseResult}
              disabled={isSaving || !!savedDesignId}
            >
              <Text style={styles.useResultText}>{savedDesignId ? 'Saved' : isSaving ? 'Saving…' : 'Save'}</Text>
              <AppIcon name="Check" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppIcon name="ArrowLeft" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Generating Design</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.generationContainer}>
        <View style={styles.originalImageContainer}>
          <Image
            source={{ uri: request.imageUri }}
            style={styles.originalImage}
            resizeMode={isTablet ? "contain" : "cover"}
          />
          <View style={styles.imageLabel}>
            <Text style={styles.imageLabelText}>Original Room</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>

        <View style={styles.stepContainer}>
          <Text style={styles.stepText}>{currentStatus}</Text>
          {apiCallStarted && (
            <View style={styles.apiStatusContainer}>
              <Animated.View
                style={[styles.apiIndicator, { opacity: pulseAnim }]}
              />
              <Text style={styles.apiStatusText}>
                Live processing with AI
              </Text>
            </View>
          )}
        </View>

        <View style={styles.plantInfo}>
          <Text style={styles.plantInfoTitle}>{requestActionLabel}</Text>
          <Text style={styles.plantInfoDetail}>{requestPlantSummary}</Text>
        </View>

      </View>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onUpgrade={() => {
          setShowPaywall(false);
          if (onUpgradePress) {
            onUpgradePress();
          } else {
            onBack();
          }
        }}
        onDismiss={() => {
          setShowPaywall(false);
          onBack();
        }}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any, isTablet: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backdropBlobA: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.isDark ? "rgba(86,194,138,0.1)" : "rgba(47,122,82,0.09)",
    top: -110,
    left: -90,
  },
  backdropBlobB: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(181,122,82,0.08)",
    bottom: -80,
    right: -70,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  backButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text,
    fontFamily: "serif",
  },
  placeholder: {
    width: 40,
  },
  generationContainer: {
    flex: 1,
    padding: isTablet ? 28 : 24,
    justifyContent: "center",
  },
  originalImageContainer: {
    width: "100%",
    maxWidth: isTablet ? 980 : undefined,
    alignSelf: "center",
    height: isTablet ? 360 : 200,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 32,
    position: "relative",
    backgroundColor: theme.colors.borderLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: theme.isDark ? 0.28 : 0.14,
    shadowRadius: 14,
    elevation: 8,
  },
  originalImage: {
    width: "100%",
    height: "100%",
  },
  imageLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.62)",
    padding: 12,
  },
  imageLabelText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  progressContainer: {
    marginBottom: 24,
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  stepContainer: {
    alignItems: "center",
    marginBottom: 32,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  stepText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  apiStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.isDark ? "rgba(134, 239, 172, 0.1)" : "rgba(45, 80, 22, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  apiIndicator: {
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    marginRight: 8,
  },
  apiStatusText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  plantInfo: {
    backgroundColor: theme.colors.surface,
    padding: 18,
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.22 : 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  plantInfoTitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  plantInfoDetail: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#dc2626",
    marginTop: 16,
    marginBottom: 8,
    fontFamily: "serif",
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    justifyContent: "center",
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.28 : 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  retryButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  backToSelectionButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.borderLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backToSelectionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  resultContainer: {
    flex: 1,
    position: "relative",
  },
  resultImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  resultHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  overlayBackButton: {
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  resultOverlay: {
    position: "absolute",
    bottom: 124,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  resultTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  resultSubtitle: {
    color: "white",
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.95,
  },
  previousResultError: {
    color: '#fecaca',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  identificationBlock: {
    marginTop: 12,
    gap: 8,
  },
  identifyPlantsButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(47,122,82,0.95)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identifyPlantsButtonDisabled: {
    opacity: 0.72,
  },
  identifyPlantsText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  identifiedPlantsCard: {
    gap: 8,
  },
  identifiedPlantsTitle: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.86,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  identifiedPlantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  identifiedPlantName: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  identifiedPlantMeta: {
    maxWidth: "42%",
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    textTransform: "capitalize",
  },
  identificationError: {
    color: "#fecaca",
    fontSize: 12,
    lineHeight: 16,
  },
  resultActions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  resultActionsOverlay: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  generateAgainButton: {
    flex: 1,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  generateAgainText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 5,
  },
  useResultButton: {
    flex: 1,
    height: 50,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  useResultText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 5,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  placeholderInfo: {
    backgroundColor: "#fef3c7",
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  placeholderInfoText: {
    fontSize: 12,
    color: "#92400e",
    lineHeight: 16,
  },
});
