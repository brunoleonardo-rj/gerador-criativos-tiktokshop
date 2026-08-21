import { describe, expect, it } from "vitest";
import type { LibraryCorpus } from "./schema";
import { serializeCorpus } from "./serialize";

const corpusFixture: LibraryCorpus = {
  schemaVersion: 1, sourceSha256: "a".repeat(64),
  summary: { recordCount: 1, products: { "Body splash": 1 }, mechanisms: { "Depoimento pessoal": 1 }, statuses: { "Copy falada": 1 } },
  playbook: ["Regra"], hashtagPatterns: ["#teste"],
  creatives: [{ numero: "1", id: "1", autor: "", produto: "Body splash", duracao: "10 segundos", status: "Copy falada", confianca: "Alta", mecanismo: "Depoimento pessoal", tipoHook: "Declaração", hook: "Hook", corpo: null, prova: null, objecao: null, oferta: null, tipoCta: "Carrinho", cta: null, descricao: null, hashtags: ["#teste"], formulaAdaptavel: null, risco: "Baixo", notas: "", url: null, arquivoFonte: null }],
};

describe("serializeCorpus", () => {
  it("produz os mesmos bytes para o mesmo corpus", () => {
    expect(serializeCorpus(corpusFixture)).toBe(serializeCorpus(structuredClone(corpusFixture)));
  });

  it("ordena chaves de resumo e criativos por ID", () => {
    const serialized = serializeCorpus({ ...corpusFixture, summary: { ...corpusFixture.summary, products: { Zebra: 1, Abacate: 1 } }, creatives: [{ ...corpusFixture.creatives[0], id: "2" }, corpusFixture.creatives[0]] });
    expect(serialized.indexOf('"Abacate"')).toBeLessThan(serialized.indexOf('"Zebra"'));
    expect(serialized.indexOf('"id":"1"')).toBeLessThan(serialized.indexOf('"id":"2"'));
  });
});
