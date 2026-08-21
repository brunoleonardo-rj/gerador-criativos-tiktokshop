import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FileLibraryStorage } from "./storage";
import { PrismaLibraryRepository } from "./repository";
import { LibraryService } from "./service";
import { getServerEnv } from "@/lib/env";
let initialSeed: Promise<void> | null = null;
export async function getLibraryService() { const env = getServerEnv(); const { db } = await import("@/lib/db"); const service = new LibraryService(new FileLibraryStorage(env.DATA_DIR), new PrismaLibraryRepository(db)); const original = service.getStatus.bind(service); service.getStatus = async () => { if (!(await original()).active) { initialSeed ??= (async () => { if ((await original()).active) return; const workbook = await readFile(path.resolve(process.cwd(), "resources/library/Biblioteca_Mestra_Copys_TikTok_Shop.xlsx")); const staged = await service.stage({ filename: "Biblioteca_Mestra_Copys_TikTok_Shop.xlsx", bytes: workbook }); await service.activate(staged.importId); })(); await initialSeed; } return original(); }; return service; }
