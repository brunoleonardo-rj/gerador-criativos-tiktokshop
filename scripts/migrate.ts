import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const TRACKING_TABLE = "__app_migrations";

type Environment = Record<string, string | undefined>;

type Migration = {
  name: string;
  sql: string;
  checksum: string;
};

export type MigrationRunnerOptions = {
  env?: Environment;
  migrationsDir?: string;
};

function safeConfigurationError(message: string): Error {
  return new Error(`Configuração de banco inválida: ${message}`);
}

function rejectUnsafePath(value: string, source: string): void {
  if (!value || value.includes("\0")) throw safeConfigurationError(`${source} deve apontar para um arquivo SQLite local.`);
}

export function resolveDatabasePath(env: Environment = process.env): string {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    const dataDir = env.DATA_DIR?.trim() || "./data";
    rejectUnsafePath(dataDir, "DATA_DIR");
    return path.resolve(dataDir, "app.db");
  }

  rejectUnsafePath(databaseUrl, "DATABASE_URL");
  if (!/^file:/i.test(databaseUrl)) throw safeConfigurationError("DATABASE_URL deve usar uma URL SQLite local file:.");
  if (databaseUrl.includes("?") || databaseUrl.includes("#")) {
    throw safeConfigurationError("DATABASE_URL não aceita query string nem fragmento.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw safeConfigurationError("DATABASE_URL deve ser uma URL file: absoluta.");
  }
  if (parsed.protocol !== "file:" || parsed.hostname) {
    throw safeConfigurationError("DATABASE_URL deve apontar para um arquivo SQLite local.");
  }

  let databasePath: string;
  try {
    databasePath = fileURLToPath(parsed);
  } catch {
    throw safeConfigurationError("DATABASE_URL contém um caminho de arquivo inválido.");
  }
  rejectUnsafePath(databasePath, "DATABASE_URL");
  if (!path.isAbsolute(databasePath) && !/^\/[A-Za-z]:\//.test(parsed.pathname)) {
    throw safeConfigurationError("DATABASE_URL deve usar um caminho absoluto.");
  }
  return path.resolve(databasePath);
}

async function loadMigrations(migrationsDir: string): Promise<Migration[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return Promise.all(directories.map(async (name) => {
    const bytes = await readFile(path.join(migrationsDir, name, "migration.sql"));
    return { name, sql: bytes.toString("utf8"), checksum: createHash("sha256").update(bytes).digest("hex") };
  }));
}

function tableNames(database: Database.Database): string[] {
  return database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all().map((row) => (row as { name: string }).name);
}

function ensureTrackingTable(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
    name TEXT NOT NULL PRIMARY KEY,
    checksum TEXT NOT NULL,
    appliedAt TEXT NOT NULL
  )`);
}

function legacyPrismaRows(database: Database.Database): Array<{ migration_name: string; checksum: string; finished_at: string }> {
  const columns = database.prepare("PRAGMA table_info('_prisma_migrations')").all()
    .map((row) => (row as { name: string }).name);
  for (const expected of ["migration_name", "checksum", "finished_at", "rolled_back_at"]) {
    if (!columns.includes(expected)) throw new Error("Banco Prisma legado não pode ser verificado; restaure um backup ou execute a recuperação documentada.");
  }
  return database.prepare("SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at ASC, rowid ASC")
    .all() as Array<{ migration_name: string; checksum: string; finished_at: string }>;
}

function adoptPrismaMigrations(database: Database.Database, migrations: Migration[], existingSchema: boolean): void {
  const names = tableNames(database);
  if (!names.includes("_prisma_migrations")) {
    if (existingSchema) throw new Error("Banco existente sem histórico de migrações reconhecido. Faça backup e recupere o histórico antes de continuar.");
    return;
  }

  const legacy = legacyPrismaRows(database);
  const uniqueLegacyNames = new Set(legacy.map((row) => row.migration_name));
  const exactLegacyPrefix = legacy.length <= migrations.length
    && uniqueLegacyNames.size === legacy.length
    && legacy.every((row, index) => migrations[index]?.name === row.migration_name && migrations[index]?.checksum === row.checksum);
  if (!exactLegacyPrefix) throw new Error("Histórico Prisma não corresponde às migrações locais. Faça backup e recupere o banco antes de continuar.");
  if (existingSchema && legacy.length === 0) throw new Error("Banco existente sem histórico Prisma aplicável. Faça backup e recupere o banco antes de continuar.");

  const insert = database.prepare(`INSERT OR IGNORE INTO ${TRACKING_TABLE} (name, checksum, appliedAt) VALUES (?, ?, ?)`);
  const adopt = database.transaction(() => {
    for (const [index, legacyRow] of legacy.entries()) {
      const migration = migrations[index];
      insert.run(migration.name, migration.checksum, legacyRow.finished_at);
    }
  });
  adopt();
}

function applyMigration(database: Database.Database, migration: Migration): boolean {
  database.exec("BEGIN IMMEDIATE");
  try {
    const applied = database.prepare(`SELECT checksum FROM ${TRACKING_TABLE} WHERE name = ?`).get(migration.name) as { checksum: string } | undefined;
    if (applied) {
      if (applied.checksum !== migration.checksum) throw new Error(`Checksum divergente para a migração ${migration.name}.`);
      database.exec("COMMIT");
      return false;
    }
    database.exec(migration.sql);
    database.prepare(`INSERT INTO ${TRACKING_TABLE} (name, checksum, appliedAt) VALUES (?, ?, ?)`)
      .run(migration.name, migration.checksum, new Date().toISOString());
    database.exec("COMMIT");
    return true;
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* no active transaction */ }
    throw error;
  }
}

export async function runMigrations(options: MigrationRunnerOptions = {}): Promise<{ applied: number; databasePath: string }> {
  const env = options.env ?? process.env;
  const databasePath = resolveDatabasePath(env);
  const migrationsDir = path.resolve(options.migrationsDir ?? path.join("prisma", "migrations"));
  const migrations = await loadMigrations(migrationsDir);
  await mkdir(path.dirname(databasePath), { recursive: true });

  const existed = existsSync(databasePath);
  const database = new Database(databasePath);
  try {
    database.pragma("busy_timeout = 5000");
    database.pragma("foreign_keys = ON");
    const preExistingTables = existed ? tableNames(database) : [];
    const existingSchema = preExistingTables.some((name) => name !== TRACKING_TABLE && name !== "_prisma_migrations");
    ensureTrackingTable(database);
    const trackingIsEmpty = (database.prepare(`SELECT COUNT(*) AS count FROM ${TRACKING_TABLE}`).get() as { count: number }).count === 0;
    const shouldAdopt = !preExistingTables.includes(TRACKING_TABLE)
      || (trackingIsEmpty && preExistingTables.includes("_prisma_migrations"));
    if (shouldAdopt) adoptPrismaMigrations(database, migrations, existingSchema);
    let applied = 0;
    for (const migration of migrations) if (applyMigration(database, migration)) applied += 1;
    return { applied, databasePath };
  } finally {
    database.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runMigrations().then(({ applied }) => {
    process.stdout.write(`Migrações concluídas: ${applied} aplicada(s).\n`);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Falha ao executar migrações.";
    process.stderr.write(`Migração não concluída: ${message}\n`);
    process.exitCode = 1;
  });
}
