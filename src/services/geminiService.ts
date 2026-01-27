import { GoogleGenAI } from "@google/genai";
import {
  GenerationRequest,
  PlantOptions,
  IndividualPlantSelection,
  PlantSize,
  PlacementType,
  LightRequirement,
} from "../types";
import { env } from "../utils/env";
import * as FileSystem from "expo-file-system/legacy";
import { compressImageForAI } from "../utils/imageUtils";

// Image generation/editing model - takes input image + prompt to create modified version
const MODEL_NAME = "gemini-2.5-flash-image";

export class GeminiService {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  async generatePlantImage(
    request: GenerationRequest,
  ): Promise<{ imageUri: string; isGenerated: boolean }> {
    try {
      const promptText = this.buildPrompt(request);

      console.log("Using Gemini SDK directly...");

      // Convert local file URI to base64
      if (!request.imageUri.startsWith("file://")) {
        throw new Error("Expected local file URI for image processing");
      }

      // Compress image before sending to reduce bandwidth and improve performance
      console.log("Compressing image for AI processing...");
      const compressedUri = await compressImageForAI(request.imageUri);

      console.log("Converting compressed image to base64...");
      const base64 = await FileSystem.readAsStringAsync(compressedUri, {
        encoding: "base64",
      });

      // Compressed images are always JPEG
      const mimeType = "image/jpeg";

      console.log(
        "Successfully converted to base64, size:",
        `${Math.round(base64.length / 1024)}KB`,
      );

      // Build the prompt in Gemini SDK format
      const prompt = [
        { text: promptText },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64,
          },
        },
      ];

      console.log("Making Gemini API request...");

      const response = await this.client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      console.log("Gemini API response received");

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No response from Gemini API");
      }

      const result = this.parseGeminiResponse(response);
      return result;
    } catch (error) {
      console.error("Error generating plant image:", error);
      throw error;
    }
  }

  private buildPrompt(request: GenerationRequest): string {
    // Check mode and delegate to appropriate method
    if (request.mode === 'individual' && request.individualPlant) {
      return this.buildIndividualPlantPrompt(request.individualPlant, request.prompt);
    }
    return this.buildMultiPlantPrompt(request);
  }

  private buildIndividualPlantPrompt(
    selection: IndividualPlantSelection,
    customPrompt?: string
  ): string {
    const { plant, size, placement } = selection;

    // Size descriptions
    const sizeDescriptions: Record<PlantSize, string> = {
      small: 'a small, compact (6-12 inch)',
      medium: 'a medium-sized (1-3 foot)',
      large: 'a large, statement (3-6 foot)',
    };

    // Placement descriptions
    const placementDescriptions: Record<PlacementType, string> = {
      floor: 'placed directly on the floor in an attractive pot or planter that matches the room decor',
      shelf: 'positioned on a shelf, side table, or furniture surface in a decorative pot',
      hanging: 'suspended from the ceiling or mounted on the wall in a stylish hanging planter with trailing vines visible',
    };

    // Light requirement context for realistic placement
    const lightContexts: Record<LightRequirement, string> = {
      'low': 'Position it in a spot with indirect or low light - away from direct window exposure, such as a corner or north-facing area',
      'low-to-bright': 'This plant is versatile and can be placed anywhere with any light level',
      'bright-indirect': 'Position it near a window but not in direct sunlight - filtered light through curtains is ideal',
      'bright-direct': 'Place it in a sunny spot where it would receive direct sunlight from a window',
    };

    return `Add a single ${sizeDescriptions[size]} ${plant.name} (${plant.scientificName}) to this room image.

Plant Details:
- Common Name: ${plant.name}
- Scientific Name: ${plant.scientificName}
- Description: ${plant.description}
- The plant should be ${placementDescriptions[placement]}
- ${lightContexts[plant.lightRequirement]}

Critical Requirements:
1. Add ONLY ONE plant - a single ${plant.name}
2. The plant must be ${sizeDescriptions[size]} specimen, appropriately scaled to the room
3. Use an attractive pot or planter that complements the room's existing style and color palette
4. Position the plant naturally where it would realistically thrive based on its light needs
5. Maintain photorealistic quality with proper shadows, reflections, and lighting
6. Keep ALL original room elements, furniture, and architecture EXACTLY as shown
7. The plant should enhance the space as a single accent piece without overwhelming it
8. Match the perspective, angle, and lighting of the original photo precisely

${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Generate this as a high-quality photorealistic image with the single ${plant.name} seamlessly integrated into the room.`;
  }

  private buildMultiPlantPrompt(request: GenerationRequest): string {
    const { plantType, plantStyle, plantOptions } = request;

    if (!plantType || !plantStyle) {
      throw new Error('Plant type and style are required for multi-plant mode');
    }

    // Build container description based on plant options
    const containerDescription = this.buildContainerDescription(plantOptions);
    const densityDescription = this.buildDensityDescription(plantOptions);
    const careDescription = this.buildCareDescription(plantOptions);

    return `Generate a photorealistic image of this exact room transformed with ${plantType.name.toLowerCase()} plants arranged in a ${plantStyle.name.toLowerCase()} style.

Transform this room by adding:
- ${plantType.name}: ${plantType.description}
- Style: ${plantStyle.name} - ${plantStyle.description}
${containerDescription}
${densityDescription}
${careDescription}

Keep the original room's architecture, furniture placement, lighting, and color scheme exactly the same. Only add plants that would realistically thrive in this lighting environment. Place ${plantType.name.toLowerCase()} in strategic locations following ${plantStyle.description.toLowerCase()} design principles.

Make the plants look naturally integrated into the space - not artificially placed. Ensure realistic shadows, reflections, and proportions. The plants should enhance the room's existing aesthetic while maintaining the same viewing angle and perspective as the original photo.

${request.prompt ? `Additional requirements: ${request.prompt}` : ""}

Generate this as a high-quality photorealistic image.`;
  }

  private buildContainerDescription(plantOptions?: PlantOptions): string {
    if (!plantOptions) return "";

    const { potStyle, potColor, usePlanterBox } = plantOptions;

    let description = `- Containers: Use ${potStyle.name.toLowerCase()} style pots in ${potColor.name.toLowerCase()} color`;

    if (usePlanterBox) {
      description += `. Include long rectangular planter boxes for grouping multiple plants together`;
    }

    return description;
  }

  private buildDensityDescription(plantOptions?: PlantOptions): string {
    if (!plantOptions) return "";

    const { placementDensity } = plantOptions;

    const densityInstructions: Record<string, string> = {
      minimal:
        "- Density: Place plants sparingly with just 2-3 statement pieces. Focus on one or two key focal points",
      moderate:
        "- Density: Add a balanced amount of greenery with 4-6 plants distributed throughout the space",
      lush: "- Density: Create an abundant, jungle-like atmosphere with many plants (8+) filling corners, shelves, and surfaces",
    };

    return densityInstructions[placementDensity.id] || "";
  }

  private buildCareDescription(plantOptions?: PlantOptions): string {
    if (!plantOptions) return "";

    const { maintenanceLevel } = plantOptions;

    const careInstructions: Record<string, string> = {
      low: "- Plant Selection: Choose only low-maintenance, hardy plants like pothos, snake plants, ZZ plants, and succulents",
      medium:
        "- Plant Selection: Include a mix of easy-care and moderate-maintenance plants like ferns, peace lilies, and philodendrons",
      high: "- Plant Selection: Feature premium, high-maintenance plants including fiddle leaf figs, orchids, calatheas, and rare tropical varieties",
    };

    return careInstructions[maintenanceLevel.id] || "";
  }

  private parseGeminiResponse(response: any): {
    imageUri: string;
    isGenerated: boolean;
  } {
    console.log("Gemini response structure analysis:");
    console.log("- Candidates:", response.candidates?.length || 0);
    console.log(
      "- Parts in first candidate:",
      response.candidates?.[0]?.content?.parts?.length || 0,
    );

    const parts = response.candidates[0].content.parts;

    for (const part of parts) {
      if (part.text) {
        console.log("Text part preview:", part.text.substring(0, 200) + "...");

        // Look for image URLs in text content as fallback
        const url = this.extractUrlFromText(part.text);
        if (url) {
          console.log("Found image URL in text:", url);
          return { imageUri: url, isGenerated: true };
        }
      } else if (part.inlineData) {
        console.log("Found inlineData image part");
        console.log(
          "Image data size:",
          `${Math.round(part.inlineData.data.length / 1024)}KB`,
        );
        console.log("Image MIME type:", part.inlineData.mimeType);

        // Convert base64 data to data URI
        const dataUri = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        return { imageUri: dataUri, isGenerated: true };
      }
    }

    // Return a placeholder image for development
    console.warn(
      "No image found in Gemini response, using plant-themed placeholder",
    );
    const plantImages = [
      "https://images.unsplash.com/photo-1493663284031-b7e3aab21900?w=800&h=600&fit=crop", // Living room with plants
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&h=600&fit=crop", // Room with lots of plants
      "https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=800&h=600&fit=crop", // Modern room with plants
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop", // Bright room with plants
    ];
    const placeholder =
      plantImages[Math.floor(Math.random() * plantImages.length)];
    console.log("Using placeholder image:", placeholder);
    return { imageUri: placeholder, isGenerated: false };
  }

  private extractUrlFromText(text: string): string | null {
    // Look for image URLs in the text
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  }
}

export const createGeminiService = (apiKey?: string) => {
  const key = apiKey || env.getGeminiApiKey();
  return new GeminiService(key);
};
