// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ active: false, stageAttempts: 0 }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: vi.fn().mockResolvedValue(Buffer.from("workbook")) };
});
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ DATA_DIR: "test-data" }) }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./storage", () => ({ FileLibraryStorage: class FileLibraryStorage {} }));
vi.mock("./repository", () => ({ PrismaLibraryRepository: class PrismaLibraryRepository {} }));
vi.mock("./service", () => ({
  LibraryService: class LibraryService {
    async getStatus() { return { active: state.active ? { id: "active" } : null, previous: null, staged: [] }; }
    async stage() {
      state.stageAttempts += 1;
      if (state.stageAttempts === 1) throw new Error("falha transitória");
      return { importId: "staged" };
    }
    async activate() { state.active = true; }
  },
}));

describe("getLibraryService", () => {
  beforeEach(() => {
    state.active = false;
    state.stageAttempts = 0;
    vi.resetModules();
  });

  it("permite nova tentativa de seed após uma falha transitória", async () => {
    const { getLibraryService } = await import("./route-service");
    const service = await getLibraryService();

    await expect(service.getStatus()).rejects.toThrow("falha transitória");
    await expect(service.getStatus()).resolves.toMatchObject({ active: { id: "active" } });
    expect(state.stageAttempts).toBe(2);
  });
});
