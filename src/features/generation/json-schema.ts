import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { creativeBatchSchema } from "./schema";

export function getAnthropicOutputFormat() {
  return zodOutputFormat(creativeBatchSchema);
}
