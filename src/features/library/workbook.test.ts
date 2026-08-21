import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseLibraryWorkbook } from "./workbook";

export const headers = {
  Resumo: ["Indicador", "Valor", "", "Mecanismo", "Vídeos"], Catalogo: ["Nº", "ID", "Autor", "Produto", "Duração", "Status", "Confiança", "Mecanismo", "Tipo de hook", "Hook", "Corpo", "Prova/mecanismo", "Objeção/tensão", "Oferta", "Tipo de CTA", "CTA", "Descrição", "Hashtags", "Fórmula adaptável", "Risco", "Notas", "URL", "Arquivo-fonte"], Hooks: ["Nº", "ID", "Produto", "Tipo", "Hook observado", "Fórmula adaptável", "Mecanismo", "Confiança", "Risco"], Corpos: ["Nº", "ID", "Produto", "Mecanismo", "Corpo", "Prova", "Objeção", "Oferta", "Risco"], CTAs: ["Nº", "ID", "Produto", "Tipo de CTA", "CTA observado", "Status", "Risco"], PlaybookHook: ["Família de hook", "Fórmula", "Quando usar", ""], PlaybookBody: ["Estrutura de corpo", "Lógica", "Molde", ""], PlaybookCta: ["Tipo de CTA", "Fórmula", "", ""], PlaybookDuration: ["Duração", "Estrutura", "Palavras", "Indicação"], Hashtags: ["Hashtag", "Frequência", "Uso recomendado", "", "1 de categoria"], Fontes: ["Nº", "ID", "URL", "Arquivo local", "Status", "Confiança", "Nota de uso"],
} as const;
type Row = { id: string; produto: string; mecanismo: string };
type Options = { catalogHeaders?: string[]; emptyEditorial?: "Resumo" | "Playbook" | "Hashtags"; derivativeRows?: number; derivativeId?: string };

export async function buildWorkbookFixture(rows: Row[], options: Options = {}) {
  const workbook = new ExcelJS.Workbook();
  const resumo = workbook.addWorksheet("Resumo"); resumo.addRow(["Biblioteca Mestra"]); resumo.addRow([]); resumo.addRow(["Corpus"]); resumo.addRow([]); resumo.addRow(headers.Resumo); if (options.emptyEditorial !== "Resumo") resumo.addRow(["Vídeos únicos", rows.length, "", "M", rows.length]);
  const catalogo = workbook.addWorksheet("Catalogo"); catalogo.addRow(options.catalogHeaders ?? headers.Catalogo); rows.forEach((row, i) => catalogo.addRow([i + 1, row.id, "@autor", row.produto, "10 segundos", "Copy falada", "Alta", row.mecanismo, "Declaração direta", "Hook", "Corpo", "Prova", "Objeção", "", "Carrinho", "CTA", "Descrição", "#teste", "Fórmula", "Baixo", "Notas", "https://example.test", `fonte-${i + 1}.md`]));
  const sourceRows = rows.slice(0, options.derivativeRows ?? rows.length).map((row, i) => ({ ...row, id: i === 0 && options.derivativeId ? options.derivativeId : row.id }));
  const hooks = workbook.addWorksheet("Hooks"); hooks.addRow(headers.Hooks); sourceRows.forEach((row, i) => hooks.addRow([i + 1, row.id, row.produto, "Declaração direta", "Hook", "Fórmula", row.mecanismo, "Alta", "Baixo"]));
  const corpos = workbook.addWorksheet("Corpos"); corpos.addRow(headers.Corpos); sourceRows.forEach((row, i) => corpos.addRow([i + 1, row.id, row.produto, row.mecanismo, "Corpo", "Prova", "Objeção", "", "Baixo"]));
  const ctas = workbook.addWorksheet("CTAs"); ctas.addRow(headers.CTAs); sourceRows.forEach((row, i) => ctas.addRow([i + 1, row.id, row.produto, "Carrinho", "CTA", "Copy falada", "Baixo"]));
  const playbook = workbook.addWorksheet("Playbook"); const playbookHasData = options.emptyEditorial !== "Playbook"; playbook.addRow(["Playbook"]); playbook.addRow([]); playbook.addRow([]); playbook.addRow(headers.PlaybookHook); playbook.addRow(playbookHasData ? ["Confissão", "Eu testei", "Uso", ""] : []); while (playbook.rowCount < 18) playbook.addRow([]); playbook.addRow(headers.PlaybookBody); playbook.addRow(playbookHasData ? ["Dor", "Lógica", "Molde", ""] : []); while (playbook.rowCount < 31) playbook.addRow([]); playbook.addRow(headers.PlaybookCta); playbook.addRow(playbookHasData ? ["Carrinho", "Confira", "", ""] : []); while (playbook.rowCount < 42) playbook.addRow([]); playbook.addRow(headers.PlaybookDuration); playbook.addRow(playbookHasData ? ["10 s", "Hook", "18", "Curto"] : []);
  const hashtags = workbook.addWorksheet("Hashtags"); hashtags.addRow(["Hashtags", "", "", "", "Regra prática"]); hashtags.addRow(["", "", "", "", "Use até 5"]); hashtags.addRow(["", "", "", "", "1 produto"]); hashtags.addRow(headers.Hashtags); if (options.emptyEditorial !== "Hashtags") hashtags.addRow(["#teste", 1, "Produto", "", ""]);
  const fontes = workbook.addWorksheet("Fontes"); fontes.addRow(headers.Fontes); sourceRows.forEach((row, i) => fontes.addRow([i + 1, row.id, "https://example.test", `fonte-${i + 1}.md`, "Copy falada", "Alta", "Notas"]));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("parseLibraryWorkbook", () => {
  it("mapeia as 23 colunas do Catalogo incluindo arquivo-fonte", async () => await expect(parseLibraryWorkbook(await buildWorkbookFixture([{ id: "\u200B1", produto: "Body splash", mecanismo: "M" }]))).resolves.toMatchObject({ creatives: [{ id: "1", numero: "1", autor: "@autor", duracao: "10 segundos", arquivoFonte: "fonte-1.md" }] }));
  it("rejeita largura extra e editoriais sem dados após cabeçalhos", async () => {
    await expect(parseLibraryWorkbook(await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }], { catalogHeaders: [...headers.Catalogo, "Extra"] }))).rejects.toThrow(/Cabeçalho inválido em Catalogo/);
    for (const sheet of ["Resumo", "Playbook", "Hashtags"] as const) await expect(parseLibraryWorkbook(await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }], { emptyEditorial: sheet }))).rejects.toThrow(/Aba editorial vazia/);
  });
  it("rejeita IDs duplicados, ausentes e órfãos nas abas derivadas", async () => {
    await expect(parseLibraryWorkbook(await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }, { id: "\u200B1", produto: "Q", mecanismo: "M" }]))).rejects.toThrow(/ID duplicado/);
    await expect(parseLibraryWorkbook(await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }, { id: "2", produto: "Q", mecanismo: "M" }], { derivativeRows: 1 }))).rejects.toThrow(/ID ausente em Hooks/);
    await expect(parseLibraryWorkbook(await buildWorkbookFixture([{ id: "1", produto: "P", mecanismo: "M" }], { derivativeId: "99" }))).rejects.toThrow(/ID órfão em Hooks/);
  });
});
