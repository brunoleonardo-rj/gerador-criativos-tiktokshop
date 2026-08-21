import "server-only";
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
  try {
    assertKey(key);
    if (payload.version !== 1) throw new Error();
    const ciphertext = decodeCanonicalBase64(payload.ciphertext);
    const iv = decodeCanonicalBase64(payload.iv);
    const tag = decodeCanonicalBase64(payload.tag);
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Não foi possível descriptografar a credencial.");
  }
}

function decodeCanonicalBase64(value: string): Buffer {
  if (typeof value !== "string") throw new Error();
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) throw new Error();
  return decoded;
}
