import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from '../components/AppIcon';
import { GenerationRequest, GeneratedImage } from "../types";
import { createGeminiService } from "../services/geminiService";
import { databaseService } from "../services/databaseService";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { usageTrackingService } from "../services/usageTrackingService";
import { subscriptionService } from "../services/subscriptionService";
import { PaywallModal } from "../components/PaywallModal";
import { useTheme } from "../contexts/ThemeContext";

interface GenerationScreenProps {
  request: GenerationRequest;
  onGenerationComplete: (result: GeneratedImage) => void;
  onBack: () => void;
  onUpgradePress?: () => void;
}

// API key is now managed through environment configuration

export const GenerationScreen: React.FC<GenerationScreenProps> = ({
  request,
  onGenerationComplete,
  onBack,
  onUpgradePress,
}) => {
  const { user } = useAuth();
  const { refreshStatus } = useSubscription();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [isGenerating, setIsGenerating] = useState(false); // Changed to false initially
  const [isCheckingUsage, setIsCheckingUsage] = useState(true); // New state for usage check
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentStatus, setCurrentStatus] = useState("");
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(
    null,
  );
  const [isImageGenerated, setIsImageGenerated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiCallStarted, setApiCallStarted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);
  const pulseAnim = new Animated.Value(1);

  const initialSteps = [
    { text: "Preparing your room image...", duration: 1000 },
    { text: "Optimizing image for processing...", duration: 800 },
    { text: "Connecting...", duration: 700 },
  ];

  const apiSteps = [
    { text: "Sending image for analysis...", duration: 0 },
    { text: "Analyzing room layout and lighting...", duration: 0 },
    { text: "Designing plant placement...", duration: 0 },
    { text: "Generating augmented image...", duration: 0 },
    { text: "Processing final image...", duration: 0 },
  ];

  useEffect(() => {
    checkUsageAndStart();
  }, []);

  const checkUsageAndStart = async () => {
    if (!user) {
      setError("User not authenticated");
      setIsCheckingUsage(false);
      return;
    }

    try {
      setIsCheckingUsage(true);

      // Check if user can generate
      const { canGenerate, reason } = await usageTrackingService.canGenerateImage(user.id);

      if (!canGenerate) {
        setIsCheckingUsage(false);
        setShowPaywall(true);
        return;
      }

      // User can generate, start the process
      setIsCheckingUsage(false);
      setIsGenerating(true);
      startGeneration();
    } catch (error) {
      console.error('Error checking usage:', error);
      // On error, allow generation to proceed
      setIsCheckingUsage(false);
      setIsGenerating(true);
      startGeneration();
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
  }, [apiCallStarted]);

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
  }, [generatedImageUri]);

  const startGeneration = async () => {
    try {
      // Phase 1: Initial preparation steps
      setCurrentStatus("Preparing...");
      for (let i = 0; i < initialSteps.length; i++) {
        setCurrentStep(i);
        setCurrentStatus(initialSteps[i].text);
        setProgress((i + 1) / (initialSteps.length + apiSteps.length));
        await new Promise((resolve) =>
          setTimeout(resolve, initialSteps[i].duration),
        );
      }

      // Phase 2: Real API call with live progress updates
      setApiCallStarted(true);
      setCurrentStatus("Calling AI...");

      const geminiService = createGeminiService();

      // Start the API call and update progress during the call
      const apiPromise = geminiService.generatePlantImage(request);

      // Simulate API progress steps while the real call is happening
      let apiStepIndex = 0;
      const apiProgressInterval = setInterval(() => {
        if (apiStepIndex < apiSteps.length) {
          const totalSteps = initialSteps.length + apiSteps.length;
          const currentProgress =
            (initialSteps.length + apiStepIndex + 1) / totalSteps;

          setProgress(currentProgress);
          setCurrentStep(initialSteps.length + apiStepIndex);
          setCurrentStatus(apiSteps[apiStepIndex].text);
          apiStepIndex++;
        }
      }, 2000); // Update every 2 seconds during API call

      // Wait for the actual API call to complete
      const { imageUri: generatedUri, isGenerated } = await apiPromise;

      // Clear the interval
      clearInterval(apiProgressInterval);

      // Complete the progress
      setProgress(1);
      setCurrentStatus("Generation complete!");

      setGeneratedImageUri(generatedUri);
      setIsImageGenerated(isGenerated);
      setIsGenerating(false);

      // Only show success state for actually generated images
      if (!isGenerated) {
        setError(
          "AI generation failed - API returned text description instead of image. This might be a temporary issue with the Gemini model.",
        );
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate image");
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setCurrentStep(0);
    setCurrentStatus("");
    setGeneratedImageUri(null);
    setIsImageGenerated(false);
    setApiCallStarted(false);
    setIsGenerating(true);
    startGeneration();
  };

  const handleUseResult = async () => {
    if (generatedImageUri && isImageGenerated && user) {
      try {
        console.log("Saving design to database...");

        const savedDesign = await databaseService.saveDesign({
          originalImageUri: request.imageUri,
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
          customPrompt: request.prompt,
        });

        // NEW: Track usage after successful save
        const subscription = await subscriptionService.getSubscriptionStatus(user.id);
        const generationType = subscription.isActive ? 'paid' : 'free';
        await usageTrackingService.trackGeneration(user.id, generationType);

        // Refresh subscription context to update UI
        await refreshStatus();

        const result: GeneratedImage = {
          id: savedDesign.id,
          originalImageUri: request.imageUri,
          generatedImageUri: generatedImageUri,
          plantType: request.plantType!,
          plantStyle: request.plantStyle!,
          prompt: request.prompt || "",
          createdAt: new Date(),
        };

        console.log("Design saved successfully with ID:", savedDesign.id);
        onGenerationComplete(result);
      } catch (error) {
        console.error("Failed to save design:", error);
        Alert.alert("Error", "Failed to save design. Please try again.");
      }
    }
  };

  if (error) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
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
                📱 For debugging: A placeholder image was returned instead of a
                generated one. Check the console logs for API response details.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <AppIcon name="ArrowClockwise" size={20} color="white" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToSelectionButton}
            onPress={onBack}
          >
            <Text style={styles.backToSelectionText}>Back to Selection</Text>
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
          <Image
            source={{ uri: generatedImageUri }}
            style={styles.resultImage}
          />

          {/* Overlay header with back button */}
          <View style={styles.resultHeader}>
            <TouchableOpacity onPress={onBack} style={styles.overlayBackButton}>
              <AppIcon name="ArrowLeft" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Compact info overlay at bottom */}
          <View style={styles.resultOverlay}>
            <Text style={styles.resultSubtitle}>
              {request.mode === 'individual' && request.individualPlant
                ? `${request.individualPlant.plant.name} • ${request.individualPlant.size} • ${request.individualPlant.placement}`
                : `${request.plantType?.name} • ${request.plantStyle?.name} Style`}
            </Text>
          </View>

          {/* Action buttons overlaid at bottom */}
          <View style={styles.resultActionsOverlay}>
            <TouchableOpacity
              style={styles.generateAgainButton}
              onPress={handleRetry}
            >
              <AppIcon name="ArrowClockwise" size={20} color="white" />
              <Text style={styles.generateAgainText}>Generate Another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.useResultButton}
              onPress={handleUseResult}
            >
              <Text style={styles.useResultText}>Save Design</Text>
              <AppIcon name="Check" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
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
          />
          <View style={styles.imageLabel}>
            <Text style={styles.imageLabelText}>Original Room</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
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
          <Text style={styles.plantInfoTitle}>Creating your design with:</Text>
          <Text style={styles.plantInfoDetail}>
            {request.mode === 'individual' && request.individualPlant
              ? `🌱 ${request.individualPlant.plant.name} (${request.individualPlant.size}, ${request.individualPlant.placement})`
              : `🌱 ${request.plantType?.name} • ${request.plantStyle?.name} Style`}
          </Text>
        </View>

        <View style={styles.loadingAnimation}>
          <Animated.View style={styles.loadingDot} />
          <Animated.View style={[styles.loadingDot, { opacity: 0.7 }]} />
          <Animated.View style={[styles.loadingDot, { opacity: 0.4 }]} />
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

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  placeholder: {
    width: 40,
  },
  generationContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  originalImageContainer: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 32,
    position: "relative",
  },
  originalImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  loadingAnimation: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingDot: {
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#dc2626",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  backToSelectionButton: {
    padding: 12,
  },
  backToSelectionText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
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
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
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
    borderColor: "rgba(255,255,255,0.08)",
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
    gap: 14,
  },
  generateAgainButton: {
    flex: 1,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  generateAgainText: {
    color: "#1f3f10",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  useResultButton: {
    flex: 1,
    height: 50,
    backgroundColor: "#2d5016",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
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
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
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
