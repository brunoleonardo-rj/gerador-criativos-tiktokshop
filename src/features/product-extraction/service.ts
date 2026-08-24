import "server-only";
import { GenerationFailure } from "@/features/generation/anthropic-errors";
import type { SettingsService } from "@/features/settings/service";
import type { ProductExtractionPort } from "./anthropic-port";
import { buildProductExtractionPrompt, type ProductSourceImage } from "./prompt";
import type { ProductExtraction } from "./schema";

type SettingsApi = Pick<SettingsService, "getGenerationSettings">;

export class ProductExtractionService {
  constructor(
    private readonly settings: SettingsApi,
    private readonly anthropic: ProductExtractionPort,
  ) {}

  async extract(images: ProductSourceImage[], signal: AbortSignal): Promise<ProductExtraction> {
    let settings;
    try {
      settings = await this.settings.getGenerationSettings();
    } catch {
      throw new GenerationFailure("API_NOT_CONFIGURED");
    }

    try {
      return await this.anthropic.extract(
        settings.apiKey,
        { model: settings.model, ...buildProductExtractionPrompt(images) },
        signal,
      );
    } catch (error) {
      if (error instanceof GenerationFailure) throw error;
      throw new GenerationFailure("UPSTREAM_UNAVAILABLE");
    }
  }
}
