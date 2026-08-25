import { describe, expect, it } from "vitest";
import { renderGeminiTemplate, validateGeminiTemplate, type GeminiVariables } from "./gemini-template";

const values: GeminiVariables = {
  identidade_ugc: "Preserve exatamente a pessoa anexada.",
  produto: "Macacão azul",
  wardrobe_lock: "Macacão azul de alças largas e cintura marcada.",
  tecido: "Tecido liso com caimento leve.",
  evitar: "Não criar bolsos ou estampas.",
  cenario: "Sala clara e residencial.",
  iluminacao: "Luz natural lateral.",
  pose: "Corpo inteiro, postura relaxada.",
  maos: "mãos livres e relaxadas ao lado do corpo, sem segurar nada",
  enquadramento_crop: "corpo inteiro, da cabeça aos pés",
  enquadramento_extra: "Pés totalmente visíveis.",
  bloco_calcado: "CALÇADO: Sandália neutra, não usar tênis.\n\n",
  bloco_interacao: "AÇÃO:\nA personagem mostra o caimento.\n\n",
};

describe("Gemini template", () => {
  it("renderiza todos os slots permitidos sem marcadores pendentes", () => {
    const template = Object.keys(values).map((key) => `{{${key}}}`).join("\n");

    const output = renderGeminiTemplate(template, values);

    expect(output).toContain("Macacão azul");
    expect(output).toContain("Pés totalmente visíveis.");
    expect(output).not.toMatch(/\{\{|\}\}/u);
  });

  it("rejeita variáveis desconhecidas e marcadores malformados", () => {
    expect(validateGeminiTemplate("{{produto}} {{inventada}} {{produto")).toEqual({
      valid: false,
      unknown: ["inventada", "{{"],
    });
  });

  it("não renderiza valores ausentes ou marcadores pendentes", () => {
    expect(() => renderGeminiTemplate("{{produto}}", { ...values, produto: undefined } as never)).toThrow();
    expect(() => renderGeminiTemplate("{{produto}}", { ...values, produto: "{{pendente}}" })).toThrow();
  });
});
