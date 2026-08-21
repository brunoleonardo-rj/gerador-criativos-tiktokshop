import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const runtimeDir = path.resolve("test-results/runtime-data");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3101",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --hostname localhost --port 3101",
    url: "http://localhost:3101/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ADMIN_USERNAME: "admin-e2e",
      ADMIN_PASSWORD: "senha-e2e-forte-e-segura",
      AUTH_SECRET: "auth-secret-e2e-com-mais-de-trinta-e-dois-caracteres",
      TRUSTED_PROXY_SECRET: "proxy-secret-e2e-com-mais-de-trinta-e-dois-caracteres",
      SETTINGS_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      DATA_DIR: runtimeDir,
      DATABASE_URL: `file:${path.join(runtimeDir, "app.db").replaceAll("\\", "/")}`,
      E2E_FAKE_ANTHROPIC: "1",
      NODE_ENV: "development",
    },
  },
});
