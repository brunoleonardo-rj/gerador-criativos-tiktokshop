import { openDB, type DBSchema } from "idb";
import { z } from "zod";
import type { GenerationEnvelope } from "@/features/generation/validation";
import { creativeBatchSchema, creativeSchema } from "@/features/generation/schema";
import { draftSchema, type Draft } from "./schema";

export const DRAFT_STORAGE_KEY = "creative-generator:draft:v1";
const DATABASE_NAME = "creative-generator";

export type ImageRole = "ugc" | "product" | "ad";
export type StoredImage = { id: string; role: ImageRole; blob: Blob; name: string; type: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number; size: number; order?: number };
export type StoredResult = GenerationEnvelope & { id: string; createdAt?: string };

const blobSchema = z.custom<Blob>((value) => value instanceof Blob || Boolean(value && typeof value === "object" && "size" in value && "type" in value), "Blob esperado");
const imageSchema = z.object({ id: z.string().uuid(), role: z.enum(["ugc", "product", "ad"]), blob: blobSchema, name: z.string().min(1).max(500), type: z.enum(["image/jpeg", "image/png", "image/webp"]), width: z.number().int().positive().max(32_768), height: z.number().int().positive().max(32_768), size: z.number().int().nonnegative(), order: z.number().int().nonnegative().optional() }).strict();
const storedImageSchema = imageSchema.extend({ blob: z.unknown() });
const issueSchema = z.object({ code: z.string(), severity: z.enum(["warning", "block"]), field: z.string(), message: z.string() }).strict();
const veoPromptsSchema = z.object({ trecho1: z.string().nullable(), trecho2: z.string().nullable(), trecho3: z.string().nullable() }).strict();
const envelopeCreativeSchema = creativeSchema.extend({ promptGemini: z.string().nullable(), veoPrompts: veoPromptsSchema, actualCounts: z.object({ trecho1: z.number().int().nonnegative(), trecho2: z.number().int().nonnegative(), trecho3: z.number().int().nonnegative().nullable(), pov: z.number().int().nonnegative() }).strict(), issues: z.array(issueSchema), status: z.enum(["valid", "needs_review", "blocked"]) }).strict();
const resultSchema = creativeBatchSchema.omit({ creatives: true }).extend({ id: z.string().uuid(), creatives: z.array(envelopeCreativeSchema).min(1).max(8), batchIssues: z.array(issueSchema), status: z.enum(["valid", "needs_review", "blocked"]), settingsUpdatedAt: z.string().datetime().nullable(), createdAt: z.string().datetime().optional() }).strict();

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
  databasePromise ??= openDB<CreativeDatabase>(DATABASE_NAME, 2, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });
      if (!db.objectStoreNames.contains("results")) db.createObjectStore("results", { keyPath: "id" });
      if (oldVersion < 2 && db.objectStoreNames.contains("images")) {
        const store = transaction.objectStore("images"); let order = 0;
        store.openCursor().then(function assignOrder(cursor): Promise<void> | void {
          if (!cursor) return;
          const value = cursor.value as StoredImage;
          if (typeof value.order !== "number") cursor.update({ ...value, order: order });
          order += 1;
          return cursor.continue().then(assignOrder);
        });
      }
    },
  });
  return databasePromise;
}

export const assetStorage = {
  async putImage(image: StoredImage): Promise<void> {
    const db = await database(); const transaction = db.transaction("images", "readwrite");
    const images = await transaction.store.getAll();
    const valid = imageSchema.parse(image);
    await transaction.store.put({ ...valid, order: valid.order ?? images.reduce((highest, item) => Math.max(highest, storedImageSchema.safeParse(item).data?.order ?? -1), -1) + 1 });
    await transaction.done;
  },
  async listImages(): Promise<StoredImage[]> {
    const db = await database(); const images = await db.getAll("images"); const valid: StoredImage[] = [];
    for (const [index, image] of images.entries()) { const parsed = storedImageSchema.safeParse(image); if (parsed.success) valid.push({ ...parsed.data, blob: parsed.data.blob as Blob, order: parsed.data.order ?? index }); }
    return valid.sort((a, b) => (a.order! - b.order!) || a.id.localeCompare(b.id));
  },
  async deleteImage(id: string): Promise<void> { const db = await database(); await db.delete("images", id); },
  async clearImages(): Promise<void> { const db = await database(); await db.clear("images"); },
  async putResult(result: StoredResult): Promise<void> { const db = await database(); await db.put("results", resultSchema.parse(result)); },
  async getResult(id: string): Promise<StoredResult | undefined> {
    if (!z.string().uuid().safeParse(id).success) return undefined;
    const db = await database(); const result = await db.get("results", id); const parsed = resultSchema.safeParse(result);
    if (parsed.success) return parsed.data;
    if (result) await db.delete("results", id);
    return undefined;
  },
  async listResults(): Promise<StoredResult[]> {
    const db = await database(); const results = await db.getAll("results"); const valid: StoredResult[] = [];
    for (const result of results) { const parsed = resultSchema.safeParse(result); if (parsed.success) valid.push(parsed.data); }
    return valid.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },
  async clearResults(): Promise<void> { const db = await database(); await db.clear("results"); },
};
