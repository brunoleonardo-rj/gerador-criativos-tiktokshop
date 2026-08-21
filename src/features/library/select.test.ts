import { describe, expect, it } from "vitest";
import type { LibraryCorpus, LibraryCreative } from "./schema";
import { selectLibraryContext } from "./select";
const creative = (id: string, produto: string, mecanismo: string): LibraryCreative => ({ numero: id, id, autor: "", produto, duracao: "", status: "Copy falada", confianca: "Alta", mecanismo, tipoHook: "", hook: null, corpo: null, prova: null, objecao: null, oferta: null, tipoCta: "", cta: null, descricao: null, hashtags: [], formulaAdaptavel: null, risco: "", notas: "", url: null, arquivoFonte: null });
const corpus: LibraryCorpus = { schemaVersion: 1, sourceSha256: "a".repeat(64), summary: { recordCount: 7, products: {}, mechanisms: {}, statuses: {} }, playbook: ["Regra"], hashtagPatterns: [], creatives: [creative("1", "Kit body splash masculino", "Depoimento"), creative("2", "Perfume masculino", "Benefícios"), creative("3", "Calça legging flare", "Demonstração"), creative("4", "Camiseta moda feminina", "Identidade"), creative("5", "Fatiador de legumes cozinha", "Demonstração"), creative("6", "Organizador de cozinha", "Benefícios"), creative("7", "Produto sem relação", "Outro")] };
describe("selectLibraryContext", () => {
  it("prioriza produto e termos genéricos sobre categoria", () => expect(selectLibraryContext(corpus, { produto: "kit body splash", categoria: "perfumaria", limit: 3 }).creatives.map((item) => item.id)).toEqual(["1", "2"]));
  it("seleciona somente o domínio compatível de moda, casa e perfumaria", () => {
    expect(selectLibraryContext(corpus, { produto: "sem match", categoria: "moda", limit: 12 }).creatives.map((item) => item.id)).toEqual(["3", "4"]);
    expect(selectLibraryContext(corpus, { produto: "sem match", categoria: "casa", limit: 12 }).creatives.map((item) => item.id)).toEqual(["5", "6"]);
    expect(selectLibraryContext(corpus, { produto: "sem match", categoria: "perfumaria", limit: 12 }).creatives.map((item) => item.id)).toEqual(["1", "2"]);
  });
  it("é puro, limitado e nunca preenche com itens de relevância zero", () => {
    const before = structuredClone(corpus); const selected = selectLibraryContext(corpus, { produto: "sem match", categoria: "inexistente", limit: 3 });
    expect(selected.creatives).toEqual([]); expect(corpus).toEqual(before); expect(selectLibraryContext(corpus, { produto: "calça flare", categoria: "moda", limit: 99 }).creatives.length).toBeLessThanOrEqual(24);
  });
});
