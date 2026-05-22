import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { SavedDesign } from '../types';

const getCachePath = (fileName: string) => {
  const cacheDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!cacheDirectory) {
    throw new Error('No writable image cache directory is available');
  }
  return `${cacheDirectory}${fileName}`;
};

export const getLocalImageFileUri = async (imageUri: string, fileNamePrefix: string) => {
  if (imageUri.startsWith('file://')) {
    return imageUri;
  }

  if (imageUri.startsWith('/')) {
    return `file://${imageUri}`;
  }

  const fileName = `${fileNamePrefix}_${Date.now()}.png`;
  const tempPath = getCachePath(fileName);

  if (imageUri.startsWith('data:')) {
    const base64Data = imageUri.split(',')[1];
    if (!base64Data) {
      throw new Error('Image data is missing base64 payload');
    }

    await FileSystem.writeAsStringAsync(tempPath, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return tempPath;
  }

  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    const downloadResult = await FileSystem.downloadAsync(imageUri, tempPath);
    return downloadResult.uri;
  }

  return imageUri;
};

export const requestPhotoSavePermission = async () => {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    Alert.alert(
      'Photos Access Needed',
      'Allow Photos access to save designs to your device.'
    );
    return false;
  }
  return true;
};

export const saveImageUriToDevice = async (
  imageUri: string,
  fileNamePrefix: string,
  options: { requestPermission?: boolean } = {}
) => {
  const shouldRequestPermission = options.requestPermission ?? true;
  if (shouldRequestPermission) {
    const hasPermission = await requestPhotoSavePermission();
    if (!hasPermission) return false;
  }

  const localImageUri = await getLocalImageFileUri(imageUri, fileNamePrefix);
  await MediaLibrary.saveToLibraryAsync(localImageUri);
  return true;
};

export const saveDesignImageToDevice = async (
  design: SavedDesign,
  options: { requestPermission?: boolean } = {}
) => {
  const imageUri = design.localImagePath || design.generatedImageUri;
  return saveImageUriToDevice(imageUri, `plant_design_${design.id}`, options);
};
