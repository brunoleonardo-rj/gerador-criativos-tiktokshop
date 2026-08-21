import type { LibraryCorpus, LibraryCreative } from "./schema";

export type LibrarySelectionQuery = { produto: string; categoria: string; limit?: number };
export type LibraryContext = Pick<LibraryCorpus, "playbook" | "hashtagPatterns"> & { creatives: LibraryCreative[] };
const CATEGORY_TERMS: Record<string, string[]> = { perfumaria: ["perfume", "body splash", "fragrância", "colônia", "cheiro"] };
const words = (value: string) => value.normalize("NFC").toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]+/gu) ?? [];

export function selectLibraryContext(corpus: LibraryCorpus, query: LibrarySelectionQuery): LibraryContext {
  const limit = Math.max(1, Math.min(Math.trunc(query.limit ?? 12), 24));
  const productWords = new Set(words(query.produto).filter((word) => word.length > 2));
  const categoryWords = new Set([...(CATEGORY_TERMS[query.categoria.toLocaleLowerCase("pt-BR")] ?? []), ...words(query.categoria)]);
  const ranked = corpus.creatives.map((creative) => {
    const product = creative.produto.toLocaleLowerCase("pt-BR");
    const productScore = [...productWords].reduce((score, word) => score + (product.includes(word) ? 100 : 0), 0);
    const categoryScore = [...categoryWords].reduce((score, word) => score + (product.includes(word) ? 25 : 0), 0);
    return { creative, score: productScore + categoryScore };
  }).sort((a, b) => b.score - a.score || a.creative.id.localeCompare(b.creative.id, "en"));
  const selected: LibraryCreative[] = []; const mechanisms = new Set<string>();
  for (const { creative } of ranked) { if (selected.length >= limit) break; if (!mechanisms.has(creative.mecanismo)) { selected.push(creative); mechanisms.add(creative.mecanismo); } }
  for (const { creative } of ranked) { if (selected.length >= limit) break; if (!selected.some((item) => item.id === creative.id)) selected.push(creative); }
  return { playbook: [...corpus.playbook], hashtagPatterns: [...corpus.hashtagPatterns], creatives: selected };
}
