import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';
import { compressImageForAI } from '../utils/imageUtils';

interface CameraScreenProps {
  onImageTaken: (imageUri: string) => void;
  onClose: () => void;
  recentSourceImages?: string[];
  mode?: 'room' | 'plant-id';
}

export const CameraScreen: React.FC<CameraScreenProps> = ({
  onImageTaken,
  onClose,
  recentSourceImages = [],
  mode = 'room',
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(true);
  const [isCropping, setIsCropping] = useState(false);
  const [isSystemCropping, setIsSystemCropping] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const { theme } = useTheme();
  const styles = createStyles(theme);
  const isPlantIdMode = mode === 'plant-id';

  const copy = {
    addTitle: isPlantIdMode ? 'Add Plant Photo' : 'Add Room Photo',
    optionsTitle: isPlantIdMode
      ? 'How would you like to add a plant photo?'
      : 'How would you like to add a room photo?',
    cameraSubtitle: isPlantIdMode
      ? 'Use your camera to capture a plant'
      : 'Use your camera to capture a room',
    recentTitle: isPlantIdMode ? 'Reuse Recent Plant Photos' : 'Reuse Recent Room Photos',
    takeTitle: isPlantIdMode ? 'Take Plant Photo' : 'Take Room Photo',
    guideline: isPlantIdMode
      ? 'Center the plant in frame with clear lighting'
      : 'Position your room in the frame for best results',
    previewSubtitle: isPlantIdMode
      ? 'Looks good? Continue to identify this plant.'
      : 'Looks good? Continue to start your design.',
    processingLabel: isPlantIdMode ? 'Identifying…' : 'Processing…',
  };

  const hasPermission = permission?.granted;

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        // Use silent capture by taking a snapshot instead of a full photo
        // This avoids the iOS shutter sound which can't be muted
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
          shutterSound: false,
        });
        const optimizedUri = await compressImageForAI(photo.uri);
        setPreviewImage(optimizedUri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickImage = async () => {
    try {
      setIsSystemCropping(true);
      const mediaTypes = ['images'];

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypes as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const optimizedUri = await compressImageForAI(result.assets[0].uri);
        setPreviewImage(optimizedUri);
        setShowOptions(false);
      }
      setIsSystemCropping(false);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      setIsSystemCropping(false);
    }
  };

  const openCamera = () => {
    setShowOptions(false);
  };

  const useRecentImage = (uri: string) => {
    setPreviewImage(uri);
    setShowOptions(false);
  };

  const confirmImage = async () => {
    if (!previewImage) return;
    setIsCropping(true);
    try {
      onImageTaken(previewImage);
    } finally {
      setIsCropping(false);
    }
  };

  const retakePhoto = () => {
    setPreviewImage(null);
    setShowOptions(true);
  };

  useEffect(() => {
    const handleHardwareBack = () => {
      if (isSystemCropping || isCropping) {
        return true;
      }
      if (previewImage) {
        retakePhoto();
        return true;
      }
      if (!showOptions) {
        setShowOptions(true);
        return true;
      }
      onClose();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => subscription.remove();
  }, [isSystemCropping, isCropping, previewImage, showOptions, onClose]);


  if (!permission) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Choose from Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isSystemCropping) {
    return <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container} />;
  }

  if (showOptions) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <AppIcon name="ArrowLeft" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{copy.addTitle}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.optionsContainer}>
          <View style={styles.optionsContent}>
            <Text style={styles.optionsTitle}>{copy.optionsTitle}</Text>

            <TouchableOpacity style={styles.optionButton} onPress={openCamera}>
              <AppIcon name="Camera" size={32} color={theme.colors.primary} />
              <Text style={styles.optionTitle}>Take Photo</Text>
              <Text style={styles.optionSubtitle}>{copy.cameraSubtitle}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionButton} onPress={pickImage}>
              <AppIcon name="Images" size={32} color={theme.colors.primary} />
              <Text style={styles.optionTitle}>Import from Gallery</Text>
              <Text style={styles.optionSubtitle}>Choose an existing photo from your device</Text>
            </TouchableOpacity>

            {recentSourceImages.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <AppIcon name="ClockCounterClockwise" size={16} color={theme.colors.primary} />
                  <Text style={styles.recentTitle}>{copy.recentTitle}</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentScrollContent}
                >
                  {recentSourceImages.map((uri, index) => (
                    <TouchableOpacity
                      key={`${uri}-${index}`}
                      style={styles.recentThumbButton}
                      onPress={() => useRecentImage(uri)}
                      activeOpacity={0.82}
                    >
                      <Image source={{ uri }} style={styles.recentThumbImage} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (previewImage) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={retakePhoto} style={styles.headerButton}>
            <AppIcon name="ArrowLeft" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <AppIcon name="X" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.previewContainer}>
          <Image source={{ uri: previewImage }} style={styles.previewImage} />
        </View>

        <View style={styles.previewControls}>
          <View style={styles.previewCopy}>
            <Text style={styles.previewTitle}>Review Your Photo</Text>
            <Text style={styles.previewSubtitle}>
              {copy.previewSubtitle}
            </Text>
          </View>

          <View style={styles.previewButtons}>
            <TouchableOpacity
              style={[styles.secondaryButton, isCropping && styles.buttonDisabled]}
              onPress={retakePhoto}
              disabled={isCropping}
            >
              <AppIcon name="Camera" size={18} color={theme.colors.primary} />
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, isCropping && styles.buttonDisabled]}
              onPress={confirmImage}
              disabled={isCropping}
            >
              {isCropping ? (
                <ActivityIndicator color="white" />
              ) : (
                <AppIcon name="Check" size={18} color="white" />
              )}
              <Text style={styles.primaryButtonText}>
                {isCropping ? copy.processingLabel : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <AppIcon name="ArrowLeft" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.takeTitle}</Text>
        <TouchableOpacity
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
          style={styles.headerButton}
        >
          <AppIcon name="CameraRotate" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
        <View style={styles.cameraOverlay}>
          <View style={styles.guideline}>
            <Text style={styles.guidelineText}>
              {copy.guideline}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
          <AppIcon name="Images" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        <View style={styles.placeholder} />
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Tip: Take a clear photo of your room interior for best AI results
        </Text>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  permissionText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: theme.colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 50,
  },
  guideline: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
  },
  guidelineText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  galleryButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  instructionText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  previewControls: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  previewCopy: {
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  optionsContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  optionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
  },
  optionButton: {
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  recentSection: {
    width: '100%',
    marginTop: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  recentScrollContent: {
    gap: 10,
    paddingRight: 4,
    paddingBottom: 4,
  },
  recentThumbButton: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.borderLight,
  },
  recentThumbImage: {
    width: '100%',
    height: '100%',
  },
});
