import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";

const temporaryDirectories: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "gerador-migrate-"));
  temporaryDirectories.push(root);
  const migrationsDir = path.join(root, "migrations");
  return { root, migrationsDir, databasePath: path.join(root, "runtime", "app.db") };
}

async function migration(directory: string, name: string, sql: string) {
  const file = path.join(directory, name, "migration.sql");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, sql, { encoding: "utf8", flag: "w" });
  return file;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("runMigrations", () => {
  it("applies ordered migration files once and records exact checksums", async () => {
    const { migrationsDir, databasePath } = await fixture();
    await migration(migrationsDir, "20260101000000_first", "CREATE TABLE first_table (id INTEGER PRIMARY KEY);\n");
    await migration(migrationsDir, "20260102000000_second", "CREATE TABLE second_table (value TEXT NOT NULL);\n");

    await runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } });
    await runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } });

    const database = new Database(databasePath, { readonly: true });
    try {
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('first_table', 'second_table') ORDER BY name").all())
        .toEqual([{ name: "first_table" }, { name: "second_table" }]);
      expect(database.prepare("SELECT name, checksum FROM __app_migrations ORDER BY name").all()).toEqual([
        { name: "20260101000000_first", checksum: createHash("sha256").update("CREATE TABLE first_table (id INTEGER PRIMARY KEY);\n").digest("hex") },
        { name: "20260102000000_second", checksum: createHash("sha256").update("CREATE TABLE second_table (value TEXT NOT NULL);\n").digest("hex") },
      ]);
    } finally {
      database.close();
    }
  });

  it("fails closed when an applied migration's exact bytes change", async () => {
    const { migrationsDir, databasePath } = await fixture();
    const file = await migration(migrationsDir, "20260101000000_first", "CREATE TABLE first_table (id INTEGER);\n");
    await runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } });
    await writeFile(file, "CREATE TABLE first_table (id INTEGER, changed TEXT);\n");

    await expect(runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } }))
      .rejects.toThrow(/checksum/i);
  });

  it("rolls back both SQL changes and its tracking row when a migration is invalid", async () => {
    const { migrationsDir, databasePath } = await fixture();
    await migration(migrationsDir, "20260101000000_broken", "CREATE TABLE temporary_table (id INTEGER);\nTHIS IS INVALID SQL;\n");

    await expect(runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } }))
      .rejects.toThrow();

    const database = new Database(databasePath, { readonly: true });
    try {
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'temporary_table'").all()).toEqual([]);
      expect(database.prepare("SELECT name FROM __app_migrations").all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("rejects a non-local datasource without exposing it", async () => {
    const { migrationsDir } = await fixture();
    await expect(runMigrations({ migrationsDir, env: { DATABASE_URL: "postgresql://person:secret@example.test/app" } }))
      .rejects.toThrow(/SQLite local/i);
  });

  it("rejects a relative file URL rather than choosing an implicit database path", async () => {
    const { migrationsDir } = await fixture();
    await expect(runMigrations({ migrationsDir, env: { DATABASE_URL: "file:relative.db" } }))
      .rejects.toThrow(/Configuração de banco inválida/i);
  });

  it("adopts only matching successful Prisma migration rows", async () => {
    const { migrationsDir, databasePath } = await fixture();
    const sql = "CREATE TABLE existing_table (id INTEGER PRIMARY KEY);\n";
    await migration(migrationsDir, "20260101000000_existing", sql);
    await mkdir(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    try {
      database.exec(`${sql} CREATE TABLE _prisma_migrations (migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);`);
      database.prepare("INSERT INTO _prisma_migrations (migration_name, checksum, finished_at, rolled_back_at) VALUES (?, ?, ?, NULL)")
        .run("20260101000000_existing", createHash("sha256").update(sql).digest("hex"), "2026-01-01T00:00:00.000Z");
    } finally {
      database.close();
    }

    await runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } });

    const verified = new Database(databasePath, { readonly: true });
    try {
      expect(verified.prepare("SELECT name FROM __app_migrations").all()).toEqual([{ name: "20260101000000_existing" }]);
    } finally {
      verified.close();
    }
  });

  it("adopts an exact Prisma prefix and applies the remaining canonical migration", async () => {
    const { migrationsDir, databasePath } = await fixture();
    const firstSql = "CREATE TABLE first_table (id INTEGER PRIMARY KEY);\n";
    const secondSql = "CREATE TABLE second_table (id INTEGER PRIMARY KEY);\n";
    await migration(migrationsDir, "20260101000000_first", firstSql);
    await migration(migrationsDir, "20260102000000_second", secondSql);
    await mkdir(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    try {
      database.exec(`${firstSql} CREATE TABLE _prisma_migrations (migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);`);
      database.prepare("INSERT INTO _prisma_migrations (migration_name, checksum, finished_at, rolled_back_at) VALUES (?, ?, ?, NULL)")
        .run("20260101000000_first", createHash("sha256").update(firstSql).digest("hex"), "2026-01-01T00:00:00.000Z");
    } finally {
      database.close();
    }

    await runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } });

    const verified = new Database(databasePath, { readonly: true });
    try {
      expect(verified.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('first_table', 'second_table') ORDER BY name").all())
        .toEqual([{ name: "first_table" }, { name: "second_table" }]);
      expect(verified.prepare("SELECT name FROM __app_migrations ORDER BY name").all()).toEqual([
        { name: "20260101000000_first" },
        { name: "20260102000000_second" },
      ]);
    } finally {
      verified.close();
    }
  });

  it("refuses adoption when Prisma has an extra successful migration", async () => {
    const { migrationsDir, databasePath } = await fixture();
    const sql = "CREATE TABLE existing_table (id INTEGER PRIMARY KEY);\n";
    await migration(migrationsDir, "20260101000000_existing", sql);
    await mkdir(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    try {
      database.exec(`${sql} CREATE TABLE _prisma_migrations (migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);`);
      const insert = database.prepare("INSERT INTO _prisma_migrations (migration_name, checksum, finished_at, rolled_back_at) VALUES (?, ?, ?, NULL)");
      insert.run("20260101000000_existing", createHash("sha256").update(sql).digest("hex"), "2026-01-01T00:00:00.000Z");
      insert.run("20260101000000_extra", "f".repeat(64), "2026-01-02T00:00:00.000Z");
    } finally {
      database.close();
    }

    await expect(runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } }))
      .rejects.toThrow(/Histórico Prisma não corresponde/i);
  });

  it("retries a rejected adoption without bypassing extra Prisma history", async () => {
    const { migrationsDir, databasePath } = await fixture();
    const sql = "CREATE TABLE existing_table (id INTEGER PRIMARY KEY);\n";
    await migration(migrationsDir, "20260101000000_existing", sql);
    await mkdir(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    try {
      database.exec(`${sql} CREATE TABLE _prisma_migrations (migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);`);
      const insert = database.prepare("INSERT INTO _prisma_migrations (migration_name, checksum, finished_at, rolled_back_at) VALUES (?, ?, ?, NULL)");
      insert.run("20260101000000_existing", createHash("sha256").update(sql).digest("hex"), "2026-01-01T00:00:00.000Z");
      insert.run("20260102000000_extra", "f".repeat(64), "2026-01-02T00:00:00.000Z");
    } finally {
      database.close();
    }
    const options = { migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } };

    await expect(runMigrations(options)).rejects.toThrow(/Histórico Prisma não corresponde/i);
    await expect(runMigrations(options)).rejects.toThrow(/Histórico Prisma não corresponde/i);

    const repaired = new Database(databasePath);
    try {
      repaired.prepare("DELETE FROM _prisma_migrations WHERE migration_name = ?").run("20260102000000_extra");
    } finally {
      repaired.close();
    }

    await expect(runMigrations(options)).resolves.toMatchObject({ applied: 0 });
    const verified = new Database(databasePath, { readonly: true });
    try {
      expect(verified.prepare("SELECT name FROM __app_migrations").all()).toEqual([{ name: "20260101000000_existing" }]);
    } finally {
      verified.close();
    }
  });

  it("refuses adoption when Prisma has duplicate successful migration names", async () => {
    const { migrationsDir, databasePath } = await fixture();
    const sql = "CREATE TABLE existing_table (id INTEGER PRIMARY KEY);\n";
    await migration(migrationsDir, "20260101000000_existing", sql);
    await mkdir(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    try {
      database.exec(`${sql} CREATE TABLE _prisma_migrations (migration_name TEXT, checksum TEXT, finished_at TEXT, rolled_back_at TEXT);`);
      const insert = database.prepare("INSERT INTO _prisma_migrations (migration_name, checksum, finished_at, rolled_back_at) VALUES (?, ?, ?, NULL)");
      const checksum = createHash("sha256").update(sql).digest("hex");
      insert.run("20260101000000_existing", checksum, "2026-01-01T00:00:00.000Z");
      insert.run("20260101000000_existing", checksum, "2026-01-02T00:00:00.000Z");
    } finally {
      database.close();
    }

    await expect(runMigrations({ migrationsDir, env: { DATABASE_URL: pathToFileURL(databasePath).href } }))
      .rejects.toThrow(/Histórico Prisma não corresponde/i);
  });

  it("keeps one canonical history when callers start together", async () => {
    const { migrationsDir, databasePath } = await fixture();
    await migration(migrationsDir, "20260101000000_first", "CREATE TABLE first_table (id INTEGER PRIMARY KEY);\n");
    await migration(migrationsDir, "20260102000000_second", "CREATE TABLE second_table (id INTEGER PRIMARY KEY);\n");

    await Promise.all(Array.from({ length: 4 }, () => runMigrations({
      migrationsDir,
      env: { DATABASE_URL: pathToFileURL(databasePath).href },
    })));

    const database = new Database(databasePath, { readonly: true });
    try {
      expect(database.prepare("SELECT name FROM __app_migrations ORDER BY name").all()).toEqual([
        { name: "20260101000000_first" },
        { name: "20260102000000_second" },
      ]);
    } finally {
      database.close();
    }
  });
});
