import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseLibraryWorkbook } from "./workbook";

const catalogHeaders = [
  "Nº", "ID", "Autor", "Produto", "Duração", "Status", "Confiança", "Mecanismo", "Tipo de hook", "Hook", "Corpo", "Prova/mecanismo", "Objeção/tensão", "Oferta", "Tipo de CTA", "CTA", "Descrição", "Hashtags", "Fórmula adaptável", "Risco", "Notas", "URL", "Arquivo-fonte",
];

async function buildWorkbookFixture(rows: Array<{ id: string; produto: string; mecanismo: string }>) {
  const workbook = new ExcelJS.Workbook();
  const resumo = workbook.addWorksheet("Resumo");
  resumo.addRow(["Biblioteca Mestra"]);
  resumo.addRow([]); resumo.addRow(["Corpus local consolidado"]); resumo.addRow([]);
  resumo.addRow(["Indicador", "Valor", "", "Mecanismo", "Vídeos"]);
  resumo.addRow(["Vídeos únicos", rows.length]);
  const catalogo = workbook.addWorksheet("Catalogo");
  catalogo.addRow(catalogHeaders);
  rows.forEach((row, index) => catalogo.addRow([index + 1, row.id, "@autor", row.produto, "10 segundos", "Copy falada", "Alta", row.mecanismo, "Declaração direta", "Hook", "Corpo", "Prova", "Objeção", "", "Carrinho", "CTA", "Descrição", "#teste #produto", "Fórmula", "Baixo", "Notas", "https://example.test", "fonte.md"]));
  const hooks = workbook.addWorksheet("Hooks");
  hooks.addRow(["Nº", "ID", "Produto", "Tipo", "Hook observado", "Fórmula adaptável", "Mecanismo", "Confiança", "Risco"]);
  rows.forEach((row, index) => hooks.addRow([index + 1, row.id, row.produto, "Declaração direta", "Hook", "Fórmula", row.mecanismo, "Alta", "Baixo"]));
  const corpos = workbook.addWorksheet("Corpos");
  corpos.addRow(["Nº", "ID", "Produto", "Mecanismo", "Corpo", "Prova", "Objeção", "Oferta", "Risco"]);
  rows.forEach((row, index) => corpos.addRow([index + 1, row.id, row.produto, row.mecanismo, "Corpo", "Prova", "Objeção", "", "Baixo"]));
  const ctas = workbook.addWorksheet("CTAs");
  ctas.addRow(["Nº", "ID", "Produto", "Tipo de CTA", "CTA observado", "Status", "Risco"]);
  rows.forEach((row, index) => ctas.addRow([index + 1, row.id, row.produto, "Carrinho", "CTA", "Copy falada", "Baixo"]));
  const playbook = workbook.addWorksheet("Playbook");
  playbook.addRow(["Playbook"]); playbook.addRow([]); playbook.addRow([]); playbook.addRow(["Família de hook", "Fórmula", "Quando usar"]); playbook.addRow(["Confissão", "Eu testei [PRODUTO]", "Uso geral"]);
  const hashtags = workbook.addWorksheet("Hashtags");
  hashtags.addRow(["Hashtags", "", "", "", "Regra prática"]); hashtags.addRow(["", "", "", "", "Use até 5 hashtags"]); hashtags.addRow(["", "", "", "", "1 de produto"]); hashtags.addRow(["Hashtag", "Frequência", "Uso recomendado"]); hashtags.addRow(["#teste", 1, "Produto"]);
  const fontes = workbook.addWorksheet("Fontes");
  fontes.addRow(["Nº", "ID", "URL", "Arquivo local", "Status", "Confiança", "Nota de uso"]);
  rows.forEach((row, index) => fontes.addRow([index + 1, row.id, "https://example.test", "fonte.md", "Copy falada", "Alta", "Nota"]));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("parseLibraryWorkbook", () => {
  it("converte workbook válido, normaliza ID e preserva texto editorial NFC", async () => {
    const valid = await buildWorkbookFixture([{ id: "\u200B1", produto: "Body splash", mecanismo: "Depoimento pessoal" }]);
    await expect(parseLibraryWorkbook(valid)).resolves.toMatchObject({ creatives: [{ id: "1", produto: "Body splash" }] });
  });

  it("rejeita ID duplicado após normalização", async () => {
    const duplicate = await buildWorkbookFixture([
      { id: "1", produto: "Body splash", mecanismo: "Depoimento pessoal" },
      { id: "\u200B1", produto: "Body splash", mecanismo: "Benefícios" },
    ]);
    await expect(parseLibraryWorkbook(duplicate)).rejects.toThrow(/ID duplicado/);
  });

  it("rejeita a ausência de uma aba obrigatória", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Catalogo").addRow(catalogHeaders);
    await expect(parseLibraryWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()))).rejects.toThrow(/Resumo/);
  });
});

export { buildWorkbookFixture };
