import { describe, expect, it } from "vitest";
import { creativeBatchFixture, generationInputFixture } from "../../../tests/fixtures/creative-result";
import type { AnthropicPort } from "./anthropic-port";
import { GenerationService } from "./service";

const library = { getActiveSnapshot: async () => ({ schemaVersion: 1 as const, sourceSha256: "a".repeat(64), summary: { recordCount: 0, products: {}, mechanisms: {}, statuses: {} }, playbook: [], hashtagPatterns: [], creatives: [] }) };
const settings = (apiKey = "sk-ant-secret") => ({ getGenerationSettings: async () => ({ apiKey, model: "claude-test", veoTemplate: "Fala: {{copy_trecho}}\nGemini: {{prompt_gemini}}\n{{speech_beats}}", geminiTemplate: "GEMINI {{produto}}", veoPovTemplate: "POV fala: {{copy_trecho}}", geminiPovTemplate: "POV {{produto}}", updatedAt: new Date("2026-01-01T00:00:00Z") }) });
const port = (batch = creativeBatchFixture()): AnthropicPort => ({ generate: async () => ({ batch, usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 } }) });

describe("GenerationService", () => {
  it("generates and renders VEO without exposing the key", async () => {
    const result = await new GenerationService(settings(), library, port()).generate({ input: generationInputFixture(), images: [] }, new AbortController().signal);
    expect(result.creatives[0].veoPrompts.trecho1).toContain(result.creatives[0].copy.trecho1.texto);
    expect(result.creatives[0].promptGemini).toBe("GEMINI Garrafa térmica");
    expect(result.creatives[0].veoPrompts.trecho1).toContain('On "água"');
    expect(JSON.stringify(result)).not.toContain("sk-ant-secret");
    expect(result.settingsUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("records what the generation consumed", async () => {
    const recorded: unknown[] = [];
    const input = generationInputFixture();

    await new GenerationService(settings(), library, port(), { record: async (entry) => { recorded.push(entry); } })
      .generate({ input, images: [{ role: "product", mediaType: "image/png", data: "AAA" }] }, new AbortController().signal);

    expect(recorded).toEqual([{
      model: "claude-test",
      creativeCount: input.quantidadeCriativos,
      imageCount: 1,
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
    }]);
  });

  it("still returns the batch when recording usage fails", async () => {
    const failing = { record: async () => { throw new Error("banco fora do ar"); } };

    const result = await new GenerationService(settings(), library, port(), failing)
      .generate({ input: generationInputFixture(), images: [] }, new AbortController().signal);

    expect(result.creatives).not.toHaveLength(0);
  });

  it("maps missing API configuration safely", async () => {
    await expect(new GenerationService({ getGenerationSettings: async () => { throw new Error("missing"); } }, library, port()).generate({ input: generationInputFixture(), images: [] }, new AbortController().signal)).rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
  });
});
