import { GenerationRequest } from '../types';
import { env } from '../utils/env';
import * as FileSystem from 'expo-file-system';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'google/gemini-2.5-flash-image-preview';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenRouterService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generatePlantImage(request: GenerationRequest): Promise<string> {
    try {
      const prompt = this.buildPrompt(request);

      console.log('API Key being used:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NONE');
      console.log('Image URI:', request.imageUri);

      // Check if it's a local file URI and convert to base64
      let imageData = request.imageUri;
      if (request.imageUri.startsWith('file://')) {
        console.log('Converting local file to base64...');
        try {
          const base64 = await FileSystem.readAsStringAsync(request.imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          // Get the file extension to determine MIME type
          const extension = request.imageUri.split('.').pop()?.toLowerCase();
          const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
          imageData = `data:${mimeType};base64,${base64}`;
          console.log('Successfully converted to base64');
        } catch (error) {
          console.error('Failed to convert image to base64:', error);
          throw new Error('Failed to process image file');
        }
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://plant-interior-ai.app',
          'X-Title': 'Plant Interior AI',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData,
                    detail: 'high'
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error response:', errorText);
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('OpenRouter API response:', responseText);

      let data: OpenRouterResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseText);
        throw new Error(`Invalid JSON response from OpenRouter API: ${parseError}`);
      }

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter API');
      }

      // Extract image URL from the response
      // Note: This is a simplified version. In reality, you might need to parse
      // the response differently based on how Gemini returns generated images
      const content = data.choices[0].message.content;

      // For now, we'll return a placeholder. In a real implementation,
      // you'd need to handle the actual image generation response
      return this.parseImageUrl(content);

    } catch (error) {
      console.error('Error generating plant image:', error);
      throw error;
    }
  }

  private buildPrompt(request: GenerationRequest): string {
    const { plantType, plantStyle } = request;

    return `You are an expert interior designer specializing in plant integration. Please analyze this room image and generate a new image with ${plantType.name.toLowerCase()} integrated into the space using a ${plantStyle.name.toLowerCase()} style.

Requirements:
- Plant Type: ${plantType.name} - ${plantType.description}
- Style: ${plantStyle.name} - ${plantStyle.description}
- Maintain the original room's architecture and lighting
- Add realistic ${plantType.name.toLowerCase()} that complement the space
- Use ${plantStyle.description.toLowerCase()} arrangement principles
- Ensure plants look natural and well-placed
- Consider proper lighting and plant placement for realistic growth
- Keep the overall room aesthetic while enhancing it with plants

Generate a photorealistic image that shows how this room would look with the specified plants and styling. The result should be inspiring and achievable in real life.

${request.prompt ? `Additional requirements: ${request.prompt}` : ''}`;
  }

  private parseImageUrl(content: string): string {
    // For development/prototyping, return a placeholder image
    // In production, you would parse the actual response from Gemini
    console.log('Gemini response content:', content);

    // Look for image URLs in the content
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i;
    const match = content.match(urlRegex);

    if (match) {
      return match[0];
    }

    // Return a placeholder image for development
    console.warn('No image URL found in response, using placeholder');
    return 'https://picsum.photos/800/600?random=' + Date.now();
  }
}

export const createOpenRouterService = (apiKey?: string) => {
  const key = apiKey || env.getOpenRouterApiKey();
  return new OpenRouterService(key);
};