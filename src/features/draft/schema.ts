import { z } from "zod";
import { generationInputSchema } from "@/features/generation/schema";

/** Browser-persisted form state. Images deliberately live in IndexedDB. */
// A draft represents an in-progress form, not a request accepted by the API.
// In particular, an empty environment list records that the user explicitly
// cleared the default and must not be converted back to one on reload.
export const draftSchema = generationInputSchema.partial().extend({
  ambientesPermitidos: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
});
export type Draft = z.infer<typeof draftSchema>;
