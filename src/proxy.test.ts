// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/features/auth/session";
import { proxy } from "./proxy";

const secret = "s".repeat(32);

function requestWith(path: string, token?: string) {
  const request = new NextRequest(`http://local${path}`);
  if (token) request.cookies.set(SESSION_COOKIE, token);
  return request;
}

function refreshedCookie(response: Awaited<ReturnType<typeof proxy>>) {
  return response.cookies.get(SESSION_COOKIE)?.value;
}

describe("proxy", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = secret;
  });

  it("renova o cookie quando resta menos de metade da sessão", async () => {
    const issuedAt = new Date(Date.now() - (SESSION_DURATION_SECONDS / 2 + 60) * 1_000);
    const token = await createSessionToken({ username: "admin", now: issuedAt }, secret);

    const response = await proxy(requestWith("/", token));

    expect(refreshedCookie(response)).toBeDefined();
    expect(refreshedCookie(response)).not.toBe(token);
  });

  it("não reassina uma sessão recém-emitida", async () => {
    const token = await createSessionToken({ username: "admin" }, secret);

    expect(refreshedCookie(await proxy(requestWith("/", token)))).toBeUndefined();
  });

  it("mantém a sessão viva enquanto o uso continua", async () => {
    // Duas renovações seguidas ultrapassam a vida original do primeiro token.
    let token = await createSessionToken(
      { username: "admin", now: new Date(Date.now() - (SESSION_DURATION_SECONDS - 60) * 1_000) },
      secret,
    );
    for (let i = 0; i < 2; i += 1) {
      token = refreshedCookie(await proxy(requestWith("/", token))) ?? token;
    }

    const response = await proxy(requestWith("/", token));
    expect(response.status).not.toBe(307);
  });

  it("deixa a API responder o próprio 401 em vez de redirecionar para o login", async () => {
    const response = await proxy(requestWith("/api/generate"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redireciona páginas sem sessão para o login preservando o destino", async () => {
    const response = await proxy(requestWith("/configuracoes"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Fconfiguracoes");
  });
});
