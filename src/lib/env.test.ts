import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
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

  it("rejeita Base64 não canônico mesmo quando decodifica para 32 bytes", () => {
    const encodedKey = Buffer.alloc(32, 7).toString("base64");
    const nonCanonicalKey = `!${encodedKey}`;

    expect(() =>
      getServerEnv({
        NODE_ENV: "test",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "senha-segura",
        AUTH_SECRET: "a".repeat(32),
        SETTINGS_ENCRYPTION_KEY: nonCanonicalKey,
      }),
    ).toThrow(/32 bytes em base64/);
  });

  it("rejeita o exemplo de ambiente até que os segredos sejam substituídos", () => {
    const example = Object.fromEntries(
      readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=", 2)),
    );

    expect(() => getServerEnv(example)).toThrow();
  });
});
