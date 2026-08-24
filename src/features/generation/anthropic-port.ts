import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { failureForAnthropic, GenerationFailure } from "./anthropic-errors";
import { getAnthropicOutputFormat } from "./json-schema";
import { creativeBatchSchema, type CreativeBatch } from "./schema";

export { GenerationFailure, type GenerationErrorCode } from "./anthropic-errors";
export type AnthropicRequest = { model: string; system: TextBlockParam[]; messages: MessageParam[] };
export type AnthropicResult = { batch: CreativeBatch; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } };
export interface AnthropicPort { generate(apiKey: string, request: AnthropicRequest, signal: AbortSignal): Promise<AnthropicResult>; }
type Client = Pick<Anthropic, "messages">;

function warnInvalidOutput(response: { _request_id?: string | null; stop_reason?: string | null; usage?: { output_tokens?: number | null } }, reason: string, issues: Array<{ path: PropertyKey[]; code: string }> = []): void {
  const diagnostic = {
    requestId: response._request_id ?? null,
    stopReason: response.stop_reason ?? null,
    outputTokens: response.usage?.output_tokens ?? 0,
    reason,
    issues: issues.slice(0, 5).map((issue) => ({ path: issue.path.map(String).join("."), code: issue.code })),
  };
  console.warn(`[generation] invalid structured output ${JSON.stringify(diagnostic)}`);
}
function warnUpstreamUnavailable(error: unknown): void {
  const value = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  const diagnostic = {
    status: typeof value.status === "number" ? value.status : null,
    requestId: typeof value.request_id === "string" ? value.request_id : typeof value.requestId === "string" ? value.requestId : null,
    code: typeof value.code === "string" ? value.code : null,
    name: error instanceof Error ? error.name : null,
  };
  console.warn(`[generation] upstream unavailable ${JSON.stringify(diagnostic)}`);
}

export class AnthropicSdkAdapter implements AnthropicPort {
  constructor(private readonly makeClient: (apiKey: string) => Client = (apiKey) => new Anthropic({ apiKey, maxRetries: 0 })) {}
  async generate(apiKey: string, request: AnthropicRequest, signal: AbortSignal): Promise<AnthropicResult> {
    try {
      const response = await this.makeClient(apiKey).messages.create({ model: request.model, max_tokens: 32_000, system: request.system, messages: request.messages, output_config: { format: getAnthropicOutputFormat() } }, { signal });
      if (response.stop_reason === "refusal") throw new GenerationFailure("REFUSAL");
      if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
        warnInvalidOutput(response, response.stop_reason);
        throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      }
      const texts = response.content.filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text");
      if (texts.length !== 1 || !texts[0].text.trim()) {
        warnInvalidOutput(response, "unexpected_content");
        throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      }
      let decoded: unknown;
      try { decoded = JSON.parse(texts[0].text); }
      catch {
        warnInvalidOutput(response, "invalid_json");
        throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      }
      const parsed = creativeBatchSchema.safeParse(decoded);
      if (!parsed.success) {
        warnInvalidOutput(response, "schema_validation_failed", parsed.error.issues);
        throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      }
      const batch: CreativeBatch = parsed.data;
      return { batch, usage: { inputTokens: response.usage.input_tokens ?? 0, outputTokens: response.usage.output_tokens ?? 0, cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0 } };
    } catch (error) {
      const failure = failureForAnthropic(error, signal);
      if (failure.code === "UPSTREAM_UNAVAILABLE") warnUpstreamUnavailable(error);
      throw failure;
    }
  }
}

export class FakeAnthropicAdapter implements AnthropicPort {
  constructor(private readonly result: AnthropicResult = { batch: e2eCreativeBatch(), usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } }) {}
  async generate(): Promise<AnthropicResult> { return this.result; }
}

function e2eCreativeBatch(): CreativeBatch {
  return creativeBatchSchema.parse({
    produtoNormalizado: "Produto de teste", fatos: ["Use somente os fatos fornecidos."], riscos: [], checklistPublicacao: ["Revise antes de publicar."],
    creatives: [{ id: "e2e-creative-1", angulo: "Demonstração", ambiente: "cozinha", figurino: "camiseta neutra", pose: "segurando o produto", geminiSlots: { identidadeUgc: "Preserve exatamente a pessoa das imagens de referência.", produto: "Produto de teste", wardrobeLock: "Camiseta neutra sem estampas.", tecido: "Tecido liso com caimento natural.", evitar: "Não adicionar detalhes não confirmados.", calcado: "Tênis neutro, não usar salto.", cenario: "Cozinha clara e residencial.", iluminacao: "Luz natural lateral.", acao: "A personagem demonstra o uso do produto.", pose: "Em pé, postura relaxada.", enquadramentoExtra: "" }, speechBeats: [{ triggerWord: "produto", cameraMove: "quick push-in", gesture: "gesture beside the product", visibleResult: "the product remains fully visible" }], copy: { trecho1: { texto: "Eu uso este produto todos os dias na minha rotina e ele deixa tudo muito mais simples para mim.", palavras: 19, segundos: 10 }, trecho2: { texto: "É uma opção prática para quem busca facilitar pequenos cuidados sem complicar a rotina em casa.", palavras: 16, segundos: 10 }, trecho3: null }, descricao: "Demonstração simples do produto na rotina.", hashtags: ["#rotina", "#casa", "#pratico", "#bemestar", "#dicas"], pov: { texto: "POV: rotina prática 💧", palavras: 3, emoji: "💧" }, textoNaTela: null, descartavel: false, motivoDescartavel: null }],
  });
}

export function getAnthropicPort(environment: Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "E2E_FAKE_ANTHROPIC">> = process.env): AnthropicPort {
  if (environment.NODE_ENV !== "production" && environment.E2E_FAKE_ANTHROPIC === "1") return new FakeAnthropicAdapter();
  return new AnthropicSdkAdapter();
}
