// @vitest-environment node
import { describe, expect, it } from "vitest";
import { makeLoginHandler } from "./login-handler";
import { LoginRateLimiter } from "./rate-limit";

describe("makeLoginHandler", () => {
  const expected = { username: "admin", password: "senha-correta" };
  const secret = "x".repeat(32);
  const request = (body: unknown, headers: HeadersInit = {}) =>
    new Request("http://local/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://local", ...headers },
      body: JSON.stringify(body),
    });

  it("emite cookie HttpOnly sem expor motivo de falha", async () => {
    const handler = makeLoginHandler({
      expected,
      secret,
      limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }),
      now: () => new Date("2026-08-21T12:00:00Z"),
    });
    const response = await handler(request(expected));

    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
    expect(response.status).toBe(204);
  });

  it("retorna a mesma mensagem para credencial inválida e bloqueio", async () => {
    const limiter = new LoginRateLimiter({ maxAttempts: 1, windowMs: 900_000 });
    const handler = makeLoginHandler({ expected, secret, limiter, now: () => new Date() });
    const first = await handler(request({ username: "admin", password: "errada" }, { "x-forwarded-for": "127.0.0.1" }));
    const second = await handler(request(expected, { "x-forwarded-for": "127.0.0.1" }));

    expect(await first.json()).toEqual({ message: "Credenciais inválidas ou acesso temporariamente bloqueado" });
    expect(await second.json()).toEqual({ message: "Credenciais inválidas ou acesso temporariamente bloqueado" });
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
  });

  it("rejeita origem cruzada", async () => {
    const handler = makeLoginHandler({ expected, secret, limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }), now: () => new Date() });

    await expect(handler(request(expected, { origin: "https://evil.example" }))).resolves.toMatchObject({ status: 403 });
  });
});
