import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileLibraryStorage } from "./storage";
describe("FileLibraryStorage", () => {
  it("stages through a private directory and promotes only its own import id", async () => { const dir = await mkdtemp(path.join(tmpdir(), "library-")); const storage = new FileLibraryStorage(dir); const id = "12345678-1234-4234-8234-123456789abc"; const staged = await storage.writeStaged({ importId: id, workbook: Buffer.from("xlsx"), json: "{}" }); expect(await readFile(staged.workbookPath, "utf8")).toBe("xlsx"); await expect(storage.promote("../escape")).rejects.toThrow("inválido"); const final = await storage.promote(id); expect(await storage.verify(final.workbookPath, "1c980b22bca31941462855e560db3053e7772efb4b8bc7c4d5d8bb799a1abc6c")).toBe(true); });

  async function replaceWithLink(target: string, outside: string) {
    await (await import("node:fs/promises")).rm(target, { recursive: true, force: true });
    try { await symlink(outside, target, process.platform === "win32" ? "junction" : "dir"); }
    catch (error: unknown) { const code = (error as NodeJS.ErrnoException).code; if (["EPERM", "EOPNOTSUPP", "ENOSYS", "EINVAL"].includes(code ?? "")) return false; throw error; }
    return true;
  }

  it("revalidates swapped container directories before write, promote, restore, and cleanup", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "library-link-")); const outside = await mkdtemp(path.join(tmpdir(), "library-outside-")); const sentinel = path.join(outside, "sentinel"); await writeFile(sentinel, "safe");
    const id = "12345678-1234-4234-8234-123456789abc"; const storage = new FileLibraryStorage(dir); await storage.writeStaged({ importId: id, workbook: Buffer.from("xlsx"), json: "{}" });
    if (!await replaceWithLink(path.join(dir, "library", "staged"), outside)) return;
    await expect(storage.writeStaged({ importId: "22345678-1234-4234-8234-123456789abc", workbook: Buffer.from("xlsx"), json: "{}" })).rejects.toThrow();
    await expect(storage.promote(id)).rejects.toThrow(); await expect(storage.cleanupStaged(new Date())).rejects.toThrow(); expect(await readFile(sentinel, "utf8")).toBe("safe");
  });

  it("revalidates a swapped versions container before restore", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "library-link-")); const outside = await mkdtemp(path.join(tmpdir(), "library-outside-")); const sentinel = path.join(outside, "sentinel"); await writeFile(sentinel, "safe");
    const id = "12345678-1234-4234-8234-123456789abc"; const storage = new FileLibraryStorage(dir); await storage.writeStaged({ importId: id, workbook: Buffer.from("xlsx"), json: "{}" }); await storage.promote(id);
    if (!await replaceWithLink(path.join(dir, "library", "versions"), outside)) return;
    await expect(storage.restoreStaged(id)).rejects.toThrow(); expect(await readFile(sentinel, "utf8")).toBe("safe");
  });

  it("rejects symlinked UUID cleanup entries and non-directory staging parents", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "library-cleanup-")); const outside = await mkdtemp(path.join(tmpdir(), "library-outside-")); const storage = new FileLibraryStorage(dir); const id = "12345678-1234-4234-8234-123456789abc";
    await storage.writeStaged({ importId: id, workbook: Buffer.from("xlsx"), json: "{}" }); await (await import("node:fs/promises")).rm(path.join(dir, "library", "staged", id), { recursive: true, force: true });
    if (await replaceWithLink(path.join(dir, "library", "staged", id), outside)) await expect(storage.cleanupStaged(new Date())).rejects.toThrow();
    const staging = path.join(dir, "library", "staged"); await (await import("node:fs/promises")).rm(staging, { recursive: true, force: true }); await writeFile(staging, "not a directory");
    await expect(storage.cleanupStaged(new Date())).rejects.toThrow();
  });
});
