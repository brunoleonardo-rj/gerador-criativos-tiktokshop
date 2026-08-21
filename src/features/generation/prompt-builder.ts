import type { ContentBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { GenerationInput } from "./schema";
import type { LibraryContext } from "@/features/library/select";
import { SYSTEM_PROMPT } from "./system-prompt";

export type GenerationImage = { role: "product" | "ad"; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
const MAX_LIBRARY_BYTES = 120_000;
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, item]) => [key, stable(item)])); return value; }
function boundedLibrary(library: LibraryContext): string { const value = JSON.stringify(stable(library)); return value.length <= MAX_LIBRARY_BYTES ? value : value.slice(0, MAX_LIBRARY_BYTES); }

export function buildAnthropicPrompt({ input, library, images }: { input: GenerationInput; library: LibraryContext; images: GenerationImage[] }): { system: TextBlockParam[]; messages: MessageParam[] } {
  const content: ContentBlockParam[] = images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }));
  content.push({ type: "text", text: JSON.stringify({ produto: input }) });
  return { system: [{ type: "text", text: SYSTEM_PROMPT }, { type: "text", text: boundedLibrary(library), cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content }] };
}
