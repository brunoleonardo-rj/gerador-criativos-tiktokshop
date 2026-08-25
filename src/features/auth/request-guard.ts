import "server-only";
import { getServerEnv } from "@/lib/env";
import { SESSION_COOKIE, type Session, verifySessionToken } from "./session";
import { hasTrustedProxyProof } from "./trusted-address";

function cookieValue(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim().split("=", 2))
    .find(([key]) => key === name)?.[1];
}

export async function requireSession(request: Request): Promise<Session> {
  const token = cookieValue(request, SESSION_COOKIE);
  const session = token ? await verifySessionToken(token, getServerEnv().AUTH_SECRET) : null;
  if (!session) throw new Response("Unauthorized", { status: 401 });
  return session;
}

export function enforceSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin && process.env.NODE_ENV === "test") return;

  const requestOrigin = new URL(request.url).origin;
  let expectedOrigin = requestOrigin;
  const proxyProof = request.headers.get("x-trusted-proxy-secret");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const host =
    request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim() ||
    request.headers.get("host")?.trim();

  if (
    proxyProof &&
    (protocol === "http" || protocol === "https") &&
    host &&
    hasTrustedProxyProof(request, getServerEnv().TRUSTED_PROXY_SECRET)
  ) {
    try {
      expectedOrigin = new URL(`${protocol}://${host}`).origin;
    } catch {
      expectedOrigin = requestOrigin;
    }
  }

  if (origin !== expectedOrigin) throw new Error("Origem da solicitação inválida");
}
