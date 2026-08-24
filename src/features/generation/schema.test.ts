import { describe, expect, it } from "vitest";
import { creativeBatchSchema, generationInputSchema } from "./schema";
import { creativeBatchFixture, generationInputFixture } from "../../../tests/fixtures/creative-result";

describe("schema de geração", () => {
  it("rejeita propriedades extras recursivamente", () => {
    expect(() => generationInputSchema.parse({ ...generationInputFixture(), extra: true })).toThrow();
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ copy: { ...creativeBatchFixture().creatives[0].copy, trecho1: { ...creativeBatchFixture().creatives[0].copy.trecho1, extra: true } } }))).toThrow();
  });
  it("aceita trecho3 somente como objeto ou null", () => {
    expect(() => creativeBatchSchema.parse(creativeBatchFixture())).not.toThrow();
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ copy: { ...creativeBatchFixture().creatives[0].copy, trecho3: "não" } }))).toThrow();
  });
  it("exige motivo de descarte coerente", () => {
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ descartavel: true, motivoDescartavel: null }))).toThrow();
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ descartavel: false, motivoDescartavel: "motivo" }))).toThrow();
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ descartavel: true, motivoDescartavel: "Repetição editorial." }))).not.toThrow();
  });
  it("aceita slots Gemini estritos e de um a quatro speech beats", () => {
    expect(() => creativeBatchSchema.parse(creativeBatchFixture())).not.toThrow();
    const base = creativeBatchFixture().creatives[0];
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ geminiSlots: { ...base.geminiSlots, extra: true } }))).toThrow();
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ speechBeats: [] }))).toThrow();
    expect(() => creativeBatchSchema.parse(creativeBatchFixture({ speechBeats: Array.from({ length: 5 }, () => base.speechBeats[0]) }))).toThrow();
  });
});
