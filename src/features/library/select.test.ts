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
  it("é puro e respeita o teto de itens", () => {
    const antes = structuredClone(corpus);

    selectLibraryContext(corpus, { produto: "sem match", categoria: "inexistente", limit: 3 });

    expect(corpus).toEqual(antes);
    expect(selectLibraryContext(corpus, { produto: "calça flare", categoria: "moda", limit: 99 }).creatives.length).toBeLessThanOrEqual(24);
  });

  it("passou a devolver exemplos mesmo sem relevância, de propósito", () => {
    // Esta função antes devolvia lista vazia quando nada casava, para não poluir
    // com itens irrelevantes. A produção mostrou que o vazio é pior: sem nenhum
    // exemplo o modelo perde a voz da biblioteca, cai em CTA genérico e inventa
    // fatos para preencher. Um criativo de outro produto ainda ensina estrutura
    // de gancho, ritmo e forma de CTA — isso atravessa categorias.
    const selecionado = selectLibraryContext(corpus, { produto: "sem match", categoria: "inexistente", limit: 3 });

    expect(selecionado.creatives.length).toBeGreaterThan(0);
  });
});

describe("produtos que não casam com nada", () => {
  const corpus = {
    schemaVersion: 1 as const,
    sourceSha256: "a".repeat(64),
    summary: { recordCount: 0, products: {}, mechanisms: {}, statuses: {} },
    playbook: ["regra"],
    hashtagPatterns: ["#teste"],
    creatives: Array.from({ length: 20 }, (_, index) => ({
      numero: String(index), id: `c${index}`, autor: "@a", produto: `Produto ${index}`, duracao: "10",
      status: "Aprovado", confianca: "Alta", mecanismo: `mecanismo-${index % 4}`, tipoHook: "Hook",
      hook: "h", corpo: "c", prova: null, objecao: null, oferta: null, tipoCta: "Carrinho", cta: "cta",
      descricao: null, hashtags: ["#teste"], formulaAdaptavel: null, risco: "", notas: "", url: null, arquivoFonte: null,
    })),
  };

  it("ainda entrega referências quando nome e categoria não casam", () => {
    const contexto = selectLibraryContext(corpus, { produto: "Porta Ampolas Reforçado", categoria: "medicamentos", limit: 6 });

    // Devolver vazio fazia o modelo gerar sem exemplo nenhum — era a causa das
    // copies genéricas e dos fatos inventados.
    expect(contexto.creatives).toHaveLength(6);
  });

  it("prioriza mecanismos distintos no recurso final", () => {
    const contexto = selectLibraryContext(corpus, { produto: "Nada disso existe", categoria: "inexistente", limit: 4 });

    expect(new Set(contexto.creatives.map((c) => c.mecanismo)).size).toBe(4);
  });

  it("usa as palavras da categoria digitada quando ela não está no mapa", () => {
    const comProduto = { ...corpus, creatives: [
      { ...corpus.creatives[0], id: "organizador", produto: "Organizador de cozinha" },
      ...corpus.creatives.slice(1),
    ] };

    const contexto = selectLibraryContext(comProduto, { produto: "Algo inédito", categoria: "organizador", limit: 3 });

    expect(contexto.creatives[0].id).toBe("organizador");
  });

  it("continua priorizando quem casa por nome do produto", () => {
    const comProduto = { ...corpus, creatives: [
      ...corpus.creatives.slice(1),
      { ...corpus.creatives[0], id: "exato", produto: "Porta Ampolas Reforçado" },
    ] };

    const contexto = selectLibraryContext(comProduto, { produto: "Porta Ampolas Reforçado", categoria: "medicamentos", limit: 5 });

    expect(contexto.creatives[0].id).toBe("exato");
  });
});
