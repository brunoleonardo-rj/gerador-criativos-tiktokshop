import { z } from "zod";

export const libraryCreativeSchema = z.object({
  numero: z.string().min(1), id: z.string().min(1), autor: z.string(), produto: z.string().min(1), duracao: z.string(), status: z.string(), confianca: z.string(),
  mecanismo: z.string().min(1), tipoHook: z.string(), hook: z.string().nullable(), corpo: z.string().nullable(),
  prova: z.string().nullable(), objecao: z.string().nullable(), oferta: z.string().nullable(), tipoCta: z.string(),
  cta: z.string().nullable(), descricao: z.string().nullable(), hashtags: z.array(z.string()),
  formulaAdaptavel: z.string().nullable(), risco: z.string(), notas: z.string(), url: z.string().nullable(), arquivoFonte: z.string().nullable(),
}).strict();

export const libraryCorpusSchema = z.object({
  schemaVersion: z.literal(1), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  summary: z.object({ recordCount: z.number().int().nonnegative(), products: z.record(z.string(), z.number().int().nonnegative()), mechanisms: z.record(z.string(), z.number().int().nonnegative()), statuses: z.record(z.string(), z.number().int().nonnegative()) }).strict(),
  playbook: z.array(z.string()), hashtagPatterns: z.array(z.string()), creatives: z.array(libraryCreativeSchema),
}).strict();

export type LibraryCreative = z.infer<typeof libraryCreativeSchema>;
export type LibraryCorpus = z.infer<typeof libraryCorpusSchema>;
