import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./system-prompt";

describe("SYSTEM_PROMPT", () => {
  it("preserva as regras editoriais e termina na instrução de saída estruturada", () => {
    expect(SYSTEM_PROMPT).toContain("Não escreva o Prompt Gemini completo");
    expect(SYSTEM_PROMPT).toContain("geminiSlots");
    expect(SYSTEM_PROMPT).toContain("speechBeats");
    expect(SYSTEM_PROMPT).toContain("motivoDescartavel deve ser null");
    expect(SYSTEM_PROMPT).toContain("não use sobreposições visuais");
    expect(SYSTEM_PROMPT).toContain("HOOK → CORPO → CTA");
    expect(SYSTEM_PROMPT).toContain("trecho1 é o HOOK");
    expect(SYSTEM_PROMPT).toContain("não é sinopse de cena, storyboard ou direção de fotografia");
    expect(SYSTEM_PROMPT).not.toContain("enquadramentoExtra");
    expect(SYSTEM_PROMPT).toContain("os três precisam descrever exatamente o mesmo conjunto de peças");
    expect(SYSTEM_PROMPT).toContain("não restrinja a cena a uma única peça nesse caso");
    expect(SYSTEM_PROMPT).toContain("Nunca escreva um gesture ou visibleResult que revele um item, cor ou variante que a pose e a ação da cena não estabeleceram");
    expect(SYSTEM_PROMPT).toContain("nunca a expressão facial, o sorriso ou qualquer gesto que dependa do rosto estar em quadro");
    expect(SYSTEM_PROMPT).toContain("Não mencione valores monetários quando a política for sem preço");
    expect(SYSTEM_PROMPT.endsWith("Retorne somente o objeto que corresponda ao schema configurado em output_config.format.")).toBe(true);
  });
});
