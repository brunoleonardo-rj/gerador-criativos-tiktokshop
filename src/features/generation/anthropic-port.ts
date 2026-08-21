import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { getAnthropicOutputFormat } from "./json-schema";
import { creativeBatchSchema, type CreativeBatch } from "./schema";

export type GenerationErrorCode = "API_NOT_CONFIGURED" | "INVALID_API_KEY" | "RATE_LIMITED" | "REFUSAL" | "TIMEOUT" | "INVALID_MODEL_OUTPUT" | "UPSTREAM_UNAVAILABLE";
export class GenerationFailure extends Error { constructor(readonly code: GenerationErrorCode) { super(code); } }
export type AnthropicRequest = { model: string; system: TextBlockParam[]; messages: MessageParam[] };
export type AnthropicResult = { batch: CreativeBatch; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } };
export interface AnthropicPort { generate(apiKey: string, request: AnthropicRequest, signal: AbortSignal): Promise<AnthropicResult>; }
type Client = Pick<Anthropic, "messages">;

function failureFor(error: unknown, signal: AbortSignal): GenerationFailure {
  if (error instanceof GenerationFailure) return error;
  if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return new GenerationFailure("TIMEOUT");
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status?: unknown }).status : undefined;
  if (status === 401 || status === 403) return new GenerationFailure("INVALID_API_KEY");
  if (status === 429) return new GenerationFailure("RATE_LIMITED");
  return new GenerationFailure("UPSTREAM_UNAVAILABLE");
}

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
    } catch (error) { throw failureFor(error, signal); }
  }
}

export class FakeAnthropicAdapter implements AnthropicPort {
  constructor(private readonly result: AnthropicResult) {}
  async generate(): Promise<AnthropicResult> { return this.result; }
}

export function getAnthropicPort(): AnthropicPort {
  if (process.env.NODE_ENV !== "production" && process.env.E2E_FAKE_ANTHROPIC === "1") throw new Error("Fake Anthropic requires explicit test injection");
  return new AnthropicSdkAdapter();
}
