import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it, vi } from "vitest";

const legacy = (id: string, name: string) => ({ id, role: "product" as const, blob: new Blob([name], { type: "image/jpeg" }), name, type: "image/jpeg" as const, width: 1, height: 1, size: 1 });

describe("assetStorage v1 migration", () => {
  it("assigns unique legacy order before appending a new image", async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase("creative-generator"); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
    const v1 = await openDB("creative-generator", 1, { upgrade(db) { db.createObjectStore("images", { keyPath: "id" }); db.createObjectStore("results", { keyPath: "id" }); } });
    await v1.put("images", legacy("f0000000-0000-4000-8000-000000000000", "legacy-f.jpg"));
    await v1.put("images", legacy("10000000-0000-4000-8000-000000000000", "legacy-1.jpg"));
    v1.close(); vi.resetModules();
    const { assetStorage } = await import("./storage");
    await assetStorage.putImage(legacy("a0000000-0000-4000-8000-000000000000", "new.jpg"));
    const images = await assetStorage.listImages();
    expect(images.map((image) => image.name)).toEqual(["legacy-1.jpg", "legacy-f.jpg", "new.jpg"]);
    expect(new Set(images.map((image) => image.order)).size).toBe(3);
  });
});
