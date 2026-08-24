import {
  enforceSameOrigin,
  requireSession,
} from "@/features/auth/request-guard";
import { getProductExtractionPort } from "@/features/product-extraction/anthropic-port";
import { makeProductExtractionHandler } from "@/features/product-extraction/handler";
import { ProductExtractionService } from "@/features/product-extraction/service";
import { PrismaSettingsRepository } from "@/features/settings/repository";
import { SettingsService } from "@/features/settings/service";
import { getServerEnv } from "@/lib/env";

async function handler() {
  const env = getServerEnv();
  const { db } = await import("@/lib/db");
  const settings = new SettingsService(
    new PrismaSettingsRepository(db),
    Buffer.from(env.SETTINGS_ENCRYPTION_KEY, "base64"),
  );
  const service = new ProductExtractionService(
    settings,
    getProductExtractionPort(),
  );

  return makeProductExtractionHandler({
    service,
    requireSession,
    enforceSameOrigin,
  });
}

export async function POST(request: Request): Promise<Response> {
  return (await handler())(request);
}
