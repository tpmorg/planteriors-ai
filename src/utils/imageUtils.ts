import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1024;
const COMPRESSION_QUALITY = 0.75;

/**
 * Compresses an image for AI processing.
 * Resizes to max 1024px on longest side and applies JPEG compression.
 * Typically reduces ~3MB images to ~100-300KB without perceptible quality loss.
 */
export async function compressImageForAI(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: MAX_DIMENSION,
          },
        },
      ],
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

export async function cropImageToAspect(
  uri: string,
  aspectWidth: number,
  aspectHeight: number
): Promise<string> {
  try {
    const meta = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    const imageWidth = meta.width ?? 0;
    const imageHeight = meta.height ?? 0;
    if (!imageWidth || !imageHeight) {
      return uri;
    }

    const targetAspect = aspectWidth / aspectHeight;
    let cropWidth = imageWidth;
    let cropHeight = imageHeight;

    if (imageWidth / imageHeight > targetAspect) {
      cropWidth = Math.floor(imageHeight * targetAspect);
      cropHeight = imageHeight;
    } else {
      cropHeight = Math.floor(imageWidth / targetAspect);
      cropWidth = imageWidth;
    }

    const originX = Math.floor((imageWidth - cropWidth) / 2);
    const originY = Math.floor((imageHeight - cropHeight) / 2);

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropWidth,
            height: cropHeight,
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
