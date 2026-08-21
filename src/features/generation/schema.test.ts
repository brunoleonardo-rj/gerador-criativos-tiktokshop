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
});
