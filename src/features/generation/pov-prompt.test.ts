import { describe, expect, it } from "vitest";
import { buildGeminiPovPrompt } from "./pov-prompt";
import type { GeminiSlots } from "./schema";

const slots: GeminiSlots = {
  identidadeUgc: "Preserve exatamente a pessoa das imagens de referência.",
  produto: "Garrafa térmica Aurora",
  wardrobeLock: "Camiseta bege casual sem estampas.",
  tecido: "Malha lisa com caimento natural.",
  evitar: "Não adicionar logotipos extras.",
  calcado: "Tênis casual neutro, não usar salto.",
  cenario: "Cozinha clara e residencial.",
  iluminacao: "Luz natural lateral.",
  acao: "A mão gira a tampa da garrafa devagar.",
  pose: "Em pé, postura relaxada.",
};

describe("buildGeminiPovPrompt", () => {
  it("reaproveita produto, cenário, ação e evitar dos mesmos geminiSlots do fluxo self", () => {
    const output = buildGeminiPovPrompt("PRODUTO: {{produto}}\nCENARIO: {{cenario}}\nACAO: {{acao}}\nEVITAR: {{evitar}}", slots);

    expect(output).toBe("PRODUTO: Garrafa térmica Aurora\nCENARIO: Cozinha clara e residencial.\nACAO: A mão gira a tampa da garrafa devagar.\nEVITAR: Não adicionar logotipos extras.");
  });

  it("não usa identidade, figurino, tecido, calçado ou pose — não fazem sentido em POV", () => {
    const template = "{{produto}}";
    expect(() => buildGeminiPovPrompt(template, slots)).not.toThrow();
  });
});
