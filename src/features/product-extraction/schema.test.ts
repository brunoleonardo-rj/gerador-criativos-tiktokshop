import { describe, expect, it } from "vitest";
import { productExtractionSchema } from "./schema";

const validExtraction = {
  nomeProduto: "Garrafa térmica",
  categoria: "Casa e cozinha",
  descricaoPdp: "Garrafa térmica de aço inoxidável.",
  avaliacoes: "Excelente produto.",
  notaMedia: 4.8,
  quantidadeAvaliacoes: 124,
  precoAtual: "R$ 89,90",
  precoAnterior: "R$ 109,90",
  especificacoesCriticas: ["Capacidade: 500 ml"],
  publicoAlvo: "Pessoas que desejam manter bebidas na temperatura.",
  avisos: [],
  formatoUso: "manuseado" as const,
  zonaFoco: "maos" as const,
  detalheCritico: null,
};

describe("schema de extração de produto", () => {
  it("accepts unknown facts only as null or empty arrays", () => {
    expect(productExtractionSchema.parse({
      nomeProduto: null, categoria: null, descricaoPdp: null,
      avaliacoes: null, notaMedia: null, quantidadeAvaliacoes: null,
      precoAtual: null, precoAnterior: null,
      especificacoesCriticas: [], publicoAlvo: null, avisos: ["Texto ilegível."],
      formatoUso: null, zonaFoco: null, detalheCritico: null,
    }).nomeProduto).toBeNull();
  });

  it("rejects invented extra properties", () => {
    expect(() => productExtractionSchema.parse({ ...validExtraction, confianca: 0.9 })).toThrow();
  });
});
