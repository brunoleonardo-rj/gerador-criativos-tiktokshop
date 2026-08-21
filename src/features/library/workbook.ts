import { createHash } from "node:crypto";
import XLSX from "xlsx";
import { libraryCorpusSchema, type LibraryCorpus, type LibraryCreative } from "./schema";

const REQUIRED_SHEETS = ["Resumo", "Catalogo", "Hooks", "Corpos", "CTAs", "Playbook", "Hashtags", "Fontes"] as const;
const HEADERS: Record<"Catalogo" | "Hooks" | "Corpos" | "CTAs" | "Fontes", string[]> = {
  Catalogo: ["Nº", "ID", "Autor", "Produto", "Duração", "Status", "Confiança", "Mecanismo", "Tipo de hook", "Hook", "Corpo", "Prova/mecanismo", "Objeção/tensão", "Oferta", "Tipo de CTA", "CTA", "Descrição", "Hashtags", "Fórmula adaptável", "Risco", "Notas", "URL", "Arquivo-fonte"],
  Hooks: ["Nº", "ID", "Produto", "Tipo", "Hook observado", "Fórmula adaptável", "Mecanismo", "Confiança", "Risco"],
  Corpos: ["Nº", "ID", "Produto", "Mecanismo", "Corpo", "Prova", "Objeção", "Oferta", "Risco"],
  CTAs: ["Nº", "ID", "Produto", "Tipo de CTA", "CTA observado", "Status", "Risco"],
  Fontes: ["Nº", "ID", "URL", "Arquivo local", "Status", "Confiança", "Nota de uso"],
};
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 1_000;
const MAX_COLUMNS = 30;
const MAX_CELL_LENGTH = 12_000;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

function text(value: unknown): string {
  return String(value ?? "").normalize("NFC").trim();
}
function id(value: unknown): string { return text(value).replace(ZERO_WIDTH, ""); }
function nullable(value: unknown): string | null { const result = text(value); return result || null; }
function rows(sheet: XLSX.WorkSheet): string[][] {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  if (range.e.r + 1 > MAX_ROWS || range.e.c + 1 > MAX_COLUMNS) throw new Error("Planilha excede os limites de linhas ou colunas");
  for (const cell of Object.values(sheet)) {
    if (typeof cell === "object" && cell && "t" in cell && (cell as XLSX.CellObject).t === "e") throw new Error("Planilha contém erro de fórmula");
    if (typeof cell === "object" && cell && "v" in cell && text((cell as XLSX.CellObject).v).length > MAX_CELL_LENGTH) throw new Error("Célula excede o limite de texto");
  }
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }).map((row) => row.map(text));
}
function assertHeader(values: string[][], sheet: keyof typeof HEADERS) {
  const expected = HEADERS[sheet]; const actual = values[0]?.slice(0, expected.length) ?? [];
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) throw new Error(`Cabeçalho inválido em ${sheet}`);
}
function assertHeaderAt(values: string[][], row: number, expected: string[], sheet: string) {
  const actual = values[row]?.slice(0, expected.length) ?? [];
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) throw new Error(`Cabeçalho inválido em ${sheet}`);
}
function nonemptyEditorial(values: string[][], sheet: string) {
  if (!values.some((row) => row.some(Boolean))) throw new Error(`Aba editorial vazia: ${sheet}`);
}
function countBy(values: string[]): Record<string, number> {
  return Object.fromEntries([...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>()).entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")));
}

export async function parseLibraryWorkbook(buffer: Buffer): Promise<LibraryCorpus> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_BYTES) throw new Error("Arquivo XLSX inválido ou excede 20 MB");
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true, cellText: false, cellDates: false }); } catch { throw new Error("Arquivo XLSX inválido"); }
  if (workbook.SheetNames.length !== REQUIRED_SHEETS.length || REQUIRED_SHEETS.some((name, index) => workbook.SheetNames[index] !== name)) throw new Error(`Abas obrigatórias inválidas: ${REQUIRED_SHEETS.join(", ")}`);
  const table = Object.fromEntries(REQUIRED_SHEETS.map((name) => [name, rows(workbook.Sheets[name])])) as Record<(typeof REQUIRED_SHEETS)[number], string[][]>;
  assertHeader(table.Catalogo, "Catalogo"); assertHeader(table.Hooks, "Hooks"); assertHeader(table.Corpos, "Corpos"); assertHeader(table.CTAs, "CTAs"); assertHeader(table.Fontes, "Fontes");
  assertHeaderAt(table.Resumo, 4, ["Indicador", "Valor", "", "Mecanismo", "Vídeos"], "Resumo");
  assertHeaderAt(table.Playbook, 3, ["Família de hook", "Fórmula", "Quando usar"], "Playbook");
  assertHeaderAt(table.Hashtags, 3, ["Hashtag", "Frequência", "Uso recomendado"], "Hashtags");
  nonemptyEditorial(table.Resumo, "Resumo"); nonemptyEditorial(table.Playbook, "Playbook"); nonemptyEditorial(table.Hashtags, "Hashtags");
  const creatives: LibraryCreative[] = table.Catalogo.slice(1).filter((row) => row.some(Boolean)).map((row) => ({
    id: id(row[1]), produto: text(row[3]), status: text(row[5]), confianca: text(row[6]), mecanismo: text(row[7]), tipoHook: text(row[8]), hook: nullable(row[9]), corpo: nullable(row[10]), prova: nullable(row[11]), objecao: nullable(row[12]), oferta: nullable(row[13]), tipoCta: text(row[14]), cta: nullable(row[15]), descricao: nullable(row[16]), hashtags: text(row[17]).split(/\s+/).filter((tag) => tag.startsWith("#")), formulaAdaptavel: nullable(row[18]), risco: text(row[19]), notas: text(row[20]), url: nullable(row[21]),
  }));
  if (creatives.length === 0) throw new Error("Catálogo sem criativos utilizáveis");
  const seen = new Set<string>();
  for (const creative of creatives) { if (!creative.id) throw new Error("ID ausente"); if (seen.has(creative.id)) throw new Error(`ID duplicado: ${creative.id}`); seen.add(creative.id); }
  const playbook = table.Playbook.slice(4).filter((row) => row.some(Boolean)).map((row) => row.filter(Boolean).join(" | "));
  const hashtagPatterns = table.Hashtags.slice(4).map((row) => row[0]).filter(Boolean);
  const corpus = { schemaVersion: 1 as const, sourceSha256: createHash("sha256").update(buffer).digest("hex"), summary: { recordCount: creatives.length, products: countBy(creatives.map((item) => item.produto)), mechanisms: countBy(creatives.map((item) => item.mecanismo)), statuses: countBy(creatives.map((item) => item.status)) }, playbook, hashtagPatterns, creatives: [...creatives].sort((a, b) => a.id.localeCompare(b.id, "en")) };
  return libraryCorpusSchema.parse(corpus);
}
