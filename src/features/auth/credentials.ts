import { createHash, timingSafeEqual } from "node:crypto";

export type AdminCredentials = { username: string; password: string };

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

export async function authenticateAdmin(provided: AdminCredentials, expected: AdminCredentials): Promise<boolean> {
  const usernameMatches = timingSafeEqual(hash(provided.username), hash(expected.username));
  const passwordMatches = timingSafeEqual(hash(provided.password), hash(expected.password));
  return usernameMatches && passwordMatches;
}
