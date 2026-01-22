import { GoogleGenAI } from "@google/genai";
import { GenerationRequest, PlantOptions } from "../types";
import { env } from "../utils/env";
import * as FileSystem from "expo-file-system/legacy";

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

      console.log("Converting local file to base64...");
      const base64 = await FileSystem.readAsStringAsync(request.imageUri, {
        encoding: "base64",
      });

      // Get the file extension to determine MIME type
      const extension = request.imageUri.split(".").pop()?.toLowerCase();
      const mimeType = extension === "png" ? "image/png" : "image/jpeg";

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
    const { plantType, plantStyle, plantOptions } = request;

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
