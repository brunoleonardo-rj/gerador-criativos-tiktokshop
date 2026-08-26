import { describe, expect, it } from "vitest";
import { renderVeoTemplate, validateVeoTemplate } from "./veo-template";

describe("VEO template", () => {
  it("rejeita variável VEO desconhecida", () => {
    expect(validateVeoTemplate("Fale {{copy_trecho}} e {{variavel_inventada}}")).toEqual({
      valid: false,
      unknown: ["variavel_inventada"],
    });
  });

  it("renderiza o trecho de fala sem marcadores pendentes", () => {
    const output = renderVeoTemplate("Produto {{produto}}\nFala: {{copy_trecho}}", {
      produto: "Body splash",
      copy_trecho: "Trecho um",
      pov: "✨ Cheiro de presença",
      ambiente: "Quarto",
      figurino: "Conjunto casual",
      pose: "Em pé",
      prompt_gemini: "PROMPT",
      speech_beats: '- On "leve": quick push-in + brush the fabric → fabric remains visible',
      continuidade: "",
      ancoragem_produto: "The product stays continuously visible in her hand.",
      ancoragem_frame_final: "she is still holding the product in the exact same grip",
    });

    expect(output).toContain("Fala: Trecho um");
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
      copy_trecho: "Trecho um",
      pov: "✨ Cheiro de presença",
      ambiente: "Quarto",
      figurino: "Conjunto casual",
      pose: "Em pé",
      prompt_gemini: "PROMPT",
      speech_beats: "- Sem beats",
      continuidade: "",
      ancoragem_produto: "The product stays continuously visible in her hand.",
      ancoragem_frame_final: "she is still holding the product in the exact same grip",
    };

    expect(() => renderVeoTemplate("{{produto", values)).toThrow();
    expect(() => renderVeoTemplate("{{produto}}", { ...values, produto: undefined } as never)).toThrow();
    expect(() => renderVeoTemplate("{{produto}}", { ...values, produto: "{{pendente}}" })).toThrow();
  });

  it("renderiza os speech beats no template VEO", () => {
    const output = renderVeoTemplate("BEATS:\n{{speech_beats}}", {
      produto: "Body splash",
      copy_trecho: "Ele fixa bem",
      pov: "Cheiro marcante ✨",
      ambiente: "Quarto",
      figurino: "Conjunto casual",
      pose: "Em pé",
      prompt_gemini: "PROMPT",
      speech_beats: '- On "fixa": fast push-in + point beside the bottle → label stays visible',
      continuidade: "",
      ancoragem_produto: "The product stays continuously visible in her hand.",
      ancoragem_frame_final: "she is still holding the product in the exact same grip",
    });

    expect(output).toContain('On "fixa"');
  });
});
