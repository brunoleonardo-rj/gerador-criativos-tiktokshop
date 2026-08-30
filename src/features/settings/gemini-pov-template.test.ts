import { describe, expect, it } from "vitest";
import { renderGeminiPovTemplate, validateGeminiPovTemplate, type GeminiPovVariables } from "./gemini-pov-template";

const values: GeminiPovVariables = {
  produto: "Garrafa térmica Aurora",
  cenario: "cozinha clara e residencial",
  acao: "a mão gira a tampa da garrafa devagar",
  evitar: "Não adicionar logotipos extras.",
};

describe("Gemini POV template", () => {
  it("renderiza todos os slots permitidos sem marcadores pendentes", () => {
    const template = Object.keys(values).map((key) => `{{${key}}}`).join("\n");

    const output = renderGeminiPovTemplate(template, values);

    expect(output).toContain("Garrafa térmica Aurora");
    expect(output).toContain("cozinha clara e residencial");
    expect(output).not.toMatch(/\{\{|\}\}/u);
  });

  it("rejeita variáveis desconhecidas e marcadores malformados", () => {
    expect(validateGeminiPovTemplate("{{produto}} {{inventada}} {{produto")).toEqual({
      valid: false,
      unknown: ["inventada", "{{"],
    });
  });

  it("não renderiza valores ausentes ou marcadores pendentes", () => {
    expect(() => renderGeminiPovTemplate("{{produto}}", { ...values, produto: undefined } as never)).toThrow();
    expect(() => renderGeminiPovTemplate("{{produto}}", { ...values, produto: "{{pendente}}" })).toThrow();
  });
});
