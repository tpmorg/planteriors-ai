import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GenerationRequest, GeneratedImage } from '../types';
import { createGeminiService } from '../services/geminiService';

interface GenerationScreenProps {
  request: GenerationRequest;
  onGenerationComplete: (result: GeneratedImage) => void;
  onBack: () => void;
}

// API key is now managed through environment configuration

export const GenerationScreen: React.FC<GenerationScreenProps> = ({
  request,
  onGenerationComplete,
  onBack,
}) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(null);
  const [isImageGenerated, setIsImageGenerated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  const steps = [
    { text: 'Analyzing your room...', duration: 2000 },
    { text: 'Understanding plant requirements...', duration: 1500 },
    { text: 'Designing perfect placement...', duration: 2000 },
    { text: 'Generating realistic visualization...', duration: 3000 },
    { text: 'Adding finishing touches...', duration: 1500 },
  ];

  useEffect(() => {
    startGeneration();
  }, []);

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
      // Simulate progress through steps
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        await simulateStep(steps[i].duration, i);
      }

      // Actual API call
      const geminiService = createGeminiService();
      const { imageUri: generatedUri, isGenerated } = await geminiService.generatePlantImage(request);

      setGeneratedImageUri(generatedUri);
      setIsImageGenerated(isGenerated);
      setIsGenerating(false);

      // Only show success state for actually generated images
      if (!isGenerated) {
        setError('AI generation failed - API returned text description instead of image. This might be a temporary issue with the Gemini model.');
      }

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate image');
      setIsGenerating(false);
    }
  };

  const simulateStep = (duration: number, stepIndex: number): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const startProgress = stepIndex / steps.length;
      const endProgress = (stepIndex + 1) / steps.length;

      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const stepProgress = Math.min(elapsed / duration, 1);
        const currentProgress = startProgress + (endProgress - startProgress) * stepProgress;
        setProgress(currentProgress);

        if (stepProgress < 1) {
          requestAnimationFrame(updateProgress);
        } else {
          resolve();
        }
      };

      updateProgress();
    });
  };

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setCurrentStep(0);
    setGeneratedImageUri(null);
    setIsImageGenerated(false);
    setIsGenerating(true);
    startGeneration();
  };

  const handleUseResult = () => {
    if (generatedImageUri) {
      const result: GeneratedImage = {
        id: Date.now().toString(),
        originalImageUri: request.imageUri,
        generatedImageUri: generatedImageUri,
        plantType: request.plantType,
        plantStyle: request.plantStyle,
        prompt: request.prompt || '',
        createdAt: new Date(),
      };
      onGenerationComplete(result);
    }
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2d5016" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Generation Failed</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#dc2626" />
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>

          {generatedImageUri && !isImageGenerated && (
            <View style={styles.placeholderInfo}>
              <Text style={styles.placeholderInfoText}>
                📱 For debugging: A placeholder image was returned instead of a generated one.
                Check the console logs for API response details.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToSelectionButton} onPress={onBack}>
            <Text style={styles.backToSelectionText}>Back to Selection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (generatedImageUri && !isGenerating && isImageGenerated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2d5016" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Plant Design</Text>
          <View style={styles.placeholder} />
        </View>

        <Animated.View
          style={[
            styles.resultContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image source={{ uri: generatedImageUri }} style={styles.resultImage} />
          <View style={styles.resultOverlay}>
            <Text style={styles.resultTitle}>✨ Design Complete!</Text>
            <Text style={styles.resultSubtitle}>
              {request.plantType.name} • {request.plantStyle.name} Style
            </Text>
          </View>
        </Animated.View>

        <View style={styles.resultActions}>
          <TouchableOpacity style={styles.generateAgainButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={20} color="#2d5016" />
            <Text style={styles.generateAgainText}>Generate Another</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.useResultButton} onPress={handleUseResult}>
            <Text style={styles.useResultText}>Save This Design</Text>
            <Ionicons name="checkmark" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2d5016" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Generating Design</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.generationContainer}>
        <View style={styles.originalImageContainer}>
          <Image source={{ uri: request.imageUri }} style={styles.originalImage} />
          <View style={styles.imageLabel}>
            <Text style={styles.imageLabelText}>Original Room</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>

        <View style={styles.stepContainer}>
          <Text style={styles.stepText}>{steps[currentStep]?.text}</Text>
        </View>

        <View style={styles.plantInfo}>
          <Text style={styles.plantInfoTitle}>Creating your design with:</Text>
          <Text style={styles.plantInfoDetail}>
            🌱 {request.plantType.name} • {request.plantStyle.name} Style
          </Text>
        </View>

        <View style={styles.loadingAnimation}>
          <Animated.View style={styles.loadingDot} />
          <Animated.View style={[styles.loadingDot, { opacity: 0.7 }]} />
          <Animated.View style={[styles.loadingDot, { opacity: 0.4 }]} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d5016',
  },
  placeholder: {
    width: 40,
  },
  generationContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  originalImageContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
    position: 'relative',
  },
  originalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
  },
  imageLabelText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2d5016',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d5016',
  },
  stepContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  plantInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  plantInfoTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  plantInfoDetail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d5016',
  },
  loadingAnimation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    backgroundColor: '#2d5016',
    borderRadius: 4,
    marginHorizontal: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#2d5016',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backToSelectionButton: {
    padding: 12,
  },
  backToSelectionText: {
    color: '#6b7280',
    fontSize: 14,
  },
  resultContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
  },
  resultTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  resultActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  generateAgainButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d5016',
  },
  generateAgainText: {
    color: '#2d5016',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  useResultButton: {
    flex: 1,
    backgroundColor: '#2d5016',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  useResultText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  placeholderInfo: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  placeholderInfoText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
});