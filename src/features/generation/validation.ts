import { renderVeoTemplate } from "@/features/settings/veo-template";
import { DEFAULT_GEMINI_TEMPLATE } from "@/features/settings/gemini-template";
import { buildGeminiPrompt, deriveRenderPlan, figurinoInstruction, veoAnchorInstruction, type ProductProfile } from "./render-plan";
import { creativeBatchSchema, generationInputSchema, type CreativeBatch, type GenerationInput, type SpeechBeat } from "./schema";

export type IssueSeverity = "warning" | "block";
export type GenerationIssue = { code: string; severity: IssueSeverity; field: string; message: string };
export type VeoPrompts = { trecho1: string | null; trecho2: string | null; trecho3: string | null };
export type CreativeEnvelope = CreativeBatch["creatives"][number] & { promptGemini: string | null; veoPrompts: VeoPrompts; actualCounts: { trecho1: number; trecho2: number; trecho3: number | null; pov: number }; issues: GenerationIssue[]; status: "valid" | "needs_review" | "blocked" };
export type GenerationEnvelope = Omit<CreativeBatch, "creatives"> & { creatives: CreativeEnvelope[]; batchIssues: GenerationIssue[]; status: "valid" | "needs_review" | "blocked"; settingsUpdatedAt: string | null; productProfile: ProductProfile };

const AMOUNT = "(?:\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2})?|\\d+)";
const MONEY = new RegExp(`(?:(?:US\\$|R\\$|\\$|€|£|¥)\\s*${AMOUNT}|${AMOUNT}\\s*(?:US\\$|R\\$|\\$|€|£|¥)|\\b(?:BRL|USD|EUR|GBP|JPY)\\s*${AMOUNT}\\b|\\b${AMOUNT}\\s*(?:BRL|USD|EUR|GBP|JPY)\\b|\\b${AMOUNT}\\s*(?:reais?|real|dólares?|dolares?|euros?|libras?|ienes?|centavos?)\\b|\\b(?:reais?|real|dólares?|dolares?|euros?|libras?|ienes?|centavos?)\\s*${AMOUNT}\\b)`, "iu");
const EMOJI = /\p{Extended_Pictographic}/gu;
const WORD = /[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number { return text.match(WORD)?.length ?? 0; }
export function countEmoji(text: string): number {
  const Segmenter = Intl.Segmenter;
  if (Segmenter) return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].filter(({ segment }) => /\p{Extended_Pictographic}/u.test(segment)).length;
  return [...text.matchAll(EMOJI)].length;
}
export function containsMoney(text: string): boolean { return MONEY.test(text.normalize("NFC")); }
export function renderSpeechBeats(beats: SpeechBeat[]): string {
  return beats.map((beat) => `- On "${beat.triggerWord}": ${beat.cameraMove} + ${beat.gesture} → ${beat.visibleResult}`).join("\n");
}
const add = (issues: GenerationIssue[], code: string, severity: IssueSeverity, field: string, message: string) => issues.push({ code, severity, field, message });
const CONTINUATION_NOTE = "This segment continues directly from the final frame of the previous video segment — use that final frame as the primary visual reference for pose, lighting, and framing continuity, and cross-reference the original product reference photos to keep every product detail (color, cut, pockets, buttons, texture) exactly consistent with them. Do not let the product drift between segments.";
const trechoKeys = ["trecho1", "trecho2", "trecho3"] as const;
function renderPromptsFor(creative: CreativeBatch["creatives"][number], produtoNormalizado: string, veoTemplate: string, geminiTemplate: string, profile: ProductProfile): { promptGemini: string | null; veoPrompts: VeoPrompts; issues: GenerationIssue[] } {
  const issues: GenerationIssue[] = [];
  let promptGemini: string | null = null;
  try {
    promptGemini = buildGeminiPrompt(geminiTemplate, creative.geminiSlots, profile, deriveRenderPlan(profile));
  } catch {
    add(issues, "GEMINI_TEMPLATE_INVALID", "block", "promptGemini", "O template Gemini possui variável inválida ou não resolvida.");
  }
  const segments = [creative.copy.trecho1, creative.copy.trecho2, creative.copy.trecho3];
  const veoPrompts: VeoPrompts = { trecho1: null, trecho2: null, trecho3: null };
  const anchor = veoAnchorInstruction(profile.formatoUso);
  segments.forEach((segment, index) => {
    if (!segment) return;
    const key = trechoKeys[index];
    try {
      if (promptGemini === null) throw new Error("Gemini prompt unavailable");
      const segmentBeats = creative.speechBeats.filter((beat) => normalizeKey(segment.texto).includes(normalizeKey(beat.triggerWord)));
      veoPrompts[key] = renderVeoTemplate(veoTemplate, { produto: produtoNormalizado, copy_trecho: segment.texto, pov: creative.pov.texto, ambiente: creative.ambiente, figurino: figurinoInstruction(profile, creative.geminiSlots.wardrobeLock), pose: creative.pose, prompt_gemini: promptGemini, speech_beats: renderSpeechBeats(segmentBeats), continuidade: index > 0 ? CONTINUATION_NOTE : "", ancoragem_produto: anchor.bloco, ancoragem_frame_final: anchor.frameFinal });
    } catch {
      add(issues, "VEO_TEMPLATE_INVALID", "block", `veoPrompts.${key}`, "O template VEO possui variável inválida ou não resolvida.");
    }
  });
  return { promptGemini, veoPrompts, issues };
}
export function refreshPrompts(envelope: GenerationEnvelope, veoTemplate: string, geminiTemplate: string, settingsUpdatedAt: string | null): GenerationEnvelope {
  const creatives = envelope.creatives.map((creative) => {
    const rendered = renderPromptsFor(creative, envelope.produtoNormalizado, veoTemplate, geminiTemplate, envelope.productProfile);
    const issues = [...creative.issues.filter((issue) => issue.code !== "GEMINI_TEMPLATE_INVALID" && issue.code !== "VEO_TEMPLATE_INVALID"), ...rendered.issues];
    const status: CreativeEnvelope["status"] = issues.some((issue) => issue.severity === "block") ? "blocked" : issues.length ? "needs_review" : "valid";
    return { ...creative, promptGemini: rendered.promptGemini, veoPrompts: rendered.veoPrompts, issues, status };
  });
  const status: GenerationEnvelope["status"] = envelope.batchIssues.some((issue) => issue.severity === "block") || creatives.some((creative) => creative.status === "blocked") ? "blocked" : creatives.some((creative) => creative.status === "needs_review") ? "needs_review" : "valid";
  return { ...envelope, creatives, status, settingsUpdatedAt };
}
const segmentRules: Record<number, { seconds: number[]; words: Record<number, [number, number]> }> = {
  15: { seconds: [8, 7], words: { 8: [14, 22], 7: [13, 20] } },
  20: { seconds: [10, 10], words: { 10: [18, 28] } },
  30: { seconds: [10, 10, 10], words: { 10: [18, 28] } },
};
const normalizeKey = (value: string) => value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");
const hasAffirmativeVisualOverlay = (prompt: string): boolean => {
  const text = normalizeKey(prompt);
  const directiveTarget = /\b(?:add(?:ing)?|show(?:ing)?|display(?:ing)?|render(?:ing)?|insert(?:ing)?|include(?:ing)?|generate(?:ing)?|place|placing|create|creating|adicione|adicionar|adicionando|mostre|mostrar|mostrando|exiba|exibir|insira|inserir|inclua|incluir|gere|gerar|coloque|colocar|crie|criar)\b(?:(?![.!?;\n])[\s\S]){0,50}?\b(?:overlays?|texto\s+na\s+tela|text\s+overlays?|on-screen\s+text|captions?|subtitles?|floating\s+labels?|price\s+tags?|setas?|arrows?|stickers?|emojis?|ui|interface|cards?|graphics?)\b/gu;
  const immediatelyNegated = /(?:\bdo\s+not|\bdon't|\bnever|\bavoid|\bnao|\bnunca|\bsem)\s*$/u;
  const negativeTarget = /\b(?:add(?:ing)?|show(?:ing)?|display(?:ing)?|render(?:ing)?|insert(?:ing)?|include(?:ing)?|generate(?:ing)?|place|placing|create|creating|adicione|adicionar|adicionando|mostre|mostrar|mostrando|exiba|exibir|insira|inserir|inclua|incluir|gere|gerar|coloque|colocar|crie|criar)\b\s+(?:no|without|sem)\b/iu;
  for (const match of text.matchAll(directiveTarget)) {
    const before = text.slice(0, match.index).trimEnd();
    if (!immediatelyNegated.test(before) && !negativeTarget.test(match[0])) return true;
  }
  return false;
};

type GenericRule = { code: string; severity: IssueSeverity; fields: string[]; pattern?: RegExp; test?: (text: string) => boolean; message: string };
const SEGURAR = /\b(segur\w*|empunh\w*|pegando|segurando)\b/iu;
const GENERIC_RULES: GenericRule[] = [
  { code: "MIRROR_IN_SCENE", severity: "block", fields: ["geminiSlots.cenario", "pose", "geminiSlots.acao"], pattern: /\b(espelho|espelhad[ao]|reflex[oõ]|superf[ií]cie reflexiva)\b/iu, message: "Espelho não é suportado: o reflexo não se mantém coerente no vídeo." },
  { code: "ACTION_IS_SEQUENCE", severity: "warning", fields: ["geminiSlots.acao"], pattern: /\b(depois|em seguida|primeiro|ent[aã]o|alternando|logo ap[oó]s|na sequ[eê]ncia)\b/iu, message: "O frame-base é um instante único, não uma sequência." },
  { code: "VIOLENT_TERM", severity: "block", fields: ["*"], pattern: /\b(decepad|amputad|mutilad|dilacerad)/iu, message: "Termo com conotação violenta aciona filtro de política do gerador." },
  { code: "COERCIVE_CAPS", severity: "warning", fields: ["*"], test: (text) => /\b[A-ZÀ-Ú]{4,}(\s+[A-ZÀ-Ú]{4,}){2,}/.test(text), message: "Sequência longa em caixa alta pode ser lida como instrução adversarial." },
];
function applyGenericRules(issues: GenerationIssue[], creative: CreativeBatch["creatives"][number]) {
  const fields: Record<string, string> = {
    "geminiSlots.cenario": creative.geminiSlots.cenario,
    "geminiSlots.acao": creative.geminiSlots.acao,
    pose: creative.pose,
    "geminiSlots.iluminacao": creative.geminiSlots.iluminacao,
    "geminiSlots.evitar": creative.geminiSlots.evitar,
    "geminiSlots.produto": creative.geminiSlots.produto,
    "geminiSlots.tecido": creative.geminiSlots.tecido,
    "geminiSlots.wardrobeLock": creative.geminiSlots.wardrobeLock ?? "",
    descricao: creative.descricao,
    "pov.texto": creative.pov.texto,
  };
  for (const rule of GENERIC_RULES) {
    const targets = rule.fields.includes("*") ? Object.entries(fields) : rule.fields.map((field) => [field, fields[field]] as const);
    for (const [field, value] of targets) {
      if (value === undefined) continue;
      const matched = rule.pattern ? rule.pattern.test(value) : rule.test ? rule.test(value) : false;
      if (matched) add(issues, rule.code, rule.severity, field, rule.message);
    }
  }
}
function extractBrandCandidates(nomeProduto: string): string[] {
  const stopwords = new Set(["de", "da", "do", "com", "para", "sem"]);
  return nomeProduto.split(/\s+/u).map((word) => word.replace(/[.,;:!?()]/gu, "")).filter((word) => word.length >= 3 && /^[A-ZÀ-Ú][a-zà-ú]+$/u.test(word) && !stopwords.has(normalizeKey(word)));
}

export function validateCreativeBatch(input: GenerationInput, batch: CreativeBatch, veoTemplate: string, geminiTemplate = DEFAULT_GEMINI_TEMPLATE, settingsUpdatedAt: string | null = null): GenerationEnvelope {
  const safeInput = generationInputSchema.parse(input);
  const safeBatch = creativeBatchSchema.parse(batch);
  const expected = segmentRules[safeInput.duracaoTotal];
  const batchIssues: GenerationIssue[] = [];
  if (safeBatch.creatives.length !== safeInput.quantidadeCriativos) add(batchIssues, "CREATIVE_COUNT", "block", "creatives", "A quantidade de criativos diverge da configuração.");
  const allowedEnvironments = new Set(safeInput.ambientesPermitidos.map(normalizeKey));
  const seenEnvironment = new Set<string>(); const seenHashtags = new Set<string>(); const seenTriples = new Set<string>();
  const creatives = safeBatch.creatives.map((creative) => {
    const issues: GenerationIssue[] = [];
    const segments = [creative.copy.trecho1, creative.copy.trecho2, creative.copy.trecho3];
    if (segments.some((segment, index) => (index < expected.seconds.length) !== (segment !== null))) add(issues, "SEGMENT_STRUCTURE", "block", "copy", "A quantidade de trechos não corresponde à duração.");
    for (const [index, segment] of segments.entries()) {
      if (!segment) continue;
      const field = `copy.trecho${index + 1}`;
      const words = countWords(segment.texto);
      if (segment.segundos !== expected.seconds[index]) add(issues, "SEGMENT_SECONDS", "block", `${field}.segundos`, "Os segundos do trecho não correspondem à duração configurada.");
      const range = expected.words[segment.segundos];
      if (!range || words < range[0] || words > range[1]) add(issues, "SEGMENT_WORDS", "warning", `${field}.texto`, "A quantidade de palavras está fora do intervalo editorial.");
      if (segment.palavras !== words) add(issues, "SEGMENT_DECLARED_WORDS", "warning", `${field}.palavras`, "A contagem declarada diverge da contagem real.");
      if (safeInput.politicaPreco === "sem_preco" && containsMoney(segment.texto)) add(issues, "PRICE_FORBIDDEN", "block", `${field}.texto`, "Preço não é permitido nesta geração.");
    }
    if (safeInput.politicaPreco === "sem_preco" && containsMoney(creative.descricao)) add(issues, "PRICE_FORBIDDEN", "block", "descricao", "Preço não é permitido nesta geração.");
    const slotsToValidate = [
      ["geminiSlots.cenario", creative.geminiSlots.cenario],
      ["geminiSlots.acao", creative.geminiSlots.acao],
      ["geminiSlots.wardrobeLock", creative.geminiSlots.wardrobeLock ?? ""],
    ] as const;
    for (const [field, value] of slotsToValidate) {
      if (/\b(?:remova|tire)\b[\s\S]{0,60}\broupa\b|\bsubstitua\s+a\s+roupa\b/iu.test(value)) add(issues, "CLOTHING_REMOVAL", "block", field, "O Prompt Gemini não pode instruir remoção ou troca de roupa.");
      if (hasAffirmativeVisualOverlay(value)) add(issues, "VISUAL_OVERLAY_FORBIDDEN", "block", field, "O Prompt Gemini não pode instruir overlays ou gráficos visuais.");
    }
    applyGenericRules(issues, creative);
    const plan = deriveRenderPlan(safeInput.productProfile);
    if (plan.maos.includes("sem segurar nada") && SEGURAR.test(creative.geminiSlots.acao)) {
      add(issues, "HANDS_CONTRADICTION", "block", "geminiSlots.acao", "A ação exige segurar o produto, mas o productProfile está classificado como 'vestido'.");
    }
    for (const brand of extractBrandCandidates(safeInput.nomeProduto)) {
      if (normalizeKey(creative.geminiSlots.produto).includes(normalizeKey(brand))) {
        add(issues, "BRAND_NAME_IN_PROMPT", "warning", "geminiSlots.produto", `O nome da marca "${brand}" não deve aparecer na descrição visual do produto.`);
      }
    }
    const spokenText = segments.filter((segment): segment is NonNullable<typeof segment> => segment !== null).map((segment) => segment.texto).join(" ");
    const normalizedSpokenText = normalizeKey(spokenText);
    for (const beat of creative.speechBeats) {
      if (!normalizedSpokenText.includes(normalizeKey(beat.triggerWord))) add(issues, "SPEECH_BEAT_ORPHAN", "block", "speechBeats", `A palavra-gatilho "${beat.triggerWord}" não aparece na copy falada.`);
    }
    const beatWords = creative.speechBeats.map((beat) => normalizeKey(beat.triggerWord));
    if (new Set(beatWords).size !== beatWords.length) add(issues, "SPEECH_BEAT_DUPLICATE", "warning", "speechBeats", "Há palavras-gatilho repetidas.");
    if (creative.hashtags.length !== safeInput.quantidadeHashtags) add(issues, "HASHTAG_COUNT", "block", "hashtags", "A quantidade de hashtags diverge da configuração.");
    if (creative.hashtags.some((tag) => /\d/u.test(tag))) add(issues, "HASHTAG_DIGIT", "block", "hashtags", "Hashtags não podem conter dígitos.");
    const hashtagKey = creative.hashtags.map(normalizeKey).sort().join("|");
    if (seenHashtags.has(hashtagKey)) add(issues, "HASHTAGS_REPEATED", "warning", "hashtags", "O conjunto de hashtags se repete."); else seenHashtags.add(hashtagKey);
    const environmentKey = normalizeKey(creative.ambiente);
    if (allowedEnvironments.size > 0 && !allowedEnvironments.has(environmentKey)) add(issues, "ENVIRONMENT_NOT_ALLOWED", "block", "ambiente", "O ambiente não pertence à lista permitida.");
    if (seenEnvironment.has(environmentKey)) add(issues, "ENVIRONMENT_REPEATED", "warning", "ambiente", "O ambiente se repete."); else seenEnvironment.add(environmentKey);
    const triple = `${environmentKey}|${normalizeKey(creative.pose)}|${hashtagKey}`;
    if (seenTriples.has(triple)) {
      for (const field of ["ambiente", "pose", "hashtags"]) add(issues, "CREATIVE_DUPLICATE", "block", field, "Ambiente, pose e hashtags repetidos simultaneamente.");
    } else seenTriples.add(triple);
    const actualPov = countWords(creative.pov.texto);
    if (creative.pov.palavras !== actualPov) add(issues, "POV_DECLARED_WORDS", "warning", "pov.palavras", "A contagem declarada diverge da contagem real.");
    if (actualPov > safeInput.maxPalavrasPov) add(issues, "POV_WORDS", "warning", "pov.texto", "O POV ultrapassa o limite configurado.");
    if (safeInput.povComEmoji && (countEmoji(creative.pov.texto) !== 1 || countEmoji(creative.pov.emoji) !== 1)) add(issues, "POV_EMOJI", "warning", "pov", "O POV deve conter exatamente um emoji.");
    if (creative.descartavel && !creative.motivoDescartavel) add(issues, "DISCARD_REASON_MISSING", "block", "motivoDescartavel", "O criativo foi marcado como descartável sem justificativa.");
    if (!creative.descartavel && creative.motivoDescartavel) add(issues, "DISCARD_REASON_UNEXPECTED", "warning", "motivoDescartavel", "Uma justificativa de descarte foi ignorada porque o criativo não foi marcado como descartável.");
    if (creative.descartavel && creative.motivoDescartavel) add(issues, "CREATIVE_DISCARDED", "warning", "motivoDescartavel", `Criativo marcado como descartável: ${creative.motivoDescartavel}`);
    const rendered = renderPromptsFor(creative, safeBatch.produtoNormalizado, veoTemplate, geminiTemplate, safeInput.productProfile);
    const promptGemini = rendered.promptGemini;
    const veoPrompts = rendered.veoPrompts;
    issues.push(...rendered.issues);
    const actualCounts = { trecho1: countWords(creative.copy.trecho1.texto), trecho2: countWords(creative.copy.trecho2.texto), trecho3: creative.copy.trecho3 ? countWords(creative.copy.trecho3.texto) : null, pov: actualPov };
    const status: CreativeEnvelope["status"] = issues.some((issue) => issue.severity === "block") ? "blocked" : issues.length ? "needs_review" : "valid";
    return { ...creative, motivoDescartavel: creative.descartavel ? creative.motivoDescartavel : null, promptGemini, veoPrompts, actualCounts, issues, status };
  });
  const status = batchIssues.some((issue) => issue.severity === "block") || creatives.some((creative) => creative.status === "blocked") ? "blocked" : creatives.some((creative) => creative.status === "needs_review") ? "needs_review" : "valid";
  return { ...safeBatch, creatives, batchIssues, status, settingsUpdatedAt, productProfile: safeInput.productProfile };
}
