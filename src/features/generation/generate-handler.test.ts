import { describe, expect, it, vi } from "vitest";
import { generationInputFixture } from "../../../tests/fixtures/creative-result";
import { makeGenerateHandler } from "./generate-handler";

async function multipart(input: unknown, files: Array<{ role: string; mime: string; bytes: Uint8Array<ArrayBuffer> }>) {
  const boundary = "test-boundary"; const parts: BlobPart[] = [`--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(input)}\r\n`];
  for (const file of files) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${file.role}"; filename="x"\r\nContent-Type: ${file.mime}\r\n\r\n`, file.bytes, "\r\n");
  parts.push(`--${boundary}--\r\n`); return new Request("http://local/api/generate", { method: "POST", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, body: await new Blob(parts).arrayBuffer() });
}
const response = { creatives: [], batchIssues: [], status: "valid", produtoNormalizado: "x", fatos: [], riscos: [], checklistPublicacao: [], settingsUpdatedAt: null };

describe("makeGenerateHandler", () => {
  it("ignores UGC while forwarding only product and ad images", async () => {
    const generate = vi.fn().mockResolvedValue(response);
    const handler = makeGenerateHandler({ service: { generate }, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });
    const request = await multipart(generationInputFixture(), [{ role: "ugc", mime: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xdb]) }, { role: "product", mime: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xdb]) }]);
    const result = await handler(request);
    expect(result.status).toBe(200);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ images: [expect.objectContaining({ role: "product", mediaType: "image/jpeg" })] }), expect.any(AbortSignal));
  });
  it("rejects a mismatched image signature and forbidden field", async () => {
    const handler = makeGenerateHandler({ service: { generate: vi.fn() }, requireSession: async () => ({}), enforceSameOrigin: () => undefined });
    expect((await handler(await multipart(generationInputFixture(), [{ role: "product", mime: "image/jpeg", bytes: new TextEncoder().encode("not image") }]))).status).toBe(422);
  });
});
