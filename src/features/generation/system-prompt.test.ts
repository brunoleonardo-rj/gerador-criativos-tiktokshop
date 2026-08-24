import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./system-prompt";

describe("SYSTEM_PROMPT", () => {
  it("preserva as regras editoriais e termina na instrução de saída estruturada", () => {
    expect(SYSTEM_PROMPT).toContain("Não escreva o Prompt Gemini completo");
    expect(SYSTEM_PROMPT).toContain("geminiSlots");
    expect(SYSTEM_PROMPT).toContain("speechBeats");
    expect(SYSTEM_PROMPT).toContain("motivoDescartavel deve ser null");
    expect(SYSTEM_PROMPT).toContain("não use sobreposições visuais");
    expect(SYSTEM_PROMPT).toContain("Não mencione valores monetários quando a política for sem preço");
    expect(SYSTEM_PROMPT.endsWith("Retorne somente o objeto que corresponda ao schema configurado em output_config.format.")).toBe(true);
  });
});
