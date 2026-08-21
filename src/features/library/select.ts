import type { LibraryCorpus, LibraryCreative } from "./schema";
export type LibrarySelectionQuery = { produto: string; categoria: string; limit?: number };
export type LibraryContext = Pick<LibraryCorpus, "playbook" | "hashtagPatterns"> & { creatives: LibraryCreative[] };
const CATEGORY_TERMS: Record<string, string[]> = { perfumaria: ["perfume", "body", "splash", "fragrância", "colônia", "cheiro"], moda: ["moda", "calça", "legging", "camiseta", "camisa", "roupa", "flare", "cinta"], casa: ["cozinha", "fatiador", "organizador", "cortador", "utensílio", "casa"] };
const words = (value: string) => value.normalize("NFC").toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]+/gu) ?? [];
const STOP_WORDS = new Set(["sem", "para", "com", "kit", "uma", "uns", "das", "dos"]);
const ranked = (items: Array<{ creative: LibraryCreative; score: number }>) => items.sort((a, b) => b.score - a.score || a.creative.id.localeCompare(b.creative.id, "en"));
export function selectLibraryContext(corpus: LibraryCorpus, query: LibrarySelectionQuery): LibraryContext {
  const limit = Math.max(1, Math.min(Math.trunc(query.limit ?? 12), 24));
  const productTerms = new Set(words(query.produto).filter((word) => word.length > 2 && !STOP_WORDS.has(word))); const categoryTerms = new Set(CATEGORY_TERMS[query.categoria.toLocaleLowerCase("pt-BR")] ?? []);
  const candidates = corpus.creatives.map((creative) => { const product = new Set(words(creative.produto)); const productScore = [...productTerms].reduce((score, term) => score + (product.has(term) ? 100 : 0), 0); const categoryScore = [...categoryTerms].reduce((score, term) => score + (product.has(term) ? 25 : 0), 0); return { creative, productScore, categoryScore }; });
  const tiers = [ranked(candidates.filter((item) => item.productScore > 0).map(({ creative, productScore }) => ({ creative, score: productScore }))), ranked(candidates.filter((item) => item.categoryScore > 0).map(({ creative, categoryScore }) => ({ creative, score: categoryScore })))] as const;
  const selected: LibraryCreative[] = []; const selectedIds = new Set<string>(); const mechanisms = new Set<string>();
  for (const tier of tiers) for (const { creative } of tier) if (selected.length < limit && !selectedIds.has(creative.id) && !mechanisms.has(creative.mecanismo)) { selected.push(creative); selectedIds.add(creative.id); mechanisms.add(creative.mecanismo); }
  for (const tier of tiers) for (const { creative } of tier) if (selected.length < limit && !selectedIds.has(creative.id)) { selected.push(creative); selectedIds.add(creative.id); }
  return { playbook: [...corpus.playbook], hashtagPatterns: [...corpus.hashtagPatterns], creatives: selected };
}
