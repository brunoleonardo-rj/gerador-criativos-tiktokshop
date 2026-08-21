import { requireSession, enforceSameOrigin } from "@/features/auth/request-guard";
import { getAnthropicPort } from "@/features/generation/anthropic-port";
import { makeGenerateHandler } from "@/features/generation/generate-handler";
import { GenerationService } from "@/features/generation/service";
import { getLibraryService } from "@/features/library/route-service";
import { PrismaSettingsRepository } from "@/features/settings/repository";
import { SettingsService } from "@/features/settings/service";
import { getServerEnv } from "@/lib/env";

async function handler() {
  const env = getServerEnv(); const { db } = await import("@/lib/db");
  return makeGenerateHandler({ service: new GenerationService(new SettingsService(new PrismaSettingsRepository(db), Buffer.from(env.SETTINGS_ENCRYPTION_KEY, "base64")), await getLibraryService(), getAnthropicPort()), requireSession, enforceSameOrigin });
}
export async function POST(request: Request) { return (await handler())(request); }
