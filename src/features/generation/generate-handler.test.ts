import { describe, expect, it, vi } from "vitest";
import { generationInputFixture } from "../../../tests/fixtures/creative-result";
import { MAX_BODY_BYTES, makeGenerateHandler } from "./generate-handler";

async function multipart(
  input: unknown,
  files: Array<{ role: string; mime: string; bytes: Uint8Array<ArrayBuffer> }>,
  fields: Array<{ name: string; value: string }> = [],
) {
  const boundary = "test-boundary"; const parts: BlobPart[] = [`--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(input)}\r\n`];
  for (const field of fields) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`);
  for (const file of files) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${file.role}"; filename="x"\r\nContent-Type: ${file.mime}\r\n\r\n`, file.bytes, "\r\n");
  parts.push(`--${boundary}--\r\n`); return new Request("http://local/api/generate", { method: "POST", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, body: await new Blob(parts).arrayBuffer() });
}
const response = { creatives: [], batchIssues: [], status: "valid", produtoNormalizado: "x", fatos: [], riscos: [], checklistPublicacao: [], settingsUpdatedAt: null };
const threeMiBJpeg = () => { const bytes = new Uint8Array(3 * 1024 * 1024); bytes.set([0xff, 0xd8, 0xff, 0xdb]); return bytes; };

describe("makeGenerateHandler", () => {
  it("não chama a Anthropic novamente para a mesma tentativa", async () => {
    const generate = vi.fn().mockResolvedValue(response);
    const handler = makeGenerateHandler({ service: { generate }, requireSession: async () => ({}), enforceSameOrigin: () => undefined });
    const requestId = "44444444-4444-4444-8444-444444444444";

    const first = await handler(await multipart(generationInputFixture(), [], [{ name: "requestId", value: requestId }]));
    const second = await handler(await multipart(generationInputFixture(), [], [{ name: "requestId", value: requestId }]));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
  });
  it("rejeita reutilização do identificador com outro briefing", async () => {
    const generate = vi.fn().mockResolvedValue(response);
    const handler = makeGenerateHandler({ service: { generate }, requireSession: async () => ({}), enforceSameOrigin: () => undefined });
    const requestId = "55555555-5555-4555-8555-555555555555";

    expect((await handler(await multipart(generationInputFixture(), [], [{ name: "requestId", value: requestId }]))).status).toBe(200);
    expect((await handler(await multipart(generationInputFixture({ nomeProduto: "Outro" }), [], [{ name: "requestId", value: requestId }]))).status).toBe(422);
    expect(generate).toHaveBeenCalledOnce();
  });
  it("permite até cinco minutos para a geração estruturada", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const generate = vi.fn().mockResolvedValue(response);
    const handler = makeGenerateHandler({ service: { generate }, requireSession: async () => ({}), enforceSameOrigin: () => undefined });

    try {
      expect((await handler(await multipart(generationInputFixture(), []))).status).toBe(200);
      expect(timeout).toHaveBeenCalledWith(300_000);
      expect(generate).toHaveBeenCalledWith(expect.anything(), signal);
    } finally {
      timeout.mockRestore();
    }
  });
  it("forwards only product images, dropping UGC and already-extracted ad screenshots", async () => {
    const generate = vi.fn().mockResolvedValue(response);
    const handler = makeGenerateHandler({ service: { generate }, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });
    const request = await multipart(generationInputFixture(), [
      { role: "ugc", mime: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xdb]) },
      { role: "ad", mime: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xdb]) },
      { role: "product", mime: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xdb]) },
    ]);
    const result = await handler(request);
    expect(result.status).toBe(200);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ images: [expect.objectContaining({ role: "product", mediaType: "image/jpeg" })] }), expect.any(AbortSignal));
  });
  it("rejects a mismatched image signature", async () => {
    const handler = makeGenerateHandler({ service: { generate: vi.fn() }, requireSession: async () => ({}), enforceSameOrigin: () => undefined });
    expect((await handler(await multipart(generationInputFixture(), [{ role: "product", mime: "image/jpeg", bytes: new TextEncoder().encode("not image") }]))).status).toBe(422);
  });
  it("rejects any non-file field other than payload", async () => {
    const handler = makeGenerateHandler({ service: { generate: vi.fn() }, requireSession: async () => ({}), enforceSameOrigin: () => undefined });
    expect((await handler(await multipart(generationInputFixture(), [], [{ name: "forbidden", value: "x" }]))).status).toBe(422);
  });
  it("accepts the contracted 18-file multipart body without Content-Length", async () => {
    const generate = vi.fn().mockResolvedValue(response);
    const handler = makeGenerateHandler({ service: { generate }, requireSession: async () => ({}), enforceSameOrigin: () => undefined });
    const files = [...Array.from({ length: 8 }, () => "product"), ...Array.from({ length: 5 }, () => "ad"), ...Array.from({ length: 5 }, () => "ugc")].map((role) => ({ role, mime: "image/jpeg", bytes: threeMiBJpeg() }));
    const request = await multipart(generationInputFixture(), files);
    expect(request.headers.has("content-length")).toBe(false);
    expect((await handler(request)).status).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
  }, 30_000);
  it("rejects chunked bodies over the finite total limit", async () => {
    let sent = 0; const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { if (sent > MAX_BODY_BYTES) controller.close(); else { controller.enqueue(chunk); sent += chunk.byteLength; } } });
    const request = new Request("http://local/api/generate", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: stream, duplex: "half" } as RequestInit);
    expect(request.headers.has("content-length")).toBe(false);
    expect((await makeGenerateHandler({ service: { generate: vi.fn() }, requireSession: async () => ({}), enforceSameOrigin: () => undefined })(request)).status).toBe(413);
  });
});
