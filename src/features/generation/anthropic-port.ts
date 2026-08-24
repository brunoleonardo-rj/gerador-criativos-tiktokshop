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

export class AnthropicSdkAdapter implements AnthropicPort {
  constructor(private readonly makeClient: (apiKey: string) => Client = (apiKey) => new Anthropic({ apiKey, maxRetries: 0 })) {}
  async generate(apiKey: string, request: AnthropicRequest, signal: AbortSignal): Promise<AnthropicResult> {
    try {
      const response = await this.makeClient(apiKey).messages.create({ model: request.model, max_tokens: 16_000, system: request.system, messages: request.messages, output_config: { format: getAnthropicOutputFormat() } }, { signal });
      if (response.stop_reason === "refusal") throw new GenerationFailure("REFUSAL");
      if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      const texts = response.content.filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text");
      if (texts.length !== 1 || !texts[0].text.trim()) throw new GenerationFailure("INVALID_MODEL_OUTPUT");
      let batch: CreativeBatch;
      try { batch = creativeBatchSchema.parse(JSON.parse(texts[0].text)); } catch { throw new GenerationFailure("INVALID_MODEL_OUTPUT"); }
      return { batch, usage: { inputTokens: response.usage.input_tokens ?? 0, outputTokens: response.usage.output_tokens ?? 0, cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0 } };
    } catch (error) { throw failureForAnthropic(error, signal); }
  }
}

export class FakeAnthropicAdapter implements AnthropicPort {
  constructor(private readonly result: AnthropicResult = { batch: e2eCreativeBatch(), usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } }) {}
  async generate(): Promise<AnthropicResult> { return this.result; }
}

function e2eCreativeBatch(): CreativeBatch {
  return creativeBatchSchema.parse({
    produtoNormalizado: "Produto de teste", fatos: ["Use somente os fatos fornecidos."], riscos: [], checklistPublicacao: ["Revise antes de publicar."],
    creatives: [{ id: "e2e-creative-1", angulo: "Demonstração", ambiente: "cozinha", figurino: "camiseta neutra", pose: "segurando o produto", promptGemini: "Cenário: cozinha\nPessoa: adulta\nProduto: produto de teste\nAção: demonstra o uso\nEnquadramento: médio\nIluminação: natural\nÁudio: fala em português brasileiro\nEstilo: UGC natural\nRestrições: sem texto na tela e sem sobreposições visuais", copy: { trecho1: { texto: "Eu uso este produto todos os dias na minha rotina e ele deixa tudo muito mais simples para mim.", palavras: 19, segundos: 10 }, trecho2: { texto: "É uma opção prática para quem busca facilitar pequenos cuidados sem complicar a rotina em casa.", palavras: 16, segundos: 10 }, trecho3: null }, descricao: "Demonstração simples do produto na rotina.", hashtags: ["#rotina", "#casa", "#pratico", "#bemestar", "#dicas"], pov: { texto: "POV: rotina prática 💧", palavras: 3, emoji: "💧" }, textoNaTela: null, descartavel: false, motivoDescartavel: null }],
  });
}

export function getAnthropicPort(environment: Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "E2E_FAKE_ANTHROPIC">> = process.env): AnthropicPort {
  if (environment.NODE_ENV !== "production" && environment.E2E_FAKE_ANTHROPIC === "1") return new FakeAnthropicAdapter();
  return new AnthropicSdkAdapter();
}
