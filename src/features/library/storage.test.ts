import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileLibraryStorage } from "./storage";
describe("FileLibraryStorage", () => {
  it("stages through a private directory and promotes only its own import id", async () => { const dir = await mkdtemp(path.join(tmpdir(), "library-")); const storage = new FileLibraryStorage(dir); const id = "12345678-1234-4234-8234-123456789abc"; const staged = await storage.writeStaged({ importId: id, workbook: Buffer.from("xlsx"), json: "{}" }); expect(await readFile(staged.workbookPath, "utf8")).toBe("xlsx"); await expect(storage.promote("../escape")).rejects.toThrow("inválido"); const final = await storage.promote(id); expect(await storage.verify(final.workbookPath, "1c980b22bca31941462855e560db3053e7772efb4b8bc7c4d5d8bb799a1abc6c")).toBe(true); });
});
