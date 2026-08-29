import type { ContentBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { GenerationInput } from "./schema";
import type { LibraryContext } from "@/features/library/select";
import { SYSTEM_PROMPT } from "./system-prompt";

export type GenerationImage = { role: "product" | "ad"; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
const MAX_LIBRARY_BYTES = 120_000;
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, item]) => [key, stable(item)])); return value; }
function bounded(value: string): string { return value.length <= MAX_LIBRARY_BYTES ? value : value.slice(0, MAX_LIBRARY_BYTES); }

export function buildAnthropicPrompt({ input, library, images }: { input: GenerationInput; library: LibraryContext; images: GenerationImage[] }): { system: TextBlockParam[]; messages: MessageParam[] } {
  const content: ContentBlockParam[] = images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }));
  content.push({ type: "text", text: JSON.stringify({ produto: input }) });
  // O cache casa por prefixo: o corte fica depois do que é idêntico em toda requisição
  // (system + playbook + padrões de hashtag) e antes dos criativos, que mudam por produto.
  // Marcar o bloco variável, como antes, pagava 1,25x de escrita sem nunca ler.
  const shared = bounded(JSON.stringify(stable({ playbook: library.playbook, hashtagPatterns: library.hashtagPatterns })));
  const selected = bounded(JSON.stringify(stable({ creatives: library.creatives })));
  return {
    system: [
      { type: "text", text: SYSTEM_PROMPT },
      { type: "text", text: shared, cache_control: { type: "ephemeral" } },
      { type: "text", text: selected },
    ],
    messages: [{ role: "user", content }],
  };
}
