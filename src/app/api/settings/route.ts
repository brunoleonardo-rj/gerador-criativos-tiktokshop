import { requireSession, enforceSameOrigin } from "@/features/auth/request-guard";
import { PrismaSettingsRepository } from "@/features/settings/repository";
import { makeSettingsHandlers } from "@/features/settings/settings-handler";
import { SettingsService } from "@/features/settings/service";
import { getServerEnv } from "@/lib/env";

async function handlers() {
  const env = getServerEnv();
  const { db } = await import("@/lib/db");
  return makeSettingsHandlers({
    service: new SettingsService(new PrismaSettingsRepository(db), Buffer.from(env.SETTINGS_ENCRYPTION_KEY, "base64")),
    requireSession,
    enforceSameOrigin,
  });
}

export async function GET(request: Request) {
  return (await handlers()).GET(request);
}

export async function PUT(request: Request) {
  return (await handlers()).PUT(request);
}
