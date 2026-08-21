import { z } from "zod";
import { generationInputSchema } from "@/features/generation/schema";

/** Browser-persisted form state. Images deliberately live in IndexedDB. */
export const draftSchema = generationInputSchema.partial();
export type Draft = z.infer<typeof draftSchema>;
