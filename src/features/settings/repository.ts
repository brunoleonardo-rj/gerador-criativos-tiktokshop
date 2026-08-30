import "server-only";
import type { EncryptedSecret } from "./crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export type SettingsRecord = {
  encryptedApiKey: EncryptedSecret | null;
  apiKeyLastFour: string | null;
  model: string;
  veoTemplate: string;
  geminiTemplate: string;
  veoPovTemplate: string;
  geminiPovTemplate: string;
  updatedAt: Date;
};

export interface SettingsRepository {
  getOrCreate(defaultTemplate: string, defaultGeminiTemplate: string, defaultVeoPovTemplate: string, defaultGeminiPovTemplate: string): Promise<SettingsRecord>;
  update(input: { encryptedApiKey?: EncryptedSecret; apiKeyLastFour?: string; model: string; veoTemplate: string; geminiTemplate: string; veoPovTemplate: string; geminiPovTemplate: string }): Promise<SettingsRecord>;
  deleteApiKey(): Promise<void>;
}

type AppSettingsRow = {
  anthropicKeyCiphertext: string | null;
  anthropicKeyIv: string | null;
  anthropicKeyTag: string | null;
  anthropicKeyVersion: number | null;
  anthropicKeyLastFour: string | null;
  anthropicModel: string;
  veoTemplate: string;
  geminiTemplate: string;
  veoPovTemplate: string;
  geminiPovTemplate: string;
  updatedAt: Date;
};

function toRecord(row: AppSettingsRow): SettingsRecord {
  const parts = [row.anthropicKeyCiphertext, row.anthropicKeyIv, row.anthropicKeyTag, row.anthropicKeyVersion];
  if (parts.every((part) => part === null)) {
    return { encryptedApiKey: null, apiKeyLastFour: row.anthropicKeyLastFour, model: row.anthropicModel, veoTemplate: row.veoTemplate, geminiTemplate: row.geminiTemplate, veoPovTemplate: row.veoPovTemplate, geminiPovTemplate: row.geminiPovTemplate, updatedAt: row.updatedAt };
  }
  if (typeof row.anthropicKeyCiphertext !== "string" || typeof row.anthropicKeyIv !== "string" || typeof row.anthropicKeyTag !== "string" || row.anthropicKeyVersion !== 1) {
    throw new Error("A credencial armazenada está incompleta.");
  }
  return {
    encryptedApiKey: { ciphertext: row.anthropicKeyCiphertext, iv: row.anthropicKeyIv, tag: row.anthropicKeyTag, version: 1 },
    apiKeyLastFour: row.anthropicKeyLastFour,
    model: row.anthropicModel,
    veoTemplate: row.veoTemplate,
    geminiTemplate: row.geminiTemplate,
    veoPovTemplate: row.veoPovTemplate,
    geminiPovTemplate: row.geminiPovTemplate,
    updatedAt: row.updatedAt,
  };
}

export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly client: Pick<PrismaClient, "appSettings">) {}

  async getOrCreate(defaultTemplate: string, defaultGeminiTemplate: string, defaultVeoPovTemplate: string, defaultGeminiPovTemplate: string): Promise<SettingsRecord> {
    let row = await this.client.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", veoTemplate: defaultTemplate, geminiTemplate: defaultGeminiTemplate, veoPovTemplate: defaultVeoPovTemplate, geminiPovTemplate: defaultGeminiPovTemplate },
      update: {},
    });
    const backfill: { geminiTemplate?: string; veoPovTemplate?: string; geminiPovTemplate?: string } = {};
    if (row.geminiTemplate === "") backfill.geminiTemplate = defaultGeminiTemplate;
    if (row.veoPovTemplate === "") backfill.veoPovTemplate = defaultVeoPovTemplate;
    if (row.geminiPovTemplate === "") backfill.geminiPovTemplate = defaultGeminiPovTemplate;
    if (Object.keys(backfill).length > 0) {
      row = await this.client.appSettings.update({ where: { id: "singleton" }, data: backfill });
    }
    return toRecord(row);
  }

  async update(input: { encryptedApiKey?: EncryptedSecret; apiKeyLastFour?: string; model: string; veoTemplate: string; geminiTemplate: string; veoPovTemplate: string; geminiPovTemplate: string }): Promise<SettingsRecord> {
    const keyData = input.encryptedApiKey
      ? {
          anthropicKeyCiphertext: input.encryptedApiKey.ciphertext,
          anthropicKeyIv: input.encryptedApiKey.iv,
          anthropicKeyTag: input.encryptedApiKey.tag,
          anthropicKeyVersion: input.encryptedApiKey.version,
          anthropicKeyLastFour: input.apiKeyLastFour,
        }
      : {};
    const row = await this.client.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", anthropicModel: input.model, veoTemplate: input.veoTemplate, geminiTemplate: input.geminiTemplate, veoPovTemplate: input.veoPovTemplate, geminiPovTemplate: input.geminiPovTemplate, ...keyData },
      update: { anthropicModel: input.model, veoTemplate: input.veoTemplate, geminiTemplate: input.geminiTemplate, veoPovTemplate: input.veoPovTemplate, geminiPovTemplate: input.geminiPovTemplate, ...keyData },
    });
    return toRecord(row);
  }

  async deleteApiKey(): Promise<void> {
    await this.client.appSettings.update({
      where: { id: "singleton" },
      data: { anthropicKeyCiphertext: null, anthropicKeyIv: null, anthropicKeyTag: null, anthropicKeyVersion: null, anthropicKeyLastFour: null },
    });
  }
}
