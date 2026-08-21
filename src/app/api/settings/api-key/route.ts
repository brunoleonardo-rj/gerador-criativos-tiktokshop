import { requireSession, enforceSameOrigin } from "@/features/auth/request-guard";
import { PrismaSettingsRepository } from "@/features/settings/repository";
import { makeSettingsHandlers } from "@/features/settings/settings-handler";
import { SettingsService } from "@/features/settings/service";
import { getServerEnv } from "@/lib/env";

export async function DELETE(request: Request) {
  const env = getServerEnv();
  const { db } = await import("@/lib/db");
  const handlers = makeSettingsHandlers({
    service: new SettingsService(new PrismaSettingsRepository(db), Buffer.from(env.SETTINGS_ENCRYPTION_KEY, "base64")),
    requireSession,
    enforceSameOrigin,
  });
  return handlers.DELETE_API_KEY(request);
}
