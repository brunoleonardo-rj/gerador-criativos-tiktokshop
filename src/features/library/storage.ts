import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { LibraryCorpus } from "./schema";

export interface LibraryStorage {
  writeStaged(input: { importId: string; workbook: Buffer; json: string }): Promise<{ workbookPath: string; jsonPath: string }>;
  promote(importId: string): Promise<{ workbookPath: string; jsonPath: string }>;
  restoreStaged?(importId: string): Promise<void>;
  readJson(filePath: string): Promise<LibraryCorpus>;
  verify(filePath: string, sha256: string): Promise<boolean>;
  remove(paths: string[]): Promise<void>;
  cleanupStaged(olderThan: Date): Promise<void>;
}

const idPattern = /^[a-zA-Z0-9_-]{8,128}$/;
function assertId(id: string) { if (!idPattern.test(id)) throw new Error("Identificador de importação inválido"); }
function safeName(name: string) { const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_"); return base.endsWith(".xlsx") ? base : "biblioteca.xlsx"; }

export class FileLibraryStorage implements LibraryStorage {
  private readonly root: string; private readonly staging: string; private readonly versions: string;
  constructor(dataDir: string) { this.root = path.resolve(dataDir, "library"); this.staging = path.join(this.root, "staged"); this.versions = path.join(this.root, "versions"); }
  private contain(target: string) { const resolved = path.resolve(target); if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error("Caminho de biblioteca inválido"); return resolved; }
  private stagedPaths(id: string) { assertId(id); const dir = path.join(this.staging, id); return { dir, workbookPath: path.join(dir, "source.xlsx"), jsonPath: path.join(dir, "corpus.json") }; }
  async writeStaged(input: { importId: string; workbook: Buffer; json: string }) {
    const paths = this.stagedPaths(input.importId); await mkdir(paths.dir, { recursive: true });
    const temp = `${paths.dir}.tmp-${process.pid}-${Date.now()}`; await mkdir(temp, { recursive: true });
    try { await writeFile(path.join(temp, "source.xlsx"), input.workbook, { flag: "wx" }); await writeFile(path.join(temp, "corpus.json"), input.json, { flag: "wx" }); await rm(paths.dir, { recursive: true, force: true }); await rename(temp, paths.dir); return { workbookPath: paths.workbookPath, jsonPath: paths.jsonPath }; } catch (error) { await rm(temp, { recursive: true, force: true }); throw error; }
  }
  async promote(importId: string) { const staged = this.stagedPaths(importId); const finalDir = path.join(this.versions, importId); this.contain(finalDir); await mkdir(this.versions, { recursive: true }); await stat(staged.workbookPath); await stat(staged.jsonPath); await rm(finalDir, { recursive: true, force: true }); await rename(staged.dir, finalDir); return { workbookPath: path.join(finalDir, "source.xlsx"), jsonPath: path.join(finalDir, "corpus.json") }; }
  async restoreStaged(importId: string) { const staged = this.stagedPaths(importId); const finalDir = path.join(this.versions, importId); try { await mkdir(this.staging, { recursive: true }); await rm(staged.dir, { recursive: true, force: true }); await rename(finalDir, staged.dir); } catch { /* A falha de restauração não pode alterar metadata ativa. */ } }
  async readJson(filePath: string) { return JSON.parse(await readFile(this.contain(filePath), "utf8")) as LibraryCorpus; }
  async verify(filePath: string, sha256: string) { try { const actual = createHash("sha256").update(await readFile(this.contain(filePath))).digest("hex"); return actual === sha256; } catch { return false; } }
  async remove(paths: string[]) { await Promise.all(paths.map(async (filePath) => { const safe = this.contain(filePath); await rm(path.dirname(safe), { recursive: true, force: true }); })); }
  async cleanupStaged(olderThan: Date) { try { for (const entry of await readdir(this.staging, { withFileTypes: true })) { if (!entry.isDirectory() || !idPattern.test(entry.name)) continue; const target = path.join(this.staging, entry.name); if ((await stat(target)).mtime < olderThan) await rm(target, { recursive: true, force: true }); } } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
  static safeFilename(name: string) { return safeName(name); }
}
