import { openDB, type DBSchema } from "idb";
import type { GenerationEnvelope } from "@/features/generation/validation";
import { draftSchema, type Draft } from "./schema";

export const DRAFT_STORAGE_KEY = "creative-generator:draft:v1";
const DATABASE_NAME = "creative-generator";

export type ImageRole = "ugc" | "product" | "ad";
export type StoredImage = { id: string; role: ImageRole; blob: Blob; name: string; type: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number; size: number };
export type StoredResult = GenerationEnvelope & { id: string };

interface CreativeDatabase extends DBSchema {
  images: { key: string; value: StoredImage };
  results: { key: string; value: StoredResult };
}

function canUseLocalStorage(): boolean {
  try { return typeof window !== "undefined" && Boolean(window.localStorage); } catch { return false; }
}

export const draftStorage = {
  save(draft: Draft): boolean {
    try {
      const valid = draftSchema.parse(draft);
      if (!canUseLocalStorage()) return false;
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: 1, draft: valid }));
      return true;
    } catch { return false; }
  },
  load(): Draft | null {
    try {
      if (!canUseLocalStorage()) return null;
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== 1) return null;
      return draftSchema.safeParse((parsed as { draft?: unknown }).draft).data ?? null;
    } catch { return null; }
  },
  clear(): boolean {
    try {
      if (!canUseLocalStorage()) return false;
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return true;
    } catch { return false; }
  },
};

let databasePromise: ReturnType<typeof openDB<CreativeDatabase>> | undefined;
function database() {
  databasePromise ??= openDB<CreativeDatabase>(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });
      if (!db.objectStoreNames.contains("results")) db.createObjectStore("results", { keyPath: "id" });
    },
  });
  return databasePromise;
}

export const assetStorage = {
  async putImage(image: StoredImage): Promise<void> { const db = await database(); await db.put("images", image); },
  async listImages(): Promise<StoredImage[]> { const db = await database(); return (await db.getAll("images")).sort((a, b) => a.id.localeCompare(b.id)); },
  async deleteImage(id: string): Promise<void> { const db = await database(); await db.delete("images", id); },
  async clearImages(): Promise<void> { const db = await database(); await db.clear("images"); },
  async putResult(result: StoredResult): Promise<void> { const db = await database(); await db.put("results", result); },
  async getResult(id: string): Promise<StoredResult | undefined> { const db = await database(); return db.get("results", id); },
  async clearResults(): Promise<void> { const db = await database(); await db.clear("results"); },
};
