import { describe, expect, it } from "vitest";
import { makeLibraryHandlers } from "./library-handler";
describe("library handlers", () => {
  it("rejects an unbounded oversized multipart request before parsing it", async () => { const handlers = makeLibraryHandlers({ service: {} as never, requireSession: async () => ({}), enforceSameOrigin: () => undefined }); const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(21 * 1024 * 1024)); controller.close(); } }); const response = await handlers.IMPORT(new Request("http://local/api/library/import", { method: "POST", headers: { origin: "http://local", "content-type": "multipart/form-data; boundary=a" }, body: stream, duplex: "half" } as unknown as RequestInit)); expect(response.status).toBe(413); });
  it("requires a session for library status", async () => { const handlers = makeLibraryHandlers({ service: {} as never, requireSession: async () => { throw new Error("none"); }, enforceSameOrigin: () => undefined }); expect((await handlers.STATUS(new Request("http://local/api/library/status"))).status).toBe(401); });
});
