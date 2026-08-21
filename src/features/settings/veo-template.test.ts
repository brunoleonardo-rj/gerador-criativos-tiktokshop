import { describe, expect, it } from "vitest";
import { renderVeoTemplate, validateVeoTemplate } from "./veo-template";

describe("VEO template", () => {
  it("rejeita variável VEO desconhecida", () => {
    expect(validateVeoTemplate("Fale {{copy_completa}} e {{variavel_inventada}}")).toEqual({
      valid: false,
      unknown: ["variavel_inventada"],
    });
  });

  it("renderiza copy completa sem marcadores pendentes", () => {
    const output = renderVeoTemplate("Produto {{produto}}\nFala: {{copy_completa}}", {
      produto: "Body splash",
      copy_completa: "Trecho um Trecho dois",
      copy_trecho1: "Trecho um",
      copy_trecho2: "Trecho dois",
      pov: "✨ Cheiro de presença",
      ambiente: "Quarto",
      figurino: "Conjunto casual",
      pose: "Em pé",
      prompt_gemini: "PROMPT",
    });

    expect(output).toContain("Fala: Trecho um Trecho dois");
    expect(output).not.toMatch(/{{/);
  });
});
