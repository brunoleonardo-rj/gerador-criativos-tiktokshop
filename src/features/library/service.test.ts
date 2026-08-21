import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LibraryService, type LibraryRepository, type LibraryVersionRecord } from "./service";
import type { LibraryStorage } from "./storage";
import type { LibraryCorpus } from "./schema";
import { serializeCorpus } from "./serialize";

const corpus = (id: string): LibraryCorpus => ({ schemaVersion: 1, sourceSha256: createHash("sha256").update(id).digest("hex"), summary: { recordCount: 1, products: { Produto: 1 }, mechanisms: { Mecanismo: 1 }, statuses: { Aprovado: 1 } }, playbook: ["regra"], hashtagPatterns: ["#teste"], creatives: [{ numero: id, id, autor: "@a", produto: "Produto", duracao: "10", status: "Aprovado", confianca: "Alta", mecanismo: "Mecanismo", tipoHook: "Hook", hook: "h", corpo: "c", prova: null, objecao: null, oferta: null, tipoCta: "CTA", cta: "cta", descricao: null, hashtags: ["#teste"], formulaAdaptavel: null, risco: "", notas: "", url: null, arquivoFonte: null }] });

class MemoryStorage implements LibraryStorage {
  staged = new Map<string, { workbook: Buffer; corpus: LibraryCorpus }>();
  active = new Map<string, LibraryCorpus>();
  async writeStaged(input: { importId: string; workbook: Buffer; json: string }) { this.staged.set(input.importId, { workbook: input.workbook, corpus: JSON.parse(input.json) }); return { workbookPath: `staged/${input.importId}.xlsx`, jsonPath: `staged/${input.importId}.json` }; }
  async locate(id: string) { if (this.staged.has(id)) return { workbookPath: `staged/${id}.xlsx`, jsonPath: `staged/${id}.json` }; if (this.active.has(id)) return { workbookPath: `versions/${id}.xlsx`, jsonPath: `versions/${id}.json` }; throw new Error("missing"); }
  async promote(id: string) { if (this.active.has(id) && !this.staged.has(id)) return { workbookPath: `versions/${id}.xlsx`, jsonPath: `versions/${id}.json` }; const value = this.staged.get(id); if (!value) throw new Error("missing"); this.active.set(id, value.corpus); this.staged.delete(id); return { workbookPath: `versions/${id}.xlsx`, jsonPath: `versions/${id}.json` }; }
  async readJson(path: string) { const id = path.split("/").at(-1)!.replace(".json", ""); return this.active.get(id) ?? this.staged.get(id)!.corpus; }
  async verify(path: string, sha: string) { if (path.endsWith(".json")) return true; const id = path.split("/").at(-1)!.replace(".xlsx", ""); const value = this.active.get(id) ?? this.staged.get(id); return !!value && (this.staged.has(id) ? createHash("sha256").update(this.staged.get(id)!.workbook).digest("hex") === sha : true); }
  async sha256(path: string) { const id = path.split("/").at(-1)!.replace(".json", ""); const corpus = this.active.get(id) ?? this.staged.get(id)?.corpus; return createHash("sha256").update(serializeCorpus(corpus!)).digest("hex"); }
  failRemove = false;
  failRestore = false;
  async restoreStaged(id: string) { if (this.failRestore) throw new Error("restore"); const corpus = this.active.get(id); if (corpus) { this.staged.set(id, { workbook: Buffer.from(id), corpus }); this.active.delete(id); } }
  async remove() { if (this.failRemove) throw new Error("cleanup"); } async cleanupStaged() {}
}
class MemoryRepository implements LibraryRepository {
  active: LibraryVersionRecord | null = null; previous: LibraryVersionRecord | null = null; staged = new Map<string, LibraryVersionRecord>();
  failActivateOnce = false;
  async getStatus() { return { active: this.active, previous: this.previous, staged: [...this.staged.values()] }; }
  async createStaged(input: LibraryVersionRecord) { this.staged.set(input.id, input); return input; }
  async backfillJsonSha256(id: string, jsonSha256: string) { if (!this.active || this.active.id !== id) throw new Error("missing"); this.active = { ...this.active, jsonSha256 }; }
  async activate(id: string, promoted: { workbookPath: string; jsonPath: string }, now: Date) { if (this.failActivateOnce) { this.failActivateOnce = false; throw new Error("transaction"); } const staged = this.staged.get(id); if (!staged) throw new Error("missing"); const old = this.active; if (old) this.previous = { ...old, status: "PREVIOUS" }; this.active = { ...staged, ...promoted, status: "ACTIVE", activatedAt: now }; this.staged.delete(id); return { active: this.active, obsolete: [] }; }
  async rollback(now: Date): Promise<{ active: LibraryVersionRecord; previous: LibraryVersionRecord }> { if (!this.active || !this.previous) throw new Error("none"); const active: LibraryVersionRecord = { ...this.previous, status: "ACTIVE", activatedAt: now }; const previous: LibraryVersionRecord = { ...this.active, status: "PREVIOUS" }; this.active = active; this.previous = previous; return { active, previous }; }
}

describe("LibraryService", () => {
  it("does not alter the active version when parsing a workbook fails", async () => {
    const storage = new MemoryStorage(); const repo = new MemoryRepository(); const active = corpus("1"); const bytes = Buffer.from("active"); storage.active.set("active", active); repo.active = { id: "active", sourceFilename: "active.xlsx", sourceSha256: createHash("sha256").update(bytes).digest("hex"), jsonSha256: "a".repeat(64), recordCount: 1, workbookPath: "versions/active.xlsx", jsonPath: "versions/active.json", status: "ACTIVE", validationSummary: {}, createdAt: new Date(), activatedAt: new Date() };
    const service = new LibraryService(storage, repo, { parse: async () => { throw new Error("invalid"); } });
    await expect(service.stage({ filename: "bad.xlsx", bytes: Buffer.from("not xlsx") })).rejects.toThrow("invalid");
    expect((await service.getStatus()).active?.id).toBe("active");
  });
  it("backfills the missing JSON hash after validating a legacy active corpus", async () => {
    const storage = new MemoryStorage(); const repo = new MemoryRepository(); const bytes = Buffer.from("legacy"); const active = { ...corpus("legacy"), sourceSha256: createHash("sha256").update(bytes).digest("hex") }; storage.active.set("legacy", active); repo.active = { id: "legacy", sourceFilename: "legacy.xlsx", sourceSha256: active.sourceSha256, jsonSha256: null, recordCount: 1, workbookPath: "versions/legacy.xlsx", jsonPath: "versions/legacy.json", status: "ACTIVE", validationSummary: {}, createdAt: new Date(), activatedAt: new Date() };
    await expect(new LibraryService(storage, repo).getActiveSnapshot()).resolves.toMatchObject({ sourceSha256: active.sourceSha256 }); expect(repo.active.jsonSha256).toBe(createHash("sha256").update(serializeCorpus(active)).digest("hex"));
  });

  it("activates a staged version and rolls back to the previous version", async () => {
    const storage = new MemoryStorage(); const repo = new MemoryRepository(); const firstBytes = Buffer.from("first"); const first = { ...corpus("1"), sourceSha256: createHash("sha256").update(firstBytes).digest("hex") }; storage.active.set("first", first); repo.active = { id: "first", sourceFilename: "first.xlsx", sourceSha256: first.sourceSha256, jsonSha256: createHash("sha256").update(serializeCorpus(first)).digest("hex"), recordCount: 1, workbookPath: "versions/first.xlsx", jsonPath: "versions/first.json", status: "ACTIVE", validationSummary: {}, createdAt: new Date(), activatedAt: new Date() };
    const secondBytes = Buffer.from("second"); const second = { ...corpus("2"), sourceSha256: createHash("sha256").update(secondBytes).digest("hex") }; const service = new LibraryService(storage, repo, { parse: async () => second });
    const staged = await service.stage({ filename: "second.xlsx", bytes: secondBytes });
    await service.activate(staged.importId);
    expect((await service.getStatus()).active?.sourceSha256).toBe(second.sourceSha256);
    await service.rollback();
    expect((await service.getStatus()).active?.id).toBe("first");
  });

  it("keeps the committed active version readable when obsolete cleanup fails", async () => {
    const storage = new MemoryStorage(); const repo = new MemoryRepository(); const bytes = Buffer.from("second"); const parsed = { ...corpus("2"), sourceSha256: createHash("sha256").update(bytes).digest("hex") }; storage.failRemove = true; const service = new LibraryService(storage, repo, { parse: async () => parsed }); const staged = await service.stage({ filename: "second.xlsx", bytes });
    await expect(service.activate(staged.importId)).resolves.toMatchObject({ sourceSha256: parsed.sourceSha256 });
    await expect(service.getActiveSnapshot()).resolves.toMatchObject({ sourceSha256: parsed.sourceSha256 });
  });
  it("reconciles a promoted staged import after transaction and restore failures so retry works", async () => {
    const storage = new MemoryStorage(); const repo = new MemoryRepository(); const bytes = Buffer.from("third"); const parsed = { ...corpus("3"), sourceSha256: createHash("sha256").update(bytes).digest("hex") }; storage.failRestore = true; repo.failActivateOnce = true; const service = new LibraryService(storage, repo, { parse: async () => parsed }); const staged = await service.stage({ filename: "third.xlsx", bytes });
    await expect(service.activate(staged.importId)).rejects.toThrow("reconciliação");
    await expect(service.activate(staged.importId)).resolves.toMatchObject({ sourceSha256: parsed.sourceSha256 });
  });
});
