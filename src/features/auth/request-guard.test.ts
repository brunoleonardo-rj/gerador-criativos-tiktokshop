// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { enforceSameOrigin, requireSession } from "./request-guard";
import { createSessionToken, SESSION_COOKIE } from "./session";

describe("request guards", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "senha-segura",
      AUTH_SECRET: "s".repeat(32),
      TRUSTED_PROXY_SECRET: "p".repeat(32),
      SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    };
  });

  it("exige uma sessão válida", async () => {
    await expect(requireSession(new Request("http://local/api/test"))).rejects.toMatchObject({ status: 401 });
  });

  it("lê a sessão do cookie", async () => {
    const token = await createSessionToken({ username: "admin" }, process.env.AUTH_SECRET!);
    const request = new Request("http://local/api/test", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });

    await expect(requireSession(request)).resolves.toMatchObject({ username: "admin" });
  });

  it("rejeita Origin cruzada", () => {
    const request = new Request("http://local/api/test", { method: "POST", headers: { origin: "https://evil.example" } });

    expect(() => enforceSameOrigin(request)).toThrow(/origem/i);
  });

  it("aceita Origin da própria aplicação", () => {
    const request = new Request("http://local/api/test", { method: "POST", headers: { origin: "http://local" } });

    expect(() => enforceSameOrigin(request)).not.toThrow();
  });

  it("aceita a origem HTTPS encaminhada por um proxy confiável", () => {
    const request = new Request("http://127.0.0.1:3000/api/test", {
      method: "POST",
      headers: {
        host: "studio.example.com",
        origin: "https://studio.example.com",
        "x-forwarded-proto": "https",
        "x-trusted-proxy-secret": "p".repeat(32),
      },
    });

    expect(() => enforceSameOrigin(request)).not.toThrow();
  });

  it("ignora cabeçalhos encaminhados quando a prova do proxy é inválida", () => {
    const request = new Request("http://127.0.0.1:3000/api/test", {
      method: "POST",
      headers: {
        host: "studio.example.com",
        origin: "https://studio.example.com",
        "x-forwarded-proto": "https",
        "x-trusted-proxy-secret": "invalida",
      },
    });

    expect(() => enforceSameOrigin(request)).toThrow(/origem/i);
  });
});
