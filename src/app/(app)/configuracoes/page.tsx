import { SettingsForm } from "@/features/settings/settings-form";
import { PrismaSettingsRepository } from "@/features/settings/repository";
import { SettingsService } from "@/features/settings/service";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const env = getServerEnv();
  const { db } = await import("@/lib/db");
  const settings = await new SettingsService(
    new PrismaSettingsRepository(db),
    Buffer.from(env.SETTINGS_ENCRYPTION_KEY, "base64"),
  ).getPublic();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <p className="eyebrow">Estúdio criativo</p>
        <h1 className="text-5xl sm:text-6xl">Configurações</h1>
        <p className="intro">Gerencie credencial, modelo e o template que transforma cada copy em um prompt VEO 3.</p>
      </div>
      <SettingsForm initial={{ ...settings, updatedAt: settings.updatedAt.toISOString() }} />
    </main>
  );
}
