import { describe, expect, it, vi } from "vitest";
import { GenerationFailure } from "@/features/generation/anthropic-errors";
import type { ProductExtractionPort } from "./anthropic-port";
import type { ProductSourceImage } from "./prompt";
import type { ProductExtraction } from "./schema";
import { ProductExtractionService } from "./service";

const signal = new AbortController().signal;
const jpegSource: ProductSourceImage = { mediaType: "image/jpeg", data: "base64-jpeg" };
const validExtraction: ProductExtraction = {
  nomeProduto: "Garrafa",
  categoria: "Casa",
  descricaoPdp: "Garrafa térmica.",
  avaliacoes: null,
  notaMedia: null,
  quantidadeAvaliacoes: null,
  precoAtual: "R$ 89,90",
  precoAnterior: null,
  especificacoesCriticas: ["Capacidade: 500 ml"],
  publicoAlvo: null,
  avisos: [],
  formatoUso: "manuseado",
  zonaFoco: "maos",
  detalheCritico: null,
};

const settings = () => ({
  getGenerationSettings: async () => ({
    apiKey: "sk-secret",
    model: "claude-test",
    veoTemplate: "Fala: {{copy_completa}}",
    geminiTemplate: "{{produto}}",
    veoPovTemplate: "POV: {{copy_trecho}}",
    geminiPovTemplate: "POV {{produto}}",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }),
});

describe("ProductExtractionService", () => {
  it("loads the configured key and model without exposing them", async () => {
    const extract = vi.fn().mockResolvedValue(validExtraction);

    const result = await new ProductExtractionService(settings(), { extract }).extract([jpegSource], signal);

    expect(extract).toHaveBeenCalledWith("sk-secret", expect.objectContaining({
      model: "claude-test",
      messages: [{ role: "user", content: expect.arrayContaining([
        expect.objectContaining({ type: "image", source: expect.objectContaining({ data: "base64-jpeg" }) }),
      ]) }],
    }), signal);
    expect(result.nomeProduto).toBe("Garrafa");
    expect(JSON.stringify(result)).not.toContain("sk-secret");
  });

  it("maps missing settings to API_NOT_CONFIGURED", async () => {
    const missingSettings = { getGenerationSettings: async () => { throw new Error("missing"); } };
    const port: ProductExtractionPort = { extract: async () => validExtraction };

    await expect(new ProductExtractionService(missingSettings, port).extract([jpegSource], signal))
      .rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
  });

  it("maps unexpected extraction failures to UPSTREAM_UNAVAILABLE", async () => {
    const port: ProductExtractionPort = { extract: async () => { throw new Error("private upstream details"); } };

    await expect(new ProductExtractionService(settings(), port).extract([jpegSource], signal))
      .rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("preserves classified generation failures", async () => {
    const expected = new GenerationFailure("RATE_LIMITED");
    const port: ProductExtractionPort = { extract: async () => { throw expected; } };

    await expect(new ProductExtractionService(settings(), port).extract([jpegSource], signal)).rejects.toBe(expected);
  });
});
