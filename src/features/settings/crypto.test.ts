import { describe, expect, it } from "vitest";
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
});
