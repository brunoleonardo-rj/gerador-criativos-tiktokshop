import { libraryCorpusSchema, type LibraryCorpus } from "./schema";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, item]) => [key, stable(item)]));
  return value;
}

export function serializeCorpus(corpus: LibraryCorpus): string {
  const parsed = libraryCorpusSchema.parse(corpus);
  const normalized = { ...parsed, creatives: [...parsed.creatives].sort((a, b) => a.id.localeCompare(b.id, "en")) };
  return `${JSON.stringify(stable(normalized))}\n`;
}
