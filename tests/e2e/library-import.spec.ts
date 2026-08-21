import path from "node:path";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("uma importação válida exige ativação, pode sofrer rollback e uma falsa xlsx não altera o hash", async ({ page }) => {
  await login(page);
  await page.goto("/configuracoes");
  await page.getByRole("tab", { name: "Biblioteca" }).click();
  const active = page.getByRole("heading", { name: "Versão ativa" }).locator("..");
  await expect(active).toContainText("SHA");
  const originalHash = (await active.textContent())?.match(/SHA\s+([a-f0-9]{12})/i)?.[1];
  expect(originalHash).toBeTruthy();
  await page.getByLabel(/Importar planilha/).setInputFiles(path.resolve("test-results/runtime-data/biblioteca-e2e.xlsx"));
  await expect(page.getByText("Prévia pronta para ativação")).toBeVisible();
  await expect(active).toContainText(originalHash!);
  await page.getByRole("button", { name: "Ativar biblioteca" }).click();
  await expect(page.getByText("Biblioteca ativada.", { exact: true })).toBeVisible();
  const changedHash = (await active.textContent())?.match(/SHA\s+([a-f0-9]{12})/i)?.[1];
  expect(changedHash).toBeTruthy();
  expect(changedHash).not.toBe(originalHash);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restaurar versão anterior" }).click();
  await expect(page.getByText("Versão anterior restaurada.", { exact: true })).toBeVisible();
  await expect(active).toContainText(originalHash!);
  await page.getByLabel(/Importar planilha/).setInputFiles({ name: "invalida.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("não é um xlsx") });
  await expect(page.getByText("A planilha não pôde ser validada. A versão ativa continua inalterada.", { exact: true })).toBeVisible();
  await expect(active).toContainText(originalHash!);
});
