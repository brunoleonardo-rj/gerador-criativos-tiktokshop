import "server-only";
import { getServerEnv } from "@/lib/env";
import { SESSION_COOKIE, type Session, verifySessionToken } from "./session";

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
  if (origin !== new URL(request.url).origin) throw new Error("Origem da solicitação inválida");
}
