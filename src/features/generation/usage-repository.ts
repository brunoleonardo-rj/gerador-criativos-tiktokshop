import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

export type UsageEntry = {
  model: string;
  creativeCount: number;
  imageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export interface UsageRecorder {
  record(entry: UsageEntry): Promise<void>;
}

export class PrismaUsageRecorder implements UsageRecorder {
  constructor(private readonly db: Pick<PrismaClient, "generationUsage">) {}

  async record(entry: UsageEntry): Promise<void> {
    await this.db.generationUsage.create({ data: entry });
  }
}

// Usado onde a medição não interessa — testes e chamadas fora da rota HTTP.
export const noopUsageRecorder: UsageRecorder = { async record() {} };
