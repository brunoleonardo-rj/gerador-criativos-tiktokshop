import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { failureForAnthropic, GenerationFailure } from "@/features/generation/anthropic-errors";
import { productExtractionSchema, type ProductExtraction } from "./schema";

export type ProductExtractionRequest = {
  model: string;
  system: TextBlockParam[];
  messages: MessageParam[];
};

export interface ProductExtractionPort {
  extract(apiKey: string, request: ProductExtractionRequest, signal: AbortSignal): Promise<ProductExtraction>;
}

type Client = Pick<Anthropic, "messages">;

export class AnthropicProductExtractionAdapter implements ProductExtractionPort {
  constructor(private readonly makeClient: (apiKey: string) => Client = (apiKey) => new Anthropic({ apiKey, maxRetries: 0 })) {}

  async extract(apiKey: string, request: ProductExtractionRequest, signal: AbortSignal): Promise<ProductExtraction> {
    try {
      const response = await this.makeClient(apiKey).messages.create({
        model: request.model,
        max_tokens: 4_000,
        system: request.system,
        messages: request.messages,
        output_config: {
          format: zodOutputFormat(productExtractionSchema),
        },
      }, { signal });

      if (response.stop_reason === "refusal") throw new GenerationFailure("REFUSAL");
      if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
        throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      }

      const texts = response.content.filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text");
      if (texts.length !== 1 || !texts[0].text.trim()) throw new GenerationFailure("INVALID_MODEL_OUTPUT");

      try {
        return productExtractionSchema.parse(JSON.parse(texts[0].text));
      } catch {
        throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      }
    } catch (error) {
      throw failureForAnthropic(error, signal);
    }
  }
}

export class FakeProductExtractionAdapter implements ProductExtractionPort {
  constructor(private readonly result: ProductExtraction = e2eProductExtraction()) {}

  async extract(): Promise<ProductExtraction> {
    return this.result;
  }
}

function e2eProductExtraction(): ProductExtraction {
  return productExtractionSchema.parse({
    nomeProduto: "Produto de teste",
    categoria: null,
    descricaoPdp: null,
    avaliacoes: null,
    notaMedia: null,
    quantidadeAvaliacoes: null,
    precoAtual: null,
    precoAnterior: null,
    especificacoesCriticas: [],
    publicoAlvo: null,
    avisos: [],
  });
}

export function getProductExtractionPort(
  environment: Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "E2E_FAKE_ANTHROPIC">> = process.env,
): ProductExtractionPort {
  if (environment.NODE_ENV !== "production" && environment.E2E_FAKE_ANTHROPIC === "1") {
    return new FakeProductExtractionAdapter();
  }
  return new AnthropicProductExtractionAdapter();
}
