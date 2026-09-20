import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  BackHandler,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../components/AppIcon';
import { AppButton } from '../components/AppButton';
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
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.header}>
          <AppButton
            variant="icon"
            size="sm"
            icon="ArrowLeft"
            overlay
            onPress={() => setShowRecent(false)}
            accessibilityLabel="Back to photo sources"
          />
          <Text style={styles.headerTitle}>Recent rooms</Text>
          <AppButton
            variant="icon"
            size="sm"
            icon="X"
            overlay
            onPress={onClose}
            accessibilityLabel="Close recent rooms"
          />
        </View>
        <View style={styles.recentPicker}>
          <Text style={styles.optionsTitle}>Choose a recent room</Text>
          <ScrollView
            style={styles.recentPickerScroll}
            contentContainerStyle={styles.recentPickerGrid}
            showsVerticalScrollIndicator={false}
          >
            {recentSourceImages.map((uri, index) => {
              const isUnavailable = unavailableRecent.has(uri);
              return (
                <Pressable
                  key={`${uri}-${index}`}
                  style={({ pressed }) => [styles.recentPickerButton, pressed && !isUnavailable && styles.cardPressed]}
                  onPress={() => useRecentImage(uri)}
                  disabled={isUnavailable}
                  accessibilityRole="button"
                  accessibilityLabel={`Recent room photo ${index + 1}`}
                  accessibilityHint="Uses this photo for your design"
                  accessibilityState={{ disabled: isUnavailable }}
                >
                  <Image
                    source={{ uri }}
                    style={styles.recentPickerImage}
                    resizeMode="cover"
                    onError={() => setUnavailableRecent((current) => new Set(current).add(uri))}
                  />
                  {isUnavailable ? <View style={styles.unavailableOverlay}><Text style={styles.unavailableText}>Photo unavailable</Text></View> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if (showOptions) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.header}>
          {showLeadingBackButton ? (
            <AppButton
              variant="icon"
              size="sm"
              icon="ArrowLeft"
              overlay
              onPress={onClose}
              accessibilityLabel="Back"
            />
          ) : (
            <View style={styles.headerButtonPlaceholder} />
          )}
          <Text style={styles.headerTitle}>{copy.addTitle}</Text>
          {isPlantIdMode ? (
            <View style={styles.headerButtonPlaceholder} />
          ) : (
            <AppButton
              variant="icon"
              size="sm"
              icon="X"
              overlay
              onPress={onClose}
              accessibilityLabel="Close add room photo"
            />
          )}
        </View>

        <View style={styles.optionsContainer}>
          <View style={styles.optionsContent}>
            <Text style={styles.optionsTitle}>{isPlantIdMode ? copy.optionsTitle : 'Choose room photo'}</Text>

            <Pressable
              style={({ pressed }) => [styles.optionButton, pressed && styles.cardPressed]}
              onPress={openCamera}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityHint={copy.cameraSubtitle}
            >
              <AppIcon name="Camera" size={32} color={theme.colors.primary} />
              <Text style={styles.optionTitle}>Take photo</Text>
              <Text style={styles.optionSubtitle}>{copy.cameraSubtitle}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.optionButton, pressed && styles.cardPressed]}
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Choose photo"
              accessibilityHint="Choose an existing photo from your device"
            >
              <AppIcon name="Images" size={32} color={theme.colors.primary} />
              <Text style={styles.optionTitle}>Choose photo</Text>
              <Text style={styles.optionSubtitle}>Choose an existing photo from your device</Text>
            </Pressable>

            {recentSourceImages.length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.optionButton, pressed && styles.cardPressed]}
                onPress={() => setShowRecent(true)}
                accessibilityRole="button"
                accessibilityLabel="Recent room"
                accessibilityHint="Reuse a room photo from a previous design"
              >
                <AppIcon name="ClockCounterClockwise" size={32} color={theme.colors.primary} />
                <Text style={styles.optionTitle}>Recent room</Text>
                <Text style={styles.optionSubtitle}>Reuse a room photo from a previous design</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.header}>
        {showLeadingBackButton ? (
          <AppButton
            variant="icon"
            size="sm"
            icon="ArrowLeft"
            overlay
            onPress={onClose}
            accessibilityLabel="Back"
          />
        ) : (
          <View style={styles.headerButtonPlaceholder} />
        )}
        <Text style={styles.headerTitle}>{copy.takeTitle}</Text>
        {isPlantIdMode ? (
          <AppButton
            variant="icon"
            size="sm"
            icon="CameraRotate"
            overlay
            onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            accessibilityLabel="Switch camera"
            accessibilityHint={`Switches to the ${facing === 'back' ? 'front' : 'back'} camera`}
          />
        ) : (
          <AppButton
            variant="icon"
            size="sm"
            icon="X"
            overlay
            onPress={onClose}
            accessibilityLabel="Close add room photo"
          />
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
        <AppButton
          variant="icon"
          size="lg"
          icon="Images"
          overlay
          onPress={pickImage}
          accessibilityLabel="Choose a photo from your library"
          style={styles.galleryButton}
        />

        <Pressable
          style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
          onPress={takePicture}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityHint={copy.guideline}
        >
          <View style={styles.captureButtonInner} />
        </Pressable>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  captureButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  cardPressed: {
    opacity: 0.85,
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
  recentPickerScroll: {
    flex: 1,
  },
  recentPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: 12,
    rowGap: 16,
    paddingBottom: 20,
  },
  recentPickerButton: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  recentPickerImage: {
    width: '100%',
    height: '100%',
  },
});
