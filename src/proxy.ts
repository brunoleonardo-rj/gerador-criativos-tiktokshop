import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  verifySessionToken,
} from "@/features/auth/session";

// Sessão deslizante: quem continua usando o app nunca é deslogado no meio do
// trabalho. O prazo de 12h passa a valer como inatividade, não como tempo de vida.
async function withRefreshedSession(
  response: NextResponse,
  session: { username: string; expiresAt: number },
  secret: string,
  now: Date,
): Promise<NextResponse> {
  const remaining = session.expiresAt - Math.floor(now.getTime() / 1_000);
  if (remaining > SESSION_REFRESH_THRESHOLD_SECONDS) return response;

  response.cookies.set({
    name: SESSION_COOKIE,
    value: await createSessionToken({ username: session.username, now }, secret),
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  const session = token && secret ? await verifySessionToken(token, secret) : null;

  if (session && secret) return withRefreshedSession(NextResponse.next(), session, secret, new Date());

  // Rotas de API respondem o próprio 401 com um código legível; redirecioná-las
  // devolveria HTML de login onde o cliente espera JSON.
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/resultado/:path*", "/configuracoes/:path*", "/api/:path*"],
};
