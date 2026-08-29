import "server-only";
import type { LibraryService } from "@/features/library/service";
import { selectLibraryContext } from "@/features/library/select";
import type { SettingsService } from "@/features/settings/service";
import { type AnthropicPort, GenerationFailure } from "./anthropic-port";
import { buildAnthropicPrompt, type GenerationImage } from "./prompt-builder";
import type { GenerationInput } from "./schema";
import { noopUsageRecorder, type UsageRecorder } from "./usage-repository";
import { validateCreativeBatch, type GenerationEnvelope } from "./validation";

// Sem isto, qualquer defeito nosso vira "A Anthropic não concluiu" sem deixar rastro no log.
export function warnUnexpectedFailure(stage: string, error: unknown): void {
  const diagnostic = {
    stage,
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    at: error instanceof Error ? error.stack?.split("\n")[1]?.trim() ?? null : null,
  };
  console.error(`[generation] unexpected failure ${JSON.stringify(diagnostic)}`);
}

type SettingsApi = Pick<SettingsService, "getGenerationSettings">;
type LibraryApi = Pick<LibraryService, "getActiveSnapshot">;
export class GenerationService {
  constructor(
    private readonly settings: SettingsApi,
    private readonly library: LibraryApi,
    private readonly anthropic: AnthropicPort,
    private readonly usage: UsageRecorder = noopUsageRecorder,
  ) {}

  // A geração já foi cobrada quando chegamos aqui: falhar ao registrar consumo
  // não pode derrubar a resposta do usuário.
  private async recordUsage(entry: Parameters<UsageRecorder["record"]>[0]): Promise<void> {
    try { await this.usage.record(entry); }
    catch (error) { warnUnexpectedFailure("usage", error); }
  }
  async generate({ input, images }: { input: GenerationInput; images: GenerationImage[] }, signal: AbortSignal): Promise<GenerationEnvelope> {
    let settings;
    try { settings = await this.settings.getGenerationSettings(); } catch { throw new GenerationFailure("API_NOT_CONFIGURED"); }
    try {
      const snapshot = await this.library.getActiveSnapshot();
      const prompt = buildAnthropicPrompt({ input, library: selectLibraryContext(snapshot, { produto: input.nomeProduto, categoria: input.categoria }), images });
      const result = await this.anthropic.generate(settings.apiKey, { model: settings.model, ...prompt }, signal);
      await this.recordUsage({
        model: settings.model,
        creativeCount: input.quantidadeCriativos,
        imageCount: images.length,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheWriteTokens: result.usage.cacheWriteTokens,
      });
      return validateCreativeBatch(input, result.batch, settings.veoTemplate, settings.geminiTemplate, settings.updatedAt.toISOString());
    } catch (error) {
      if (error instanceof GenerationFailure) throw error;
      warnUnexpectedFailure("service", error);
      throw new GenerationFailure("UPSTREAM_UNAVAILABLE");
    }
  }
}
