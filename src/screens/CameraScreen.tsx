import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';

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
  const [showOptions, setShowOptions] = useState(true);
  const [showRecent, setShowRecent] = useState(false);
  const [recentPage, setRecentPage] = useState(0);
  const [isSystemCropping, setIsSystemCropping] = useState(false);
  const [unavailableRecent, setUnavailableRecent] = useState<Set<string>>(() => new Set());
  const cameraRef = useRef<CameraView>(null);

  const { theme } = useTheme();
  const styles = createStyles(theme);
  const isPlantIdMode = mode === 'plant-id';
  const showLeadingBackButton = isPlantIdMode;

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

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        // Use silent capture by taking a snapshot instead of a full photo
        // This avoids the iOS shutter sound which can't be muted
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          shutterSound: false,
        });
        await onImageTaken(photo.uri);
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
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        await onImageTaken(result.assets[0].uri);
      }
      setIsSystemCropping(false);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      setIsSystemCropping(false);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        Alert.alert('Camera unavailable', 'You can still choose a photo from your library.');
        return;
      }
    }
    setShowOptions(false);
  };

  const useRecentImage = (uri: string) => {
    void onImageTaken(uri);
  };

  useEffect(() => {
    const handleHardwareBack = () => {
      if (isSystemCropping) {
        return true;
      }
      if (showRecent) {
        setShowRecent(false);
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
  }, [isSystemCropping, showOptions, showRecent, onClose]);

  if (isSystemCropping) {
    return <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container} />;
  }

  if (showRecent) {
    const pageCount = Math.max(1, Math.ceil(recentSourceImages.length / 3));
    const visibleRecent = recentSourceImages.slice(recentPage * 3, recentPage * 3 + 3);
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowRecent(false)} style={styles.headerButton} accessibilityLabel="Back to photo sources">
            <AppIcon name="ArrowLeft" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recent rooms</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close recent rooms"><AppIcon name="X" size={20} color="white" /></TouchableOpacity>
        </View>
        <View style={styles.recentPicker}>
          <Text style={styles.optionsTitle}>Choose a recent room</Text>
          <View style={styles.recentPickerGrid}>
            {visibleRecent.map((uri, index) => (
              <TouchableOpacity key={`${uri}-${index}`} style={styles.recentPickerButton} onPress={() => useRecentImage(uri)} disabled={unavailableRecent.has(uri)}>
                <Image source={{ uri }} style={styles.recentPickerImage} onError={() => setUnavailableRecent((current) => new Set(current).add(uri))} />
                {unavailableRecent.has(uri) ? <View style={styles.unavailableOverlay}><Text style={styles.unavailableText}>Photo unavailable</Text></View> : null}
              </TouchableOpacity>
            ))}
          </View>
          {pageCount > 1 ? <View style={styles.recentPagination}>
            <TouchableOpacity onPress={() => setRecentPage((value) => Math.max(0, value - 1))} disabled={recentPage === 0}><Text style={[styles.recentPageButton, recentPage === 0 && styles.recentPageDisabled]}>Previous</Text></TouchableOpacity>
            <Text style={styles.recentPageLabel}>{recentPage + 1} of {pageCount}</Text>
            <TouchableOpacity onPress={() => setRecentPage((value) => Math.min(pageCount - 1, value + 1))} disabled={recentPage === pageCount - 1}><Text style={[styles.recentPageButton, recentPage === pageCount - 1 && styles.recentPageDisabled]}>Next</Text></TouchableOpacity>
          </View> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (showOptions) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.header}>
          {showLeadingBackButton ? (
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <AppIcon name="ArrowLeft" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerButtonPlaceholder} />
          )}
          <Text style={styles.headerTitle}>{copy.addTitle}</Text>
          {isPlantIdMode ? (
            <View style={styles.headerButtonPlaceholder} />
          ) : (
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close add room photo"
            >
              <AppIcon name="X" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.optionsContainer}>
          <View style={styles.optionsContent}>
            <Text style={styles.optionsTitle}>{isPlantIdMode ? copy.optionsTitle : 'Choose room photo'}</Text>

            <TouchableOpacity style={styles.optionButton} onPress={openCamera}>
              <AppIcon name="Camera" size={32} color={theme.colors.primary} />
              <Text style={styles.optionTitle}>Take photo</Text>
              <Text style={styles.optionSubtitle}>{copy.cameraSubtitle}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionButton} onPress={pickImage}>
              <AppIcon name="Images" size={32} color={theme.colors.primary} />
              <Text style={styles.optionTitle}>Choose photo</Text>
              <Text style={styles.optionSubtitle}>Choose an existing photo from your device</Text>
            </TouchableOpacity>

            {recentSourceImages.length > 0 ? <TouchableOpacity style={styles.optionButton} onPress={() => setShowRecent(true)}>
              <AppIcon name="ClockCounterClockwise" size={32} color={theme.colors.primary} />
              <Text style={styles.optionTitle}>Recent room</Text>
              <Text style={styles.optionSubtitle}>Reuse a room photo from a previous design</Text>
            </TouchableOpacity> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.header}>
        {showLeadingBackButton ? (
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <AppIcon name="ArrowLeft" size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButtonPlaceholder} />
        )}
        <Text style={styles.headerTitle}>{copy.takeTitle}</Text>
        {isPlantIdMode ? (
          <TouchableOpacity
            onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            style={styles.headerButton}
          >
            <AppIcon name="CameraRotate" size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close add room photo"
          >
            <AppIcon name="X" size={20} color="white" />
          </TouchableOpacity>
        )}
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
          Take a clear photo of your room interior for best AI results
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
  headerButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
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
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  unavailableText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  recentPicker: {
    flex: 1,
    padding: 20,
  },
  recentPickerGrid: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
  },
  recentPickerButton: {
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  recentPickerImage: {
    width: '100%',
    height: '100%',
  },
  recentPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  recentPageButton: { color: 'white', fontWeight: '700', padding: 10 },
  recentPageDisabled: { opacity: 0.35 },
  recentPageLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
});
