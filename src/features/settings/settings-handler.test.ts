import { describe, expect, it, vi } from "vitest";
import { makeSettingsHandlers } from "./settings-handler";

const publicSettings = {
  apiKeyConfigured: true,
  apiKeyMask: "••••7890",
  model: "claude-sonnet-5",
  veoTemplate: "{{copy_trecho}}",
  geminiTemplate: "{{produto}}",
  veoPovTemplate: "{{copy_trecho}}",
  geminiPovTemplate: "{{produto}}",
  updatedAt: new Date("2026-08-21T12:00:00.000Z"),
};

function makeService() {
  return {
    getPublic: vi.fn().mockResolvedValue(publicSettings),
    update: vi.fn().mockResolvedValue(publicSettings),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
  };
}

describe("settings handlers", () => {
  it("GET devolve apenas configuração pública", async () => {
    const service = makeService();
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });

    const response = await handlers.GET(new Request("http://local/api/settings"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ...publicSettings, updatedAt: "2026-08-21T12:00:00.000Z" });
    expect(JSON.stringify(payload)).not.toContain("ciphertext");
  });

  it("rejeita leitura sem sessão", async () => {
    const handlers = makeSettingsHandlers({ service: makeService(), requireSession: async () => { throw new Error("no session"); }, enforceSameOrigin: () => undefined });

    expect((await handlers.GET(new Request("http://local/api/settings"))).status).toBe(401);
  });

  it("bloqueia escrita de outra origem antes de alterar", async () => {
    const service = makeService();
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => { throw new Error("bad origin"); } });

    const response = await handlers.PUT(new Request("http://local/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-5", veoTemplate: "{{copy_trecho}}", geminiTemplate: "{{produto}}" }) }));

    expect(response.status).toBe(403);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("exige JSON para escrita", async () => {
    const handlers = makeSettingsHandlers({ service: makeService(), requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });

    expect((await handlers.PUT(new Request("http://local/api/settings", { method: "PUT", body: "{}" }))).status).toBe(415);
  });

  it("rejeita Content-Length declarado acima do limite antes de ler JSON", async () => {
    const service = makeService();
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });

    const response = await handlers.PUT(new Request("http://local/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", "content-length": "65537" },
      body: "{}",
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ message: "Solicitação muito grande" });
    expect(service.update).not.toHaveBeenCalled();
  });

  it("interrompe corpo em stream que ultrapassa o limite mesmo com Content-Length falso", async () => {
    const service = makeService();
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(65_537)));
        controller.close();
      },
    });
    const request = new Request("http://local/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", "content-length": "1" },
      body: stream,
      duplex: "half",
    } as RequestInit);

    const response = await handlers.PUT(request);

    expect(response.status).toBe(413);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("aceita um JSON válido próximo ao limite", async () => {
    const service = makeService();
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });
    const veoTemplate = "{{copy_trecho}}" + "a".repeat(15_000 - "{{copy_trecho}}".length);
    const geminiTemplate = "{{produto}}" + "b".repeat(15_000 - "{{produto}}".length);
    const veoPovTemplate = "{{copy_trecho}}" + "c".repeat(15_000 - "{{copy_trecho}}".length);
    const geminiPovTemplate = "{{produto}}" + "d".repeat(15_000 - "{{produto}}".length);

    const response = await handlers.PUT(new Request("http://local/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5", veoTemplate, geminiTemplate, veoPovTemplate, geminiPovTemplate }),
    }));

    expect(response.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith({ model: "claude-sonnet-5", veoTemplate, geminiTemplate, veoPovTemplate, geminiPovTemplate });
  });

  it("valida entrada de atualização sem substituir a chave quando ela está em branco", async () => {
    const service = makeService();
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });

    const response = await handlers.PUT(new Request("http://local/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: "", model: "claude-sonnet-5", veoTemplate: "{{copy_trecho}}", geminiTemplate: "{{produto}}", veoPovTemplate: "{{copy_trecho}}", geminiPovTemplate: "{{produto}}" }) }));

    expect(response.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith({ model: "claude-sonnet-5", veoTemplate: "{{copy_trecho}}", geminiTemplate: "{{produto}}", veoPovTemplate: "{{copy_trecho}}", geminiPovTemplate: "{{produto}}" });
  });

  it("retorna erro de validação sem detalhes internos", async () => {
    const handlers = makeSettingsHandlers({ service: makeService(), requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });

    const response = await handlers.PUT(new Request("http://local/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "", veoTemplate: "", geminiTemplate: "" }) }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ message: "Dados de configuração inválidos" });
  });

  it("remove a chave somente pela rota explícita", async () => {
    const service = makeService();
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });

    const response = await handlers.DELETE_API_KEY(new Request("http://local/api/settings/api-key", { method: "DELETE", headers: { origin: "http://local" } }));

    expect(response.status).toBe(204);
    expect(service.deleteApiKey).toHaveBeenCalledOnce();
  });

  it("não serializa detalhes de falha do serviço", async () => {
    const service = makeService();
    service.update.mockRejectedValue(new Error("sk-ant-secret must not leak"));
    const handlers = makeSettingsHandlers({ service, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });

    const response = await handlers.PUT(new Request("http://local/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-5", veoTemplate: "{{copy_trecho}}", geminiTemplate: "{{produto}}", veoPovTemplate: "{{copy_trecho}}", geminiPovTemplate: "{{produto}}" }) }));

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("sk-ant-secret");
  });
});
