import { describe, expect, it } from "vitest";
import { creativeBatchFixture } from "../../../tests/fixtures/creative-result";
import { AnthropicSdkAdapter, FakeAnthropicAdapter, getAnthropicPort } from "./anthropic-port";

const request = { model: "claude-test", system: [{ type: "text" as const, text: "system" }], messages: [{ role: "user" as const, content: "input" }] };
describe("AnthropicSdkAdapter", () => {
  it("selects a functional deterministic fake only outside production", async () => {
    const fake = getAnthropicPort({ NODE_ENV: "test", E2E_FAKE_ANTHROPIC: "1" });
    expect(fake).toBeInstanceOf(FakeAnthropicAdapter);
    await expect(fake.generate("never-used", request, new AbortController().signal)).resolves.toMatchObject({ batch: { creatives: [{ id: "e2e-creative-1" }] } });
    expect(getAnthropicPort({ NODE_ENV: "production", E2E_FAKE_ANTHROPIC: "1" })).toBeInstanceOf(AnthropicSdkAdapter);
  });
  it("uses structured output, one text block, and usage counters", async () => {
    const create = async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(creativeBatchFixture()) }], usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 } });
    const adapter = new AnthropicSdkAdapter(() => ({ messages: { create } } as never));
    await expect(adapter.generate("secret", request, new AbortController().signal)).resolves.toMatchObject({ usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 } });
  });
  it("rejects refusal and invalid JSON as safe errors", async () => {
    const refusal = new AnthropicSdkAdapter(() => ({ messages: { create: async () => ({ stop_reason: "refusal", content: [], usage: {} }) } } as never));
    await expect(refusal.generate("secret", request, new AbortController().signal)).rejects.toMatchObject({ code: "REFUSAL" });
    const badJson = new AnthropicSdkAdapter(() => ({ messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: {} }) } } as never));
    await expect(badJson.generate("secret", request, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });
  it.each([[401, "INVALID_API_KEY"], [403, "INVALID_API_KEY"], [429, "RATE_LIMITED"], [500, "UPSTREAM_UNAVAILABLE"]] as const)("maps HTTP %i without exposing upstream details", async (status, code) => {
    const adapter = new AnthropicSdkAdapter(() => ({ messages: { create: async () => { throw { status, body: "private" }; } } } as never));
    await expect(adapter.generate("secret", request, new AbortController().signal)).rejects.toMatchObject({ code });
  });
  it("maps an aborted request to timeout", async () => {
    const controller = new AbortController(); controller.abort();
    const adapter = new AnthropicSdkAdapter(() => ({ messages: { create: async () => { throw new DOMException("aborted", "AbortError"); } } } as never));
    await expect(adapter.generate("secret", request, controller.signal)).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
