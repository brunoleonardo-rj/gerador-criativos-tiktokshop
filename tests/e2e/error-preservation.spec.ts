import { expect, test } from "@playwright/test";
import { configureFakeKeyAndTemplate, login, startMaleGeneration } from "./helpers";

test("timeout preserva o rascunho e só tenta novamente por ação explícita", async ({ page }) => {
  await login(page);
  await configureFakeKeyAndTemplate(page);
  await startMaleGeneration(page, "Produto preservado após timeout");
  let attempts = 0;
  await page.route("**/api/generate", async (route) => {
    attempts += 1;
    await route.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ code: "TIMEOUT" }) });
  }, { times: 1 });
  await page.getByRole("button", { name: "Gerar criativos" }).click();
  await expect(page.getByText("A geração demorou mais que o esperado.", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(attempts).toBe(1);
  await page.reload();
  await expect(page.getByLabel("Nome do produto")).toHaveValue("Produto preservado após timeout");
  await expect(page.getByLabel("Categoria")).toHaveValue("perfumaria");
  await expect(page.getByLabel("Descrição do anúncio")).toHaveValue("Kit masculino com quatro fragrâncias de 60 ml.");
  await expect(page.getByLabel("Perfil UGC")).toHaveValue("masculino");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Gerar criativos" }).click();
  await expect(page).toHaveURL(/\/resultado\/[0-9a-f-]{36}$/);
});
