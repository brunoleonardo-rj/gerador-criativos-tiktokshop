import { readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibraryRepository } from "./repository";

const migration = (name: string) => readFile(path.join(process.cwd(), "prisma", "migrations", name, "migration.sql"), "utf8");
async function migrated() { const file = path.join(await mkdtemp(path.join(tmpdir(), "library-migration-")), "app.db"); const sqlite = new Database(file); sqlite.exec(await migration("20260821000000_init")); return { file, sqlite }; }
describe("PrismaLibraryRepository migrations", () => {
  it("applies the actual upgrade SQL and leaves legacy jsonSha256 null", async () => { const { file, sqlite } = await migrated(); let client: PrismaClient | undefined; try { sqlite.exec(`INSERT INTO "LibraryVersion" ("id","sourceFilename","sourceSha256","recordCount","workbookPath","jsonPath","status","validationSummary","createdAt") VALUES ('legacy','a.xlsx','${"a".repeat(64)}',1,'a','b','ACTIVE','{}',CURRENT_TIMESTAMP)`); sqlite.exec(await migration("20260821010000_library_json_integrity")); sqlite.close(); client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file.replaceAll("\\", "/")}` }) }); expect((await client.libraryVersion.findUnique({ where: { id: "legacy" } }))?.jsonSha256).toBeNull(); } finally { await client?.$disconnect(); if (sqlite.open) sqlite.close(); } });
  it("creates staged rows with non-null JSON hashes after fresh migrations", async () => { const { file, sqlite } = await migrated(); let client: PrismaClient | undefined; try { sqlite.exec(await migration("20260821010000_library_json_integrity")); sqlite.close(); client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file.replaceAll("\\", "/")}` }) }); const row = await new PrismaLibraryRepository(client).createStaged({ id: "one", sourceFilename: "a.xlsx", sourceSha256: "a".repeat(64), jsonSha256: "b".repeat(64), recordCount: 1, workbookPath: "a", jsonPath: "b", status: "STAGED", validationSummary: {}, createdAt: new Date(), activatedAt: null }); expect(row.jsonSha256).toMatch(/^[a-f0-9]{64}$/); } finally { await client?.$disconnect(); if (sqlite.open) sqlite.close(); } });
});
