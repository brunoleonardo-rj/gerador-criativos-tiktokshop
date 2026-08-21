import { z } from "zod";
import { creativeBatchSchema } from "./schema";

export type AnthropicOutputFormat = { type: "json_schema"; schema: Record<string, unknown> };

export function getAnthropicOutputFormat(): AnthropicOutputFormat {
  return { type: "json_schema", schema: z.toJSONSchema(creativeBatchSchema, { target: "draft-07" }) as Record<string, unknown> };
}
