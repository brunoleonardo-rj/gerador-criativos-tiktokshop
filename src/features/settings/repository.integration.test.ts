import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import type { EncryptedSecret } from "./crypto";
import { PrismaSettingsRepository } from "./repository";

describe("PrismaSettingsRepository", () => {
  it("mantém o repositório Prisma no limite server-only", () => {
    expect(readFileSync(path.resolve(process.cwd(), "src/features/settings/repository.ts"), "utf8")).toContain('import "server-only"');
  });

  it("persiste apenas os campos criptografados e limpa todos ao remover a chave", async () => {
    const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: ":memory:" }) });
    await client.$executeRawUnsafe(`CREATE TABLE "AppSettings" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "anthropicKeyCiphertext" TEXT,
      "anthropicKeyIv" TEXT,
      "anthropicKeyTag" TEXT,
      "anthropicKeyVersion" INTEGER,
      "anthropicKeyLastFour" TEXT,
      "anthropicModel" TEXT NOT NULL DEFAULT 'claude-sonnet-5',
      "veoTemplate" TEXT NOT NULL,
      "geminiTemplate" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`);
    const repository = new PrismaSettingsRepository(client);
    const encrypted: EncryptedSecret = { ciphertext: "ciphertext", iv: "iv", tag: "tag", version: 1 };

    const defaults = await repository.getOrCreate("{{copy_completa}}", "{{produto}}");
    expect(defaults.geminiTemplate).toBe("{{produto}}");
    const saved = await repository.update({ encryptedApiKey: encrypted, apiKeyLastFour: "7890", model: "claude-sonnet-5", veoTemplate: "{{copy_completa}}", geminiTemplate: "{{produto}}" });
    expect(saved.encryptedApiKey).toEqual(encrypted);
    await repository.deleteApiKey();
    expect((await repository.getOrCreate("unused", "unused")).encryptedApiKey).toBeNull();
    await client.$disconnect();
  });
});
