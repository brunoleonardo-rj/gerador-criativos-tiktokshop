import type { LibraryCorpus, LibraryCreative } from "./schema";
export type LibrarySelectionQuery = { produto: string; categoria: string; limit?: number };
export type LibraryContext = Pick<LibraryCorpus, "playbook" | "hashtagPatterns"> & { creatives: LibraryCreative[] };
const CATEGORY_TERMS: Record<string, string[]> = { perfumaria: ["perfume", "body", "splash", "fragrância", "colônia", "cheiro"], moda: ["moda", "calça", "legging", "camiseta", "camisa", "roupa", "flare", "cinta"], casa: ["cozinha", "fatiador", "organizador", "cortador", "utensílio", "casa"] };
const words = (value: string) => value.normalize("NFC").toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]+/gu) ?? [];
const STOP_WORDS = new Set(["sem", "para", "com", "kit", "uma", "uns", "das", "dos"]);
const ranked = (items: Array<{ creative: LibraryCreative; score: number }>) => items.sort((a, b) => b.score - a.score || a.creative.id.localeCompare(b.creative.id, "en"));

// A categoria é digitada à mão. Fora das três mapeadas, as próprias palavras do
// que foi digitado viram termos de busca — sem isso, "organizadores" ou "saúde"
// pontuavam zero em todo o corpus.
function categoryTermsFor(categoria: string): Set<string> {
  const mapeados = CATEGORY_TERMS[categoria.toLocaleLowerCase("pt-BR")] ?? [];
  return new Set([...mapeados, ...words(categoria).filter((word) => word.length > 2 && !STOP_WORDS.has(word))]);
}

export function selectLibraryContext(corpus: LibraryCorpus, query: LibrarySelectionQuery): LibraryContext {
  const limit = Math.max(1, Math.min(Math.trunc(query.limit ?? 12), 24));
  const productTerms = new Set(words(query.produto).filter((word) => word.length > 2 && !STOP_WORDS.has(word))); const categoryTerms = categoryTermsFor(query.categoria);
  const candidates = corpus.creatives.map((creative) => { const product = new Set(words(creative.produto)); const productScore = [...productTerms].reduce((score, term) => score + (product.has(term) ? 100 : 0), 0); const categoryScore = [...categoryTerms].reduce((score, term) => score + (product.has(term) ? 25 : 0), 0); return { creative, productScore, categoryScore }; });
  const tiers = [ranked(candidates.filter((item) => item.productScore > 0).map(({ creative, productScore }) => ({ creative, score: productScore }))), ranked(candidates.filter((item) => item.categoryScore > 0).map(({ creative, categoryScore }) => ({ creative, score: categoryScore })))] as const;
  const selected: LibraryCreative[] = []; const selectedIds = new Set<string>(); const mechanisms = new Set<string>();
  const take = (creative: LibraryCreative, exigirMecanismoNovo: boolean) => {
    if (selected.length >= limit || selectedIds.has(creative.id)) return;
    if (exigirMecanismoNovo && mechanisms.has(creative.mecanismo)) return;
    selected.push(creative); selectedIds.add(creative.id); mechanisms.add(creative.mecanismo);
  };
  for (const tier of tiers) for (const { creative } of tier) take(creative, true);
  for (const tier of tiers) for (const { creative } of tier) take(creative, false);
  // Só quando NADA casou. Completar um conjunto que já tem match com criativos
  // irrelevantes dilui a referência; devolver vazio era pior ainda — o modelo
  // gerava sem exemplo nenhum, com copy sem voz e fatos inventados.
  if (selected.length === 0) {
    for (const creative of corpus.creatives) take(creative, true);
    for (const creative of corpus.creatives) take(creative, false);
  }
  return { playbook: [...corpus.playbook], hashtagPatterns: [...corpus.hashtagPatterns], creatives: selected };
}
