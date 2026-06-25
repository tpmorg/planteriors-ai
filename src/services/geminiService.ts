import { GoogleGenAI } from "@google/genai";
import {
  GenerationRequest,
  PlantOptions,
  IndividualPlantSelection,
  PlantSize,
  PlacementType,
  LightRequirement,
  PlantLocation,
} from "../types";
import { env } from "../utils/env";
import * as FileSystem from "expo-file-system/legacy";
import NetInfo from '@react-native-community/netinfo';
import { compressImageForAI } from "../utils/imageUtils";

// Image generation/editing model - takes input image + prompt to create modified version
const MODEL_NAME = "gemini-2.5-flash-image";
const INTERACTIONS_MODEL_NAME = "gemini-3.1-flash-image";

export class GeminiService {
  private client: GoogleGenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  async generatePlantImage(
    request: GenerationRequest,
  ): Promise<{ imageUri: string; isGenerated: boolean }> {
    try {
      // Safety check for network availability
      const network = await NetInfo.fetch();
      if (!network.isConnected) {
        throw new Error("No internet connection. Please check your network and try again.");
      }

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

      try {
        console.log("Making Gemini Interactions API request...");
        return await this.generateWithInteractionsApi(promptText, base64, mimeType);
      } catch (interactionsError) {
        console.warn(
          "Gemini Interactions API image generation failed, falling back to generateContent:",
          interactionsError,
        );
      }

      console.log("Making Gemini generateContent API request...");

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

  private async generateWithInteractionsApi(
    promptText: string,
    base64: string,
    mimeType: string,
  ): Promise<{ imageUri: string; isGenerated: boolean }> {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          model: INTERACTIONS_MODEL_NAME,
          input: [
            { type: "text", text: promptText },
            {
              type: "image",
              mime_type: mimeType,
              data: base64,
            },
          ],
          response_format: {
            type: "image",
            mime_type: "image/jpeg",
          },
        }),
      },
    );

    const responseText = await response.text();
    let payload: any = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        responseText ||
        `Gemini Interactions API failed with status ${response.status}`;
      throw new Error(message);
    }

    const outputImage = this.findImageBlock(payload);

    const imageData =
      outputImage?.data ||
      outputImage?.inlineData?.data ||
      outputImage?.inline_data?.data;
    const outputMimeType =
      outputImage?.mime_type ||
      outputImage?.mimeType ||
      outputImage?.inlineData?.mimeType ||
      outputImage?.inline_data?.mime_type ||
      "image/jpeg";

    if (!imageData) {
      console.log("Interactions API response keys:", Object.keys(payload || {}));
      throw new Error("No output image returned from Gemini Interactions API");
    }

    console.log("Found Interactions API output image");
    console.log("Image data size:", `${Math.round(imageData.length / 1024)}KB`);
    console.log("Image MIME type:", outputMimeType);

    return {
      imageUri: `data:${outputMimeType};base64,${imageData}`,
      isGenerated: true,
    };
  }

  private findImageBlock(value: any): any | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    if (value.output_image || value.outputImage) {
      return value.output_image || value.outputImage;
    }

    if (
      (value.type === "image" || value.mime_type?.startsWith?.("image/") || value.mimeType?.startsWith?.("image/")) &&
      value.data
    ) {
      return value;
    }

    if (value.inlineData?.data || value.inline_data?.data) {
      return value;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const imageBlock = this.findImageBlock(item);
        if (imageBlock) {
          return imageBlock;
        }
      }
      return null;
    }

    for (const key of Object.keys(value)) {
      const imageBlock = this.findImageBlock(value[key]);
      if (imageBlock) {
        return imageBlock;
      }
    }

    return null;
  }

  private buildPrompt(request: GenerationRequest): string {
    // Check mode and delegate to appropriate method
    if (request.mode === 'replace-plant' && request.individualPlant) {
      return this.buildReplacePlantPrompt(request.individualPlant, request.prompt, request.location);
    }
    if (request.mode === 'individual' && request.individualPlant) {
      return this.buildIndividualPlantPrompt(request.individualPlant, request.prompt, request.location);
    }
    return this.buildMultiPlantPrompt(request);
  }

  private buildReplacePlantPrompt(
    selection: IndividualPlantSelection,
    customPrompt?: string,
    location?: PlantLocation
  ): string {
    const { plant, size } = selection;

    const sizeDescriptions: Record<PlantSize, string> = {
      small: 'a small, compact (6-12 inch)',
      medium: 'a medium-sized (1-3 foot)',
      large: 'a large, statement (3-6 foot)',
    };

    let targetInstruction = `
TARGET PLANT:
Identify the most prominent existing houseplant in the image and replace that plant only.`;

    if (location) {
      const horizontalPosition = this.getHorizontalPosition(location.x, location.width);
      const verticalPosition = this.getVerticalPosition(location.y, location.height);
      const areaSize = this.getAreaSizeDescription(location.width, location.height);

      targetInstruction = `
HIGHEST PRIORITY - USER MARKED PLANT TO REPLACE:
The user has specifically marked the current plant to replace:
- Horizontal position: ${horizontalPosition}
- Vertical position: ${verticalPosition}
- Marked area size: ${areaSize}
- Replace the plant inside this marked region only
- Preserve the plant's original support surface, surrounding furniture, and nearby decor exactly
- Do NOT replace or alter plants outside this marked region`;
    }

    return `Replace an existing plant in this room image with a single ${sizeDescriptions[size]} ${plant.name} (${plant.scientificName}).

Replacement Plant Details:
- Common Name: ${plant.name}
- Scientific Name: ${plant.scientificName}
- Description: ${plant.description}
- Target size: ${sizeDescriptions[size]} specimen, scaled to fit the same real-world location as the current plant
${targetInstruction}

Critical Requirements:
1. This is a plant replacement, not a new plant placement
2. Remove the current plant being replaced and put the ${plant.name} in that same location
3. Keep the same pot or planter if it plausibly fits; otherwise use a similar pot that matches the room and original placement
4. Preserve the original room layout, camera angle, lighting, walls, flooring, furniture, and decor exactly
5. Do NOT add extra plants, duplicate the plant, move furniture, change art, change rugs, or redesign the room
6. Match the new plant's shadows, perspective, reflections, and occlusion to the original photo
7. Keep the support surface believable and physically stable
8. If the original plant is partially hidden behind furniture or decor, preserve that natural occlusion

${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Generate this as a high-quality photorealistic image where the current plant has been cleanly swapped for the selected ${plant.name}.`;
  }

  private buildIndividualPlantPrompt(
    selection: IndividualPlantSelection,
    customPrompt?: string,
    location?: PlantLocation
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
      auto: 'placed in the most realistic spot based on the room layout and available surfaces',
    };

    // Light requirement context for realistic placement
    const lightContexts: Record<LightRequirement, string> = {
      'low': 'Position it in a spot with indirect or low light - away from direct window exposure, such as a corner or north-facing area',
      'low-to-bright': 'This plant is versatile and can be placed anywhere with any light level',
      'bright-indirect': 'Position it near a window but not in direct sunlight - filtered light through curtains is ideal',
      'bright-direct': 'Place it in a sunny spot where it would receive direct sunlight from a window',
    };

    // Build location instruction if provided
    let locationInstruction = '';
    if (location) {
      // Convert normalized coordinates to percentage descriptions for the AI
      const horizontalPosition = this.getHorizontalPosition(location.x, location.width);
      const verticalPosition = this.getVerticalPosition(location.y, location.height);
      const areaSize = this.getAreaSizeDescription(location.width, location.height);

      locationInstruction = `
HIGHEST PRIORITY - USER MARKED LOCATION:
The user has specifically marked where they want the plant placed:
- Horizontal position: ${horizontalPosition}
- Vertical position: ${verticalPosition}
- Target area size: ${areaSize}
- The plant MUST be placed within this specified region of the image
- Do NOT place the plant anywhere else - respect the user's chosen location exactly
- If the marked location conflicts with a placement preference, adjust the placement to fit the marked region`;
    }

    const hasExplicitPlacement = placement !== 'auto';
    const validSupportInstruction = 'Use only realistic plant support locations: floor areas, plant stands, shelves, windowsills, side tables, coffee tables, counters, or sturdy built-in surfaces. Never place plants or planters on couches, sofas, chairs, beds, pillows, blankets, or seat cushions.';

    const placementInstruction = hasExplicitPlacement
      ? `The plant MUST be ${placementDescriptions[placement]}. This placement preference is a top priority.`
      : `Choose the most realistic placement based on the room layout, valid plant support surfaces, and the plant’s light needs. ${validSupportInstruction} Ensure physical support, avoid blocking walkways, and keep the placement believable.`;

    return `Add a single ${sizeDescriptions[size]} ${plant.name} (${plant.scientificName}) to this room image.

Plant Details:
- Common Name: ${plant.name}
- Scientific Name: ${plant.scientificName}
- Description: ${plant.description}
- ${placementInstruction}
- ${validSupportInstruction}
- ${lightContexts[plant.lightRequirement]}
${locationInstruction}

Critical Requirements:
1. Add ONLY ONE plant - a single ${plant.name}
2. The plant must be ${sizeDescriptions[size]} specimen, appropriately scaled to the room
3. Use an attractive pot or planter that complements the room's existing style and color palette
${location ? '4. Place the plant EXACTLY in the user-specified location marked above (highest priority)' : hasExplicitPlacement ? '4. Follow the placement preference exactly (floor/shelf/hanging) as a top priority' : '4. Choose the most realistic placement based on physics, room layout, and light needs'}
5. Maintain photorealistic quality with proper shadows, reflections, and lighting
6. Keep ALL original room elements, furniture, and architecture EXACTLY as shown
7. The plant should enhance the space as a single accent piece without overwhelming it
8. Match the perspective, angle, and lighting of the original photo precisely
9. Do NOT add, remove, move, or redesign any non-plant physical objects (including tables, chairs, sofas, lamps, rugs, art, shelves, appliances, fixtures, or decor)
10. The only allowed additions are the plant and its required pot/planter (and hanging support only if hanging placement is requested)
11. Do not use soft furniture or bedding as a plant support surface, even if visually open
12. Ignore any non-plant modifications unless the user explicitly and directly requests that specific object change

${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Generate this as a high-quality photorealistic image with the single ${plant.name} seamlessly integrated into the room.`;
  }

  private getHorizontalPosition(x: number, width: number): string {
    const centerX = x + width / 2;
    if (centerX < 0.33) return 'left side of the image';
    if (centerX < 0.66) return 'center of the image';
    return 'right side of the image';
  }

  private getVerticalPosition(y: number, height: number): string {
    const centerY = y + height / 2;
    if (centerY < 0.33) return 'upper portion of the image';
    if (centerY < 0.66) return 'middle portion of the image';
    return 'lower portion of the image';
  }

  private getAreaSizeDescription(width: number, height: number): string {
    const area = width * height;
    if (area < 0.05) return 'small area (subtle accent)';
    if (area < 0.15) return 'medium area';
    if (area < 0.30) return 'large area';
    return 'very large area (major focal point)';
  }

  private buildMultiPlantPrompt(request: GenerationRequest): string {
    const { plantType, plantStyle, plantOptions } = request;

    if (!plantType || !plantStyle) {
      throw new Error('Plant type and style are required for multi-plant mode');
    }

    // Build container description based on plant options
    const containerDescription = this.buildContainerDescription(plantOptions);
    const densityDescription = this.buildDensityDescription(plantOptions, plantType.id);
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

Hard Constraints:
- Preserve all existing non-plant physical objects exactly as they are.
- Do NOT add, remove, move, or alter furniture or decor (tables, chairs, sofas, lamps, rugs, art, shelves, appliances, fixtures, etc.).
- The only new objects allowed are plants and their necessary containers/planters.
- Use only realistic plant support locations: floor areas, plant stands, shelves, windowsills, side tables, coffee tables, counters, or sturdy built-in surfaces.
- Never place plants or planters on couches, sofas, chairs, beds, pillows, blankets, or seat cushions.
- Follow the density limit exactly. If the selected density is Sparse, the plant count cap is more important than making the style look lush, cascading, or abundant.
- Ignore non-plant object changes unless the user explicitly asks for that exact object change.

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

  private buildDensityDescription(plantOptions?: PlantOptions, plantTypeId?: string): string {
    if (!plantOptions) return "";

    const { placementDensity } = plantOptions;
    const isHanging = plantTypeId === 'hanging';

    const densityInstructions: Record<string, string> = {
      sparse: isHanging
        ? "- Density: SPARSE HARD LIMIT. Add exactly 1 hanging planter, or at most 2 only if the room has two obvious, physically supported anchor points. Do not add rows of hanging plants, wall clusters, ceiling grids, shelf plants, floor plants, or extra trailing greenery. Most of the room should remain unchanged and visually open"
        : "- Density: SPARSE HARD LIMIT. Add exactly 1-2 plants total, never more than 2 visible plants or planters. Treat them as quiet accent pieces with generous empty space around them. Do not fill shelves, corners, windowsills, tables, or multiple surfaces",
      moderate:
        "- Density: Add a balanced amount of greenery with 3-5 plants distributed through the space. Avoid crowding every surface",
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
    console.log("=== GEMINI API RESPONSE METADATA ===");

    // Token usage and cost tracking
    if (response.usageMetadata) {
      const usage = response.usageMetadata;
      console.log("Token Usage:");
      console.log("  - Prompt tokens:", usage.promptTokenCount || 0);
      console.log("  - Response tokens:", usage.candidatesTokenCount || 0);
      console.log("  - Total tokens:", usage.totalTokenCount || 0);

      // Cost estimation (Gemini 2.5 Flash pricing as of Jan 2025)
      // Input: $0.00001875 per 1K tokens ($0.075 per 1M)
      // Output: $0.000075 per 1K tokens ($0.30 per 1M)
      // Image input: $0.0025 per image
      const inputCost = (usage.promptTokenCount || 0) * 0.00001875 / 1000;
      const outputCost = (usage.candidatesTokenCount || 0) * 0.000075 / 1000;
      const imageCost = 0.0025; // Fixed cost per input image
      const totalCost = inputCost + outputCost + imageCost;

      console.log("Cost Estimate:");
      console.log(`  - Input cost: $${inputCost.toFixed(6)}`);
      console.log(`  - Output cost: $${outputCost.toFixed(6)}`);
      console.log(`  - Image cost: $${imageCost.toFixed(6)}`);
      console.log(`  - Total cost: $${totalCost.toFixed(6)}`);
    }

    // Model and response metadata
    console.log("Response Metadata:");
    console.log("  - Model:", MODEL_NAME);
    console.log("  - Candidates:", response.candidates?.length || 0);
    console.log("  - Parts in first candidate:", response.candidates?.[0]?.content?.parts?.length || 0);

    if (response.candidates?.[0]) {
      const candidate = response.candidates[0];
      console.log("  - Finish reason:", candidate.finishReason || "unknown");
      console.log("  - Safety ratings:", candidate.safetyRatings?.length || 0);

      // Log safety ratings if present
      if (candidate.safetyRatings) {
        candidate.safetyRatings.forEach((rating: any) => {
          console.log(`    - ${rating.category}: ${rating.probability}`);
        });
      }
    }

    console.log("====================================");

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
      } else if (part.inlineData || part.inline_data) {
        const inlineData = part.inlineData || part.inline_data;
        console.log("Found inlineData image part");
        console.log(
          "Image data size:",
          `${Math.round(inlineData.data.length / 1024)}KB`,
        );
        const mimeType = inlineData.mimeType || inlineData.mime_type || "image/jpeg";
        console.log("Image MIME type:", mimeType);

        // Convert base64 data to data URI
        const dataUri = `data:${mimeType};base64,${inlineData.data}`;
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
