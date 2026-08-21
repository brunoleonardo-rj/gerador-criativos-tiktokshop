import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "creative_session";
export const SESSION_DURATION_SECONDS = 12 * 60 * 60;

export type Session = { username: string };

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

export async function verifySessionToken(token: string, secret: string, now = new Date()): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    return typeof payload.sub === "string" && payload.sub.length > 0 ? { username: payload.sub } : null;
  } catch {
    return null;
  }
}
