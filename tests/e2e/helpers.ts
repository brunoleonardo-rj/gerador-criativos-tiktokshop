import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/login");
  // The client form owns submission; wait for its first hydration in dev mode.
  await page.waitForTimeout(300);
  await page.getByLabel("Usuário").fill("admin-e2e");
  await page.getByLabel("Senha").fill("senha-e2e-forte-e-segura");
  const [response] = await Promise.all([
    page.waitForResponse("**/api/auth/login"),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
  expect(response.status()).toBe(204);
  await expect(page).toHaveURL("/");
}

export async function configureFakeKeyAndTemplate(page: Page) {
  await page.goto("/configuracoes");
  await page.getByLabel("Nova chave da Anthropic").fill("sk-ant-e2e-1234");
  await page.getByRole("tab", { name: "Prompt VEO 3" }).click();
  await page.getByLabel("Template VEO 3").fill("Fala: {{copy_trecho}}");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.", { exact: true })).toBeVisible();
}

export async function startMaleGeneration(page: Page, productName = "Body Splash E2E") {
  await page.goto("/");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.getByLabel("Categoria").selectOption("perfumaria");
  await page.getByLabel("Descrição do anúncio").fill("Kit masculino com quatro fragrâncias de 60 ml.");
  await page.getByLabel("Perfil UGC").selectOption("masculino");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Referências" })).toBeVisible();
  const image = { name: "produto.png", mimeType: "image/png", buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } }) };
  await page.getByLabel("Fotos da pessoa UGC").setInputFiles(image);
  await page.getByLabel("Fotos do produto").setInputFiles(image);
  await expect(page.getByText("produto.jpg").first()).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("group", { name: "Direção" })).toBeVisible();
}
