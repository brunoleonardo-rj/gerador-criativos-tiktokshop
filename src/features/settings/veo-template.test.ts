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
      copy_trechos: 'Trecho 1: "Trecho um"\nTrecho 2: "Trecho dois"',
      pov: "✨ Cheiro de presença",
      ambiente: "Quarto",
      figurino: "Conjunto casual",
      pose: "Em pé",
      prompt_gemini: "PROMPT",
      speech_beats: '- On "leve": quick push-in + brush the fabric → fabric remains visible',
    });

    expect(output).toContain("Fala: Trecho um Trecho dois");
    expect(output).not.toMatch(/{{/);
  });

  it("rejeita marcadores malformados e deduplica desconhecidos na ordem de aparição", () => {
    expect(validateVeoTemplate("{{copy completa}} {{variavel_inventada}} {{copy completa}} {{}}")).toEqual({
      valid: false,
      unknown: ["copy completa", "variavel_inventada", ""],
    });
  });

  it("não renderiza valores ausentes ou marcadores pendentes", () => {
    const values = {
      produto: "Body splash",
      copy_completa: "Trecho um Trecho dois",
      copy_trechos: 'Trecho 1: "Trecho um"\nTrecho 2: "Trecho dois"',
      pov: "✨ Cheiro de presença",
      ambiente: "Quarto",
      figurino: "Conjunto casual",
      pose: "Em pé",
      prompt_gemini: "PROMPT",
      speech_beats: "- Sem beats",
    };

    expect(() => renderVeoTemplate("{{produto", values)).toThrow();
    expect(() => renderVeoTemplate("{{produto}}", { ...values, produto: undefined } as never)).toThrow();
    expect(() => renderVeoTemplate("{{produto}}", { ...values, produto: "{{pendente}}" })).toThrow();
  });

  it("renderiza os speech beats no template VEO", () => {
    const output = renderVeoTemplate("BEATS:\n{{speech_beats}}", {
      produto: "Body splash",
      copy_completa: "Ele fixa bem na pele",
      copy_trechos: 'Trecho 1: "Ele fixa bem"\nTrecho 2: "na pele"',
      pov: "Cheiro marcante ✨",
      ambiente: "Quarto",
      figurino: "Conjunto casual",
      pose: "Em pé",
      prompt_gemini: "PROMPT",
      speech_beats: '- On "fixa": fast push-in + point beside the bottle → label stays visible',
    });

    expect(output).toContain('On "fixa"');
  });
});
