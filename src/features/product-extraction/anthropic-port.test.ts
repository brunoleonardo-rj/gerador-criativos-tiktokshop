import { describe, expect, it, vi } from "vitest";
import { buildProductExtractionPrompt, type ProductSourceImage } from "./prompt";
import type { ProductExtraction } from "./schema";
import {
  AnthropicProductExtractionAdapter,
  FakeProductExtractionAdapter,
  getProductExtractionPort,
} from "./anthropic-port";

const signal = new AbortController().signal;
const jpegSource: ProductSourceImage = { mediaType: "image/jpeg", data: "base64-jpeg" };
const validExtraction: ProductExtraction = {
  nomeProduto: "Garrafa",
  categoria: "Casa",
  descricaoPdp: "Garrafa térmica de 500 ml.",
  avaliacoes: "Mantém a água gelada.",
  notaMedia: 4.8,
  quantidadeAvaliacoes: 120,
  precoAtual: "R$ 89,90",
  precoAnterior: "R$ 109,90",
  especificacoesCriticas: ["Capacidade: 500 ml"],
  publicoAlvo: "Pessoas que levam água na rotina.",
  avisos: [],
  formatoUso: "manuseado",
  zonaFoco: "maos",
  detalheCritico: null,
};

function anthropicResponse(content: unknown[], stopReason = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 1,
      output_tokens: 2,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  };
}

const request = () => ({ model: "claude-test", ...buildProductExtractionPrompt([jpegSource]) });

describe("AnthropicProductExtractionAdapter", () => {
  it("uses a strict JSON schema and parses the single text block", async () => {
    const create = vi.fn().mockResolvedValue(anthropicResponse([{ type: "text", text: JSON.stringify(validExtraction) }]));

    const result = await new AnthropicProductExtractionAdapter(() => ({ messages: { create } } as never))
      .extract("secret", request(), signal);

    expect(result.nomeProduto).toBe("Garrafa");
    const schema = create.mock.calls[0]?.[0]?.output_config?.format?.schema;
    const serializedSchema = JSON.stringify(schema);
    expect(serializedSchema).not.toMatch(/"(?:minimum|maximum|minLength|maxLength|maxItems)":/);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: "claude-test",
      max_tokens: 4_000,
      output_config: {
        format: expect.objectContaining({
          type: "json_schema",
          schema: expect.objectContaining({ additionalProperties: false }),
        }),
      },
    }), { signal });
  });

  it("preserves refusals as REFUSAL", async () => {
    const create = vi.fn().mockResolvedValue(anthropicResponse([], "refusal"));
    const adapter = new AnthropicProductExtractionAdapter(() => ({ messages: { create } } as never));

    await expect(adapter.extract("secret", request(), signal)).rejects.toMatchObject({ code: "REFUSAL" });
  });

  it.each(["max_tokens", "model_context_window_exceeded"])(
    "rejects %s truncation as INVALID_MODEL_OUTPUT",
    async (stopReason) => {
      const create = vi.fn().mockResolvedValue(anthropicResponse([], stopReason));
      const adapter = new AnthropicProductExtractionAdapter(() => ({ messages: { create } } as never));

      await expect(adapter.extract("secret", request(), signal)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    },
  );

  it.each([
    ["no text blocks", []],
    ["multiple text blocks", [{ type: "text", text: JSON.stringify(validExtraction) }, { type: "text", text: "{}" }]],
  ])("rejects %s as INVALID_MODEL_OUTPUT", async (_case, content) => {
    const create = vi.fn().mockResolvedValue(anthropicResponse(content));
    const adapter = new AnthropicProductExtractionAdapter(() => ({ messages: { create } } as never));

    await expect(adapter.extract("secret", request(), signal)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it.each([
    ["invalid JSON", "{"],
    ["schema mismatch", JSON.stringify({ ...validExtraction, quantidadeAvaliacoes: -1 })],
  ])("rejects %s as INVALID_MODEL_OUTPUT", async (_case, text) => {
    const create = vi.fn().mockResolvedValue(anthropicResponse([{ type: "text", text }]));
    const adapter = new AnthropicProductExtractionAdapter(() => ({ messages: { create } } as never));

    await expect(adapter.extract("secret", request(), signal)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("uses the shared Anthropic error mapping", async () => {
    const create = vi.fn().mockRejectedValue({ status: 429, body: "private" });
    const adapter = new AnthropicProductExtractionAdapter(() => ({ messages: { create } } as never));

    await expect(adapter.extract("secret", request(), signal)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("getProductExtractionPort", () => {
  it("selects a functional deterministic fake only outside production", async () => {
    const fake = getProductExtractionPort({ NODE_ENV: "test", E2E_FAKE_ANTHROPIC: "1" });

    expect(fake).toBeInstanceOf(FakeProductExtractionAdapter);
    await expect(fake.extract("never-used", request(), signal)).resolves.toMatchObject({ nomeProduto: "Produto de teste" });
    expect(getProductExtractionPort({ NODE_ENV: "test", E2E_FAKE_ANTHROPIC: "0" }))
      .toBeInstanceOf(AnthropicProductExtractionAdapter);
    expect(getProductExtractionPort({ NODE_ENV: "production", E2E_FAKE_ANTHROPIC: "1" }))
      .toBeInstanceOf(AnthropicProductExtractionAdapter);
  });
});
