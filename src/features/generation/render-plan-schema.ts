import { z } from "zod";

export const formatoUsoSchema = z.enum(["vestido", "manuseado", "aplicado_no_corpo", "consumido", "ambiente"]);
export const zonaFocoSchema = z.enum(["cabeca", "tronco", "corpo_inteiro", "pernas_pes", "maos", "objeto"]);

export const productProfileSchema = z.object({
  formatoUso: formatoUsoSchema,
  zonaFoco: zonaFocoSchema,
  detalheCritico: z.string().trim().min(1).max(500).nullable(),
}).strict();
