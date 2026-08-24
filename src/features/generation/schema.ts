import { z } from "zod";

const shortText = z.string().trim().min(1).max(500);
const longText = z.string().trim().min(1).max(10_000);

export const copySegmentSchema = z.object({
  texto: longText,
  palavras: z.number().int().nonnegative().max(1_000),
  segundos: z.number().int().min(1).max(30),
}).strict();

export const geminiSlotsSchema = z.object({
  identidadeUgc: longText,
  produto: shortText,
  wardrobeLock: longText,
  tecido: longText,
  evitar: longText,
  calcado: shortText,
  cenario: longText,
  iluminacao: shortText,
  acao: longText,
  pose: shortText,
  enquadramentoExtra: z.string().trim().max(500),
}).strict();

export const speechBeatSchema = z.object({
  triggerWord: z.string().trim().min(1).max(100),
  cameraMove: z.string().trim().min(1).max(500),
  gesture: z.string().trim().min(1).max(500),
  visibleResult: z.string().trim().min(1).max(500),
}).strict();

export const creativeSchema = z.object({
  id: shortText,
  angulo: shortText,
  ambiente: shortText,
  figurino: shortText,
  pose: shortText,
  geminiSlots: geminiSlotsSchema,
  speechBeats: z.array(speechBeatSchema).min(1).max(4),
  copy: z.object({ trecho1: copySegmentSchema, trecho2: copySegmentSchema, trecho3: copySegmentSchema.nullable() }).strict(),
  descricao: longText,
  hashtags: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  pov: z.object({ texto: z.string().trim().min(1).max(500), palavras: z.number().int().nonnegative().max(100), emoji: z.string().max(32) }).strict(),
  textoNaTela: z.string().trim().max(500).nullable(),
  descartavel: z.boolean(),
  motivoDescartavel: z.string().trim().min(1).max(1_000).nullable(),
}).strict().superRefine((creative, context) => {
  if (creative.descartavel && !creative.motivoDescartavel) context.addIssue({ code: "custom", path: ["motivoDescartavel"], message: "Motivo é obrigatório quando o criativo é descartável." });
  if (!creative.descartavel && creative.motivoDescartavel !== null) context.addIssue({ code: "custom", path: ["motivoDescartavel"], message: "Motivo deve ser nulo quando o criativo não é descartável." });
});

export const creativeBatchSchema = z.object({
  produtoNormalizado: shortText,
  fatos: z.array(z.string().trim().min(1).max(2_000)).max(30),
  riscos: z.array(z.string().trim().min(1).max(2_000)).max(30),
  checklistPublicacao: z.array(z.string().trim().min(1).max(1_000)).max(30),
  creatives: z.array(creativeSchema).min(1).max(8),
}).strict();

export const generationInputSchema = z.object({
  nomeProduto: shortText,
  categoria: shortText,
  descricaoPdp: longText,
  avaliacoes: z.string().trim().max(10_000).optional(),
  notaMedia: z.number().min(0).max(5).optional(),
  quantidadeAvaliacoes: z.number().int().nonnegative().max(10_000_000).optional(),
  precoAtual: z.string().trim().max(100).optional(),
  precoAnterior: z.string().trim().max(100).optional(),
  especificacoesCriticas: z.array(z.string().trim().min(1).max(1_000)).max(30).optional(),
  publicoAlvo: z.string().trim().max(2_000).optional(),
  perfilUgc: longText,
  linkProduto: z.string().url().max(2_000).optional(),
  quantidadeCriativos: z.number().int().min(1).max(8),
  ambientesPermitidos: z.array(shortText).min(1).max(20),
  politicaPreco: z.enum(["sem_preco", "teto_folgado", "preco_exato_com_aviso"]),
  duracaoTotal: z.union([z.literal(15), z.literal(20), z.literal(30)]),
  povComEmoji: z.boolean(),
  maxPalavrasPov: z.number().int().min(1).max(30),
  quantidadeHashtags: z.number().int().min(1).max(20),
  tomVoz: shortText,
}).strict();

export type GenerationInput = z.infer<typeof generationInputSchema>;
export type CreativeBatch = z.infer<typeof creativeBatchSchema>;
export type SpeechBeat = z.infer<typeof speechBeatSchema>;
