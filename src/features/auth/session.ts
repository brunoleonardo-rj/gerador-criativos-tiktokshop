import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "creative_session";
export const SESSION_DURATION_SECONDS = 12 * 60 * 60;

export type Session = { username: string };
// A expiração acompanha a sessão para o proxy decidir quando renovar o cookie.
export type VerifiedSession = Session & { expiresAt: number };

// Renova quando resta menos de metade da vida, para não reassinar a cada requisição.
export const SESSION_REFRESH_THRESHOLD_SECONDS = SESSION_DURATION_SECONDS / 2;

export function sessionCookieValue(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

function secretKey(secret: string) {
  return Uint8Array.from(Buffer.from(secret, "utf8"));
}

export async function createSessionToken(
  input: { username: string; now?: Date },
  secret: string,
): Promise<string> {
  const now = input.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1_000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.username)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_DURATION_SECONDS)
    .sign(secretKey(secret));
}

export async function verifySessionToken(token: string, secret: string, now = new Date()): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0 || typeof payload.exp !== "number") return null;
    return { username: payload.sub, expiresAt: payload.exp };
  } catch {
    return null;
  }
}
