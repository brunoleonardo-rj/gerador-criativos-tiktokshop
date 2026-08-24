import { z } from "zod";

const nullableText = (maxLength: number) => z.string().trim().min(1).max(maxLength).nullable();

export const productExtractionSchema = z.object({
  nomeProduto: nullableText(500),
  categoria: nullableText(500),
  descricaoPdp: nullableText(10_000),
  avaliacoes: nullableText(10_000),
  notaMedia: z.number().min(0).max(5).nullable(),
  quantidadeAvaliacoes: z.number().int().nonnegative().max(10_000_000).nullable(),
  precoAtual: nullableText(100),
  precoAnterior: nullableText(100),
  especificacoesCriticas: z.array(z.string().trim().min(1).max(1_000)).max(30),
  publicoAlvo: nullableText(2_000),
  avisos: z.array(z.string().trim().min(1).max(1_000)).max(30),
}).strict();

export type ProductExtraction = z.infer<typeof productExtractionSchema>;
