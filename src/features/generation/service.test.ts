import { describe, expect, it } from "vitest";
import { creativeBatchFixture, generationInputFixture } from "../../../tests/fixtures/creative-result";
import type { AnthropicPort } from "./anthropic-port";
import { GenerationService } from "./service";

const library = { getActiveSnapshot: async () => ({ schemaVersion: 1 as const, sourceSha256: "a".repeat(64), summary: { recordCount: 0, products: {}, mechanisms: {}, statuses: {} }, playbook: [], hashtagPatterns: [], creatives: [] }) };
const settings = (apiKey = "sk-ant-secret") => ({ getGenerationSettings: async () => ({ apiKey, model: "claude-test", veoTemplate: "Fala: {{copy_completa}}\nGemini: {{prompt_gemini}}\n{{speech_beats}}", geminiTemplate: "GEMINI {{produto}}", updatedAt: new Date("2026-01-01T00:00:00Z") }) });
const port = (batch = creativeBatchFixture()): AnthropicPort => ({ generate: async () => ({ batch, usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 } }) });

describe("GenerationService", () => {
  it("generates and renders VEO without exposing the key", async () => {
    const result = await new GenerationService(settings(), library, port()).generate({ input: generationInputFixture(), images: [] }, new AbortController().signal);
    expect(result.creatives[0].veoPrompt).toContain(result.creatives[0].copy.trecho1.texto);
    expect(result.creatives[0].promptGemini).toBe("GEMINI Garrafa térmica");
    expect(result.creatives[0].veoPrompt).toContain('On "água"');
    expect(JSON.stringify(result)).not.toContain("sk-ant-secret");
    expect(result.settingsUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("maps missing API configuration safely", async () => {
    await expect(new GenerationService({ getGenerationSettings: async () => { throw new Error("missing"); } }, library, port()).generate({ input: generationInputFixture(), images: [] }, new AbortController().signal)).rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
  });
});
