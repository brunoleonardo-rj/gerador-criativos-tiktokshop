import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { decryptSecret, encryptSecret } from "./crypto";

describe("secret encryption", () => {
  it("cifra com IV distinto e recupera o segredo", () => {
    const key = Buffer.alloc(32, 1);
    const first = encryptSecret("sk-ant-teste", key);
    const second = encryptSecret("sk-ant-teste", key);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(decryptSecret(first, key)).toBe("sk-ant-teste");
  });

  it("rejeita payload adulterado sem revelar o segredo", () => {
    const key = Buffer.alloc(32, 1);
    const encrypted = encryptSecret("sk-ant-teste", key);

    expect(() => decryptSecret({ ...encrypted, tag: Buffer.alloc(16).toString("base64") }, key)).toThrow(
      "Não foi possível descriptografar a credencial.",
    );
  });

  it.each([
    ["whitespace", (payload: ReturnType<typeof encryptSecret>) => ({ ...payload, iv: `${payload.iv}\n` })],
    ["invalid alphabet", (payload: ReturnType<typeof encryptSecret>) => ({ ...payload, ciphertext: `!${payload.ciphertext}` })],
    ["noncanonical encoding", (payload: ReturnType<typeof encryptSecret>) => ({ ...payload, ciphertext: "Zg" })],
    ["wrong IV size", (payload: ReturnType<typeof encryptSecret>) => ({ ...payload, iv: Buffer.alloc(11).toString("base64") })],
    ["wrong tag size", (payload: ReturnType<typeof encryptSecret>) => ({ ...payload, tag: Buffer.alloc(15).toString("base64") })],
  ])("rejeita Base64 %s sem revelar detalhes", (_, mutate) => {
    const key = Buffer.alloc(32, 1);
    const payload = mutate(encryptSecret("sk-ant-teste", key));

    expect(() => decryptSecret(payload, key)).toThrow("Não foi possível descriptografar a credencial.");
  });

  it("mantém a criptografia fora do bundle cliente", () => {
    expect(readFileSync(path.resolve(process.cwd(), "src/features/settings/crypto.ts"), "utf8")).toContain('import "server-only"');
  });
});
