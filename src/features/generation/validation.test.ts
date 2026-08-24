import { describe, expect, it } from "vitest";
import { creativeBatchFixture, generationInputFixture } from "../../../tests/fixtures/creative-result";
import { containsMoney, countEmoji, countWords, renderSpeechBeats, validateCreativeBatch } from "./validation";
import { DEFAULT_GEMINI_TEMPLATE } from "@/features/settings/gemini-template";

describe("validação editorial", () => {
  it.each([[15, [8, 7, null]], [20, [10, 10, null]], [30, [10, 10, 10]]])("aceita duração %s apenas com segmentos corretos", (duration, segmentSeconds) => {
    const report = validateCreativeBatch(generationInputFixture({ duracaoTotal: duration }), creativeBatchFixture({ segmentSeconds }), "Fala: {{copy_completa}}");
    expect(report.creatives[0].issues.filter((issue) => issue.code === "SEGMENT_SECONDS")).toEqual([]);
  });

  it("bloqueia preço na política sem preço", () => {
    const report = validateCreativeBatch(generationInputFixture({ politicaPreco: "sem_preco" }), creativeBatchFixture({ trecho1: { texto: "Eu paguei R$ 29,90 e gostei.", palavras: 6, segundos: 10 } }), "{{copy_completa}}");
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "PRICE_FORBIDDEN", severity: "block", field: "copy.trecho1.texto" }));
  });
  it.each(["R$ 1,00", "R$99,90", "BRL 7.50", "USD 10.00", "EUR 12,00", "29,90 reais", "39 reais", "real 40,00", "R$ 1.299,00", "BRL 1,299.00"])("bloqueia os dez formatos sem_preco: %s", (money) => {
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ descricao: `Oferta por ${money}.` }), "{{copy_completa}}");
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "PRICE_FORBIDDEN", severity: "block", field: "descricao" }));
  });

  it.each(["R$ 29,90", "BRL 29.90", "29,90 reais", "por apenas 39 reais", "USD 10.00"])("detecta moeda: %s", (text) => expect(containsMoney(text)).toBe(true));
  it.each(["Garrafa 500 ml", "modelo 2024", "2 cores disponíveis"]) ("não confunde número comum: %s", (text) => expect(containsMoney(text)).toBe(false));
  it("conta palavras Unicode e emoji por segmentos", () => {
    expect(countWords("  Água-d'água, ótimo!  ")).toBe(2);
    expect(countEmoji("👩🏽‍🍳💧")).toBe(2);
  });
  it("renderiza o Prompt Gemini final e os speech beats no Prompt VEO", () => {
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "Gemini:\n{{prompt_gemini}}\nBeats:\n{{speech_beats}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].promptGemini).toContain("PRODUTO: Garrafa térmica");
    expect(report.creatives[0].veoPrompt).toContain('On "água": quick push-in');
    expect(report.creatives[0].veoPrompt).not.toMatch(/\{\{|\}\}/u);
  });
  it("bloqueia slot Gemini que instrui remoção de roupa", () => {
    const base = creativeBatchFixture().creatives[0].geminiSlots;
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ geminiSlots: { ...base, wardrobeLock: "remova a roupa atual" } }), "{{copy_completa}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "CLOTHING_REMOVAL", severity: "block", field: "geminiSlots.wardrobeLock" }));
  });
  it("bloqueia beat cuja palavra-gatilho não está na copy falada", () => {
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ speechBeats: [{ triggerWord: "zíper", cameraMove: "push-in", gesture: "point", visibleResult: "zipper visible" }] }), "{{copy_completa}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "SPEECH_BEAT_ORPHAN", severity: "block", field: "speechBeats" }));
  });
  it("avisa quando speech beats repetem a palavra-gatilho", () => {
    const beat = creativeBatchFixture().creatives[0].speechBeats[0];
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ speechBeats: [beat, { ...beat, cameraMove: "quick tilt" }] }), "{{copy_completa}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "SPEECH_BEAT_DUPLICATE", severity: "warning", field: "speechBeats" }));
  });
  it("formata speech beats para o template", () => {
    expect(renderSpeechBeats([{ triggerWord: "leve", cameraMove: "push-in", gesture: "brush fabric", visibleResult: "fabric visible" }])).toBe('- On "leve": push-in + brush fabric → fabric visible');
  });
  it("valida POV, hashtags e cópias declaradas", () => {
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ hashtags: ["#casa1"], pov: { texto: "um dois três", palavras: 99, emoji: "" } }), "{{copy_completa}}");
    expect(report.creatives[0].issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["HASHTAG_COUNT", "HASHTAG_DIGIT", "POV_EMOJI", "POV_DECLARED_WORDS"]));
  });
  it("avisa duplicidades editoriais e bloqueia tripla duplicada", () => {
    const base = creativeBatchFixture(); const second = { ...base.creatives[0], id: "creative-2" };
    const report = validateCreativeBatch(generationInputFixture({ quantidadeCriativos: 2 }), { ...base, creatives: [base.creatives[0], second] }, "{{copy_completa}}");
    expect(report.creatives[1].issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["ENVIRONMENT_REPEATED", "HASHTAGS_REPEATED", "CREATIVE_DUPLICATE"]));
    expect(report.creatives[1].issues.filter((issue) => issue.code === "CREATIVE_DUPLICATE").map((issue) => issue.field).sort()).toEqual(["ambiente", "hashtags", "pose"]);
  });
  it("bloqueia template inválido e nunca vaza segredos", () => {
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture(), "{{segredo}}");
    expect(report.creatives[0].veoPrompt).toBeNull();
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "VEO_TEMPLATE_INVALID", severity: "block" }));
    expect(JSON.stringify(report)).not.toContain("apiKey");
  });
  it("bloqueia contagem de criativos diferente da solicitada", () => {
    const report = validateCreativeBatch(generationInputFixture({ quantidadeCriativos: 2 }), creativeBatchFixture(), "{{copy_completa}}");
    expect(report.batchIssues).toContainEqual(expect.objectContaining({ code: "CREATIVE_COUNT", severity: "block", field: "creatives" }));
    expect(report.status).toBe("blocked");
  });
  it("aceita ambiente permitido com NFC, espaços, caixa e acento diferentes", () => {
    const report = validateCreativeBatch(generationInputFixture({ ambientesPermitidos: ["  CAFE\u0301   DA MANHÃ "] }), creativeBatchFixture({ ambiente: "café da manhã" }), "{{copy_completa}}");
    expect(report.creatives[0].issues.map((issue) => issue.code)).not.toContain("ENVIRONMENT_NOT_ALLOWED");
  });
  it("bloqueia ambiente fora da lista", () => {
    const report = validateCreativeBatch(generationInputFixture({ ambientesPermitidos: ["cozinha"] }), creativeBatchFixture({ ambiente: "quarto" }), "{{copy_completa}}");
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "ENVIRONMENT_NOT_ALLOWED", severity: "block", field: "ambiente" }));
  });
  it("sinaliza criativo marcado descartável para revisão", () => {
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ descartavel: true, motivoDescartavel: "Repetição editorial." }), "{{copy_completa}}");
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "CREATIVE_DISCARDED", severity: "warning", field: "motivoDescartavel", message: expect.stringContaining("Repetição") }));
    expect(report.creatives[0].status).toBe("needs_review");
  });
  it.each(["US$ 10", "$ 15.99", "€20", "£ 9", "¥ 300", "GBP 4.50", "JPY 500", "10 dólares", "euro 3", "5 libras", "20 ienes", "50 centavos"]) ("detecta dinheiro em forma comum: %s", (text) => expect(containsMoney(text)).toBe(true));
  it.each(["modelo 2026", "500 ml", "2 kg", "128 GB", "3 unidades"]) ("não confunde medida ou contagem: %s", (text) => expect(containsMoney(text)).toBe(false));
  it.each(["Adicione texto na tela", "Show captions", "Render a price tag", "insira setas e stickers", "Display a floating label", "add UI cards and graphics"]) ("bloqueia overlay afirmativo: %s", (directive) => {
    const slots = creativeBatchFixture().creatives[0].geminiSlots;
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ geminiSlots: { ...slots, cenario: `${slots.cenario}\n${directive}` } }), "{{copy_completa}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "VISUAL_OVERLAY_FORBIDDEN", severity: "block", field: "geminiSlots.cenario" }));
  });
  it.each(["Restrições: sem texto na tela", "Restrictions: no text overlays", "without captions", "não adicionar overlays"]) ("não bloqueia restrição negativa de overlay: %s", (directive) => {
    const slots = creativeBatchFixture().creatives[0].geminiSlots;
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ geminiSlots: { ...slots, cenario: `${slots.cenario}\n${directive}` } }), "{{copy_completa}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].issues.map((issue) => issue.code)).not.toContain("VISUAL_OVERLAY_FORBIDDEN");
  });
  it.each(["Add captions, no people visible", "Add captions with no human subject", "Do not add captions but show price tags"]) ("não deixa uma negativa não relacionada ocultar diretiva: %s", (directive) => {
    const slots = creativeBatchFixture().creatives[0].geminiSlots;
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ geminiSlots: { ...slots, cenario: `${slots.cenario}\n${directive}` } }), "{{copy_completa}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].issues.map((issue) => issue.code)).toContain("VISUAL_OVERLAY_FORBIDDEN");
  });
  it.each(["Do not add text overlays", "No captions or subtitles", "Add no captions", "Nunca mostrar texto na tela", "Sem legendas"]) ("aceita negativa que governa a diretiva ou alvo: %s", (directive) => {
    const slots = creativeBatchFixture().creatives[0].geminiSlots;
    const report = validateCreativeBatch(generationInputFixture(), creativeBatchFixture({ geminiSlots: { ...slots, cenario: `${slots.cenario}\n${directive}` } }), "{{copy_completa}}", DEFAULT_GEMINI_TEMPLATE);
    expect(report.creatives[0].issues.map((issue) => issue.code)).not.toContain("VISUAL_OVERLAY_FORBIDDEN");
  });
});
