import "server-only";
import type { LibraryService } from "@/features/library/service";
import { selectLibraryContext } from "@/features/library/select";
import type { SettingsService } from "@/features/settings/service";
import { type AnthropicPort, GenerationFailure } from "./anthropic-port";
import { buildAnthropicPrompt, type GenerationImage } from "./prompt-builder";
import type { GenerationInput } from "./schema";
import { validateCreativeBatch, type GenerationEnvelope } from "./validation";

type SettingsApi = Pick<SettingsService, "getGenerationSettings">;
type LibraryApi = Pick<LibraryService, "getActiveSnapshot">;
export class GenerationService {
  constructor(private readonly settings: SettingsApi, private readonly library: LibraryApi, private readonly anthropic: AnthropicPort) {}
  async generate({ input, images }: { input: GenerationInput; images: GenerationImage[] }, signal: AbortSignal): Promise<GenerationEnvelope> {
    let settings;
    try { settings = await this.settings.getGenerationSettings(); } catch { throw new GenerationFailure("API_NOT_CONFIGURED"); }
    try {
      const snapshot = await this.library.getActiveSnapshot();
      const prompt = buildAnthropicPrompt({ input, library: selectLibraryContext(snapshot, { produto: input.nomeProduto, categoria: input.categoria }), images });
      const result = await this.anthropic.generate(settings.apiKey, { model: settings.model, ...prompt }, signal);
      return validateCreativeBatch(input, result.batch, settings.veoTemplate, settings.updatedAt.toISOString());
    } catch (error) { if (error instanceof GenerationFailure) throw error; throw new GenerationFailure("UPSTREAM_UNAVAILABLE"); }
  }
}
