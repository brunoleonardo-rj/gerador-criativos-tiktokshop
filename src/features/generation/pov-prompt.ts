import { renderGeminiPovTemplate } from "@/features/settings/gemini-pov-template";
import type { GeminiSlots } from "./schema";

export function buildGeminiPovPrompt(template: string, slots: GeminiSlots): string {
  return renderGeminiPovTemplate(template, {
    produto: slots.produto,
    cenario: slots.cenario,
    acao: slots.acao,
    evitar: slots.evitar,
  });
}
