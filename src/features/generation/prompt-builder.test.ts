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

describe("ponto de cache", () => {
  const library = {
    playbook: ["regra estável"],
    hashtagPatterns: ["#padrao"],
    creatives: [],
  };
  const build = (creatives: typeof library.creatives) =>
    buildAnthropicPrompt({ input: generationInputFixture(), library: { ...library, creatives }, images: [] });

  it("marca o bloco estável, não o que muda por produto", () => {
    const { system } = build([]);

    expect(system).toHaveLength(3);
    expect(system[0].cache_control).toBeUndefined();
    expect(system[1].cache_control).toEqual({ type: "ephemeral" });
    expect(system[2].cache_control).toBeUndefined();
    expect(system[1].text).toContain("regra estável");
    expect(system[1].text).toContain("#padrao");
  });

  it("mantém o prefixo cacheado idêntico quando a seleção de criativos muda", () => {
    const a = build([]);
    const b = build([{ id: "x", produto: "Outro", mecanismo: "m", texto: "t" } as never]);

    expect(b.system[1].text).toBe(a.system[1].text);
    expect(b.system[2].text).not.toBe(a.system[2].text);
  });
});
