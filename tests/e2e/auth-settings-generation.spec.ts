import { expect, test } from "@playwright/test";
import { configureFakeKeyAndTemplate, login, startMaleGeneration } from "./helpers";

test("login, configuração, geração e cópia do VEO preservam a copy renderizada", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await configureFakeKeyAndTemplate(page);
  await startMaleGeneration(page);
  await page.getByRole("button", { name: "Gerar criativos" }).click();
  await expect(page).toHaveURL(/\/resultado\/[0-9a-f-]{36}$/);
  await page.getByRole("tab", { name: "VEO 3" }).click();
  await expect(page.getByRole("heading", { name: "Prompt VEO 3 — Trecho 1" })).toBeVisible();
  await expect(page.getByText(/Fala: Eu uso este produto todos os dias/)).toBeVisible();
  const copyVeo = page.getByRole("button", { name: "Copiar Prompt VEO 3 — Trecho 1" });
  await copyVeo.click();
  await expect(copyVeo.locator("..").getByRole("status")).toHaveText("Copiado com sucesso.");
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain("Fala: Eu uso este produto");
});
