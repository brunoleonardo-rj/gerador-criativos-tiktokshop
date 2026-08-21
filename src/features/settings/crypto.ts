import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedSecret = { ciphertext: string; iv: string; tag: string; version: 1 };

function assertKey(key: Buffer): void {
  if (key.length !== 32) throw new Error("A chave de criptografia deve ter 32 bytes.");
}

export function encryptSecret(plain: string, key: Buffer): EncryptedSecret {
  assertKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), version: 1 };
}

export function decryptSecret(payload: EncryptedSecret, key: Buffer): string {
  assertKey(key);
  if (payload.version !== 1) throw new Error("Não foi possível descriptografar a credencial.");

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Não foi possível descriptografar a credencial.");
  }
}
