import { describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

describe("getServerEnv", () => {
  it("rejeita segredos ausentes", () => {
    expect(() => getServerEnv({ NODE_ENV: "test" })).toThrow(/ADMIN_USERNAME/);
  });

  it("aceita uma configuração completa", () => {
    const env = getServerEnv({
      NODE_ENV: "test",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "senha-segura",
      AUTH_SECRET: "a".repeat(32),
      SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      DATA_DIR: "./data-test",
    });
    expect(env.DATA_DIR.endsWith("data-test")).toBe(true);
  });
});
