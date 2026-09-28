import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1024;
const COMPRESSION_QUALITY = 0.75;

export function getConstrainedImageSize(
  width: number,
  height: number,
  maxDimension: number = MAX_DIMENSION
): { width: number; height: number } | null {
  const longestEdge = Math.max(width, height);
  if (!Number.isFinite(longestEdge) || longestEdge <= 0 || longestEdge <= maxDimension) {
    return null;
  }

  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Compresses an image for AI processing.
 * Resizes to max 1024px on longest side and applies JPEG compression.
 * Typically reduces ~3MB images to ~100-300KB without perceptible quality loss.
 */
export async function compressImageForAI(uri: string): Promise<string> {
  try {
    const metadata = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const resize = getConstrainedImageSize(metadata.width, metadata.height);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      resize ? [{ resize }] : [],
      {
        compress: COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    console.log(`Image compressed: ${uri} -> ${result.uri}`);
    return result.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original URI if compression fails
    return uri;
  }
}

export async function cropImageWithRect(
  uri: string,
  crop: { originX: number; originY: number; width: number; height: number }
): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          crop: {
            originX: Math.max(0, Math.floor(crop.originX)),
            originY: Math.max(0, Math.floor(crop.originY)),
            width: Math.max(1, Math.floor(crop.width)),
            height: Math.max(1, Math.floor(crop.height)),
          },
        },
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result.uri;
  } catch (error) {
    console.error('Error cropping image:', error);
    return uri;
  }
}
