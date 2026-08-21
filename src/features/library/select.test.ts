import { describe, expect, it } from "vitest";
import type { LibraryCorpus } from "./schema";
import { selectLibraryContext } from "./select";

const corpusFixture: LibraryCorpus = {
  schemaVersion: 1, sourceSha256: "a".repeat(64), summary: { recordCount: 4, products: {}, mechanisms: {}, statuses: {} }, playbook: ["Regra"], hashtagPatterns: [],
  creatives: [
    { id: "1", produto: "Body splash masculino", status: "Copy falada", confianca: "Alta", mecanismo: "Depoimento pessoal", tipoHook: "", hook: null, corpo: null, prova: null, objecao: null, oferta: null, tipoCta: "", cta: null, descricao: null, hashtags: [], formulaAdaptavel: null, risco: "", notas: "", url: null },
    { id: "2", produto: "Kit body splash masculino", status: "Copy falada", confianca: "Alta", mecanismo: "Benefícios", tipoHook: "", hook: null, corpo: null, prova: null, objecao: null, oferta: null, tipoCta: "", cta: null, descricao: null, hashtags: [], formulaAdaptavel: null, risco: "", notas: "", url: null },
    { id: "3", produto: "Perfume masculino", status: "Copy falada", confianca: "Alta", mecanismo: "Demonstração", tipoHook: "", hook: null, corpo: null, prova: null, objecao: null, oferta: null, tipoCta: "", cta: null, descricao: null, hashtags: [], formulaAdaptavel: null, risco: "", notas: "", url: null },
    { id: "4", produto: "Calça flare", status: "Copy falada", confianca: "Alta", mecanismo: "Depoimento pessoal", tipoHook: "", hook: null, corpo: null, prova: null, objecao: null, oferta: null, tipoCta: "", cta: null, descricao: null, hashtags: [], formulaAdaptavel: null, risco: "", notas: "", url: null },
  ],
};

describe("selectLibraryContext", () => {
  it("prioriza o mesmo produto e completa por mecanismo sem mutar o corpus", () => {
    const before = structuredClone(corpusFixture);
    const selected = selectLibraryContext(corpusFixture, { produto: "Kit body splash masculino", categoria: "perfumaria", limit: 3 });
    expect(selected.creatives[0].produto.toLowerCase()).toContain("body splash");
    expect(new Set(selected.creatives.map((item) => item.mecanismo)).size).toBeGreaterThan(1);
    expect(corpusFixture).toEqual(before);
  });

  it("mantém seleção idêntica para entradas equivalentes", () => {
    expect(selectLibraryContext(corpusFixture, { produto: "body splash", categoria: "perfumaria", limit: 3 })).toEqual(selectLibraryContext(corpusFixture, { produto: "body splash", categoria: "perfumaria", limit: 3 }));
  });
});
