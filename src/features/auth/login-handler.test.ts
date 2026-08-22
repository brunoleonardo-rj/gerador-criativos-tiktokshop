// @vitest-environment node
import { describe, expect, it } from "vitest";
import { makeLoginHandler } from "./login-handler";
import { LoginRateLimiter } from "./rate-limit";
import { createTrustedAddressResolver } from "./trusted-address";

describe("makeLoginHandler", () => {
  const expected = { username: "admin", password: "senha-correta" };
  const secret = "x".repeat(32);
  const request = (body: unknown, headers: HeadersInit = {}) =>
    new Request("http://local/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://local", ...headers },
      body: JSON.stringify(body),
    });
  const globalLimiter = () => new LoginRateLimiter({ maxAttempts: 20, windowMs: 900_000, maxBuckets: 1 });

  it("emite cookie HttpOnly sem expor motivo de falha", async () => {
    const handler = makeLoginHandler({
      expected,
      secret,
      limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }),
      globalLimiter: globalLimiter(),
      now: () => new Date("2026-08-21T12:00:00Z"),
    });
    const response = await handler(request(expected));

    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Strict/);
    expect(response.status).toBe(204);
  });

  it("retorna a mesma mensagem para credencial inválida e bloqueio", async () => {
    const limiter = new LoginRateLimiter({ maxAttempts: 1, windowMs: 900_000 });
    const handler = makeLoginHandler({ expected, secret, limiter, globalLimiter: globalLimiter(), now: () => new Date() });
    const first = await handler(request({ username: "admin", password: "errada" }, { "x-forwarded-for": "127.0.0.1" }));
    const second = await handler(request(expected, { "x-forwarded-for": "127.0.0.1" }));

    expect(await first.json()).toEqual({ message: "Credenciais inválidas ou acesso temporariamente bloqueado" });
    expect(await second.json()).toEqual({ message: "Credenciais inválidas ou acesso temporariamente bloqueado" });
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
  });

  it("rejeita origem cruzada", async () => {
    const handler = makeLoginHandler({ expected, secret, limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }), globalLimiter: globalLimiter(), now: () => new Date() });

    await expect(handler(request(expected, { origin: "https://evil.example" }))).resolves.toMatchObject({ status: 403 });
  });

  it("rejeita Content-Type ausente ou incompatível com a mesma mensagem pública", async () => {
    const handler = makeLoginHandler({ expected, secret, limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }), globalLimiter: globalLimiter(), now: () => new Date() });
    const missing = new Request("http://local/api/auth/login", { method: "POST", headers: { origin: "http://local" }, body: JSON.stringify(expected) });
    const unsupported = request(expected, { "content-type": "text/plain" });

    for (const response of [await handler(missing), await handler(unsupported)]) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ message: "Credenciais inválidas ou acesso temporariamente bloqueado" });
    }
  });

  it("aceita application/json com charset", async () => {
    const handler = makeLoginHandler({ expected, secret, limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }), globalLimiter: globalLimiter(), now: () => new Date() });

    await expect(handler(request(expected, { "content-type": "application/json; charset=utf-8" }))).resolves.toMatchObject({ status: 204 });
  });

  it("rejeita Content-Length acima do limite sem consumir o stream", async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>({
      pull() {
        pulled = true;
        throw new Error("o corpo não deveria ser lido");
      },
    });
    const handler = makeLoginHandler({ expected, secret, limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }), globalLimiter: globalLimiter() });
    const response = await handler(new Request("http://local/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "20000", origin: "http://local" },
      body,
      duplex: "half",
    } as unknown as RequestInit));

    expect(response.status).toBe(413);
    expect(pulled).toBe(false);
  });

  it("interrompe um stream acima do limite mesmo sem Content-Length e contabiliza a falha", async () => {
    const limiter = new LoginRateLimiter({ maxAttempts: 1, windowMs: 900_000 });
    const handler = makeLoginHandler({ expected, secret, limiter, globalLimiter: globalLimiter() });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(12_000));
        controller.enqueue(new Uint8Array(5_000));
        controller.close();
      },
    });
    const oversized = await handler(new Request("http://local/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://local" },
      body,
      duplex: "half",
    } as unknown as RequestInit));
    const nextAttempt = await handler(request(expected));

    expect(oversized.status).toBe(413);
    expect(nextAttempt.status).toBe(401);
  });

  it("mantém o bloqueio global quando endereços confiáveis são rotacionados", async () => {
    const handler = makeLoginHandler({
      expected,
      secret,
      limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }),
      globalLimiter: new LoginRateLimiter({ maxAttempts: 1, windowMs: 900_000 }),
      resolveAddress: (incoming) => incoming.headers.get("x-trusted-client-ip") ?? "proxy-unidentified",
    });
    const first = await handler(request({ username: "admin", password: "errada" }, { "x-trusted-client-ip": "192.0.2.1", "x-forwarded-for": "spoof-a" }));
    const rotated = await handler(request(expected, { "x-trusted-client-ip": "192.0.2.2", "x-forwarded-for": "spoof-b" }));

    expect(first.status).toBe(401);
    expect(rotated.status).toBe(401);
  });

  it("ignora X-Forwarded-For quando resolve o endereço padrão", async () => {
    const handler = makeLoginHandler({
      expected,
      secret,
      limiter: new LoginRateLimiter({ maxAttempts: 1, windowMs: 900_000 }),
      globalLimiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }),
    });
    await handler(request({ username: "admin", password: "errada" }, { "x-forwarded-for": "spoof-a" }));
    const rotated = await handler(request(expected, { "x-forwarded-for": "spoof-b" }));

    expect(rotated.status).toBe(401);
  });

  it("não permite rotação de IP sem prova válida de proxy", async () => {
    const handler = makeLoginHandler({
      expected,
      secret,
      limiter: new LoginRateLimiter({ maxAttempts: 1, windowMs: 900_000 }),
      globalLimiter: globalLimiter(),
      resolveAddress: createTrustedAddressResolver("p".repeat(32)),
    });
    await handler(request({ username: "admin", password: "errada" }, { "x-trusted-client-ip": "192.0.2.1" }));
    const rotated = await handler(request(expected, { "x-trusted-client-ip": "192.0.2.2", "x-trusted-proxy-secret": "errada" }));

    expect(rotated.status).toBe(401);
  });

  it("separa buckets para endereços autenticados pelo proxy", async () => {
    const handler = makeLoginHandler({
      expected,
      secret,
      limiter: new LoginRateLimiter({ maxAttempts: 1, windowMs: 900_000 }),
      globalLimiter: globalLimiter(),
      resolveAddress: createTrustedAddressResolver("p".repeat(32)),
    });
    await handler(request({ username: "admin", password: "errada" }, { "x-trusted-client-ip": "192.0.2.1", "x-trusted-proxy-secret": "p".repeat(32) }));
    const distinct = await handler(request(expected, { "x-trusted-client-ip": "192.0.2.2", "x-trusted-proxy-secret": "p".repeat(32) }));

    expect(distinct.status).toBe(204);
  });
});
