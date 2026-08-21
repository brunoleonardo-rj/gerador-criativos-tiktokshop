import { createHash } from "node:crypto";
import readXlsxFile from "read-excel-file/node";
import { libraryCorpusSchema, type LibraryCorpus, type LibraryCreative } from "./schema";
import { preflightXlsx } from "./zip";

const REQUIRED_SHEETS = ["Resumo", "Catalogo", "Hooks", "Corpos", "CTAs", "Playbook", "Hashtags", "Fontes"] as const;
const HEADERS = {
  Resumo: [[4, ["Indicador", "Valor", "", "Mecanismo", "Vídeos"]]], Catalogo: [[0, ["Nº", "ID", "Autor", "Produto", "Duração", "Status", "Confiança", "Mecanismo", "Tipo de hook", "Hook", "Corpo", "Prova/mecanismo", "Objeção/tensão", "Oferta", "Tipo de CTA", "CTA", "Descrição", "Hashtags", "Fórmula adaptável", "Risco", "Notas", "URL", "Arquivo-fonte"]]], Hooks: [[0, ["Nº", "ID", "Produto", "Tipo", "Hook observado", "Fórmula adaptável", "Mecanismo", "Confiança", "Risco"]]], Corpos: [[0, ["Nº", "ID", "Produto", "Mecanismo", "Corpo", "Prova", "Objeção", "Oferta", "Risco"]]], CTAs: [[0, ["Nº", "ID", "Produto", "Tipo de CTA", "CTA observado", "Status", "Risco"]]], Playbook: [[3, ["Família de hook", "Fórmula", "Quando usar", ""]], [18, ["Estrutura de corpo", "Lógica", "Molde", ""]], [31, ["Tipo de CTA", "Fórmula", "", ""]], [42, ["Duração", "Estrutura", "Palavras", "Indicação"]]], Hashtags: [[3, ["Hashtag", "Frequência", "Uso recomendado", "", "1 de categoria"]]], Fontes: [[0, ["Nº", "ID", "URL", "Arquivo local", "Status", "Confiança", "Nota de uso"]]],
} as const;
const MAX_BYTES = 20 * 1024 * 1024; const MAX_ROWS = 1_000; const MAX_CELL_LENGTH = 12_000; const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
type SheetName = (typeof REQUIRED_SHEETS)[number]; type Table = Record<SheetName, string[][]>;
const text = (value: unknown) => String(value ?? "").normalize("NFC").trim();
const normalizedId = (value: unknown) => text(value).replace(ZERO_WIDTH, "");
const nullable = (value: unknown) => text(value) || null;
function countBy(values: string[]) { return Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b, "pt-BR"))); }
function validateHeaders(name: SheetName, rows: string[][]) {
  for (const [rowIndex, expected] of HEADERS[name]) { const actual = rows[rowIndex]; if (!actual || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) throw new Error(`Cabeçalho inválido em ${name}`); }
}
function dataRows(name: SheetName, rows: string[][]) {
  const headerRows = new Set<number>(HEADERS[name].map(([index]) => index));
  const firstDataRow = name === "Playbook" ? 4 : name === "Resumo" || name === "Hashtags" ? 4 : 1;
  return rows.filter((row, index) => index >= firstDataRow && !headerRows.has(index) && row.some(Boolean));
}
function requireEditorialData(name: "Resumo" | "Playbook" | "Hashtags", rows: string[][]) { if (dataRows(name, rows).length === 0) throw new Error(`Aba editorial vazia: ${name}`); }
function deriveMap(name: "Hooks" | "Corpos" | "CTAs" | "Fontes", rows: string[][], catalog: Map<string, LibraryCreative>) {
  const entries = dataRows(name, rows); if (entries.length !== catalog.size) throw new Error(`ID ausente em ${name}`);
  const seen = new Set<string>();
  for (const row of entries) { const itemId = normalizedId(row[1]); if (!itemId) throw new Error(`ID ausente em ${name}`); if (seen.has(itemId)) throw new Error(`ID duplicado em ${name}: ${itemId}`); const creative = catalog.get(itemId); if (!creative) throw new Error(`ID órfão em ${name}: ${itemId}`); seen.add(itemId);
    const expected = name === "Hooks" ? [creative.numero, creative.id, creative.produto, creative.tipoHook, creative.hook ?? "", creative.formulaAdaptavel ?? "", creative.mecanismo, creative.confianca, creative.risco] : name === "Corpos" ? [creative.numero, creative.id, creative.produto, creative.mecanismo, creative.corpo ?? "", creative.prova ?? "", creative.objecao ?? "", creative.oferta ?? "", creative.risco] : name === "CTAs" ? [creative.numero, creative.id, creative.produto, creative.tipoCta, creative.cta ?? "", creative.status, creative.risco] : [creative.numero, creative.id, creative.url ?? "", creative.arquivoFonte ?? "", creative.status, creative.confianca, creative.notas];
    const comparable = [...row]; comparable[1] = itemId;
    if (comparable.length !== expected.length || comparable.some((value, index) => value !== expected[index])) throw new Error(`Dados inconsistentes em ${name}: ${itemId}`);
  }
}

export async function parseLibraryWorkbook(buffer: Buffer): Promise<LibraryCorpus> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_BYTES) throw new Error("Arquivo XLSX inválido ou excede 20 MB");
  preflightXlsx(buffer);
  let imported: Array<{ sheet: string; data: unknown[][] }>;
  try { imported = await readXlsxFile(buffer) as Array<{ sheet: string; data: unknown[][] }>; } catch { throw new Error("Arquivo XLSX inválido"); }
  if (imported.length !== REQUIRED_SHEETS.length || REQUIRED_SHEETS.some((name, index) => imported[index]?.sheet !== name)) throw new Error(`Abas obrigatórias inválidas: ${REQUIRED_SHEETS.join(", ")}`);
  const table = Object.fromEntries(imported.map(({ sheet, data }) => [sheet, data.map((row) => { if (row.length > 30) throw new Error("Planilha excede o limite de colunas"); return row.map((cell) => { const value = text(cell); if (value.length > MAX_CELL_LENGTH) throw new Error("Célula excede o limite de texto"); return value; }); })])) as Table;
  for (const name of REQUIRED_SHEETS) { if (table[name].length > MAX_ROWS) throw new Error("Planilha excede o limite de linhas"); validateHeaders(name, table[name]); }
  requireEditorialData("Resumo", table.Resumo); requireEditorialData("Playbook", table.Playbook); requireEditorialData("Hashtags", table.Hashtags);
  const creatives = dataRows("Catalogo", table.Catalogo).map((row): LibraryCreative => ({ numero: text(row[0]), id: normalizedId(row[1]), autor: text(row[2]), produto: text(row[3]), duracao: text(row[4]), status: text(row[5]), confianca: text(row[6]), mecanismo: text(row[7]), tipoHook: text(row[8]), hook: nullable(row[9]), corpo: nullable(row[10]), prova: nullable(row[11]), objecao: nullable(row[12]), oferta: nullable(row[13]), tipoCta: text(row[14]), cta: nullable(row[15]), descricao: nullable(row[16]), hashtags: text(row[17]).split(/\s+/).filter((tag) => tag.startsWith("#")), formulaAdaptavel: nullable(row[18]), risco: text(row[19]), notas: text(row[20]), url: nullable(row[21]), arquivoFonte: nullable(row[22]) }));
  if (creatives.length === 0) throw new Error("Catálogo sem criativos utilizáveis");
  const catalog = new Map<string, LibraryCreative>(); for (const creative of creatives) { if (!creative.numero || !creative.id || !creative.produto || !creative.mecanismo) throw new Error("Campo obrigatório ausente no Catalogo"); if (catalog.has(creative.id)) throw new Error(`ID duplicado: ${creative.id}`); catalog.set(creative.id, creative); }
  deriveMap("Hooks", table.Hooks, catalog); deriveMap("Corpos", table.Corpos, catalog); deriveMap("CTAs", table.CTAs, catalog); deriveMap("Fontes", table.Fontes, catalog);
  const playbook = dataRows("Playbook", table.Playbook).map((row) => row.filter(Boolean).join(" | ")); const hashtagPatterns = dataRows("Hashtags", table.Hashtags).map((row) => row[0]).filter(Boolean);
  return libraryCorpusSchema.parse({ schemaVersion: 1, sourceSha256: createHash("sha256").update(buffer).digest("hex"), summary: { recordCount: creatives.length, products: countBy(creatives.map((item) => item.produto)), mechanisms: countBy(creatives.map((item) => item.mecanismo)), statuses: countBy(creatives.map((item) => item.status)) }, playbook, hashtagPatterns, creatives: [...creatives].sort((a, b) => a.id.localeCompare(b.id, "en")) });
}
