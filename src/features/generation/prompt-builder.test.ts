import { describe, expect, it } from "vitest";
import { generationInputFixture } from "../../../tests/fixtures/creative-result";
import { buildAnthropicPrompt } from "./prompt-builder";

const library = { playbook: ["Use demonstração."], hashtagPatterns: ["#rotina"], creatives: [] };

describe("buildAnthropicPrompt", () => {
  it("keeps the stable library before dynamic product data", () => {
    const input = generationInputFixture();
    const prompt = buildAnthropicPrompt({ input, library, images: [] });
    expect(prompt.system[1]).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
    expect(prompt.system[1].text).not.toContain(input.nomeProduto);
    expect(prompt.messages[0].content.at(-1)).toMatchObject({ type: "text" });
  });

  it("sends verified images with their actual MIME type after the cache breakpoint", () => {
    const prompt = buildAnthropicPrompt({ input: generationInputFixture(), library, images: [{ role: "product", mediaType: "image/webp", data: "aGVsbG8=" }] });
    expect(prompt.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/webp", data: "aGVsbG8=" } });
  });
});
