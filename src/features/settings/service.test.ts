import { describe, expect, it } from "vitest";
import type { EncryptedSecret } from "./crypto";
import type { SettingsRecord, SettingsRepository } from "./repository";
import { SettingsService } from "./service";

class InMemorySettingsRepository implements SettingsRepository {
  private record: SettingsRecord | null = null;

  async getOrCreate(defaultTemplate: string, defaultGeminiTemplate: string): Promise<SettingsRecord> {
    this.record ??= {
      encryptedApiKey: null,
      apiKeyLastFour: null,
      model: "claude-sonnet-5",
      veoTemplate: defaultTemplate,
      geminiTemplate: defaultGeminiTemplate,
      updatedAt: new Date("2026-08-21T12:00:00.000Z"),
    };
    return this.record;
  }

  async update(input: { encryptedApiKey?: EncryptedSecret; apiKeyLastFour?: string; model: string; veoTemplate: string; geminiTemplate: string }) {
    const current = await this.getOrCreate("{{copy_completa}}", "{{produto}}");
    this.record = {
      ...current,
      encryptedApiKey: input.encryptedApiKey ?? current.encryptedApiKey,
      apiKeyLastFour: input.apiKeyLastFour ?? current.apiKeyLastFour,
      model: input.model,
      veoTemplate: input.veoTemplate,
      geminiTemplate: input.geminiTemplate,
      updatedAt: new Date("2026-08-21T12:01:00.000Z"),
    };
    return this.record;
  }

  async deleteApiKey(): Promise<void> {
    const current = await this.getOrCreate("{{copy_completa}}", "{{produto}}");
    this.record = { ...current, encryptedApiKey: null, apiKeyLastFour: null };
  }
}

describe("SettingsService", () => {
  it("nunca devolve a chave completa", async () => {
    const repository = new InMemorySettingsRepository();
    const service = new SettingsService(repository, Buffer.alloc(32, 4));

    await service.update({ apiKey: "sk-ant-1234567890", model: "claude-sonnet-5", veoTemplate: "{{copy_completa}}", geminiTemplate: "{{produto}}" });

    expect(await service.getPublic()).toMatchObject({ apiKeyConfigured: true, apiKeyMask: "••••7890" });
    expect(JSON.stringify(await service.getPublic())).not.toContain("sk-ant-");
  });

  it("só descriptografa a chave para configurações de geração", async () => {
    const service = new SettingsService(new InMemorySettingsRepository(), Buffer.alloc(32, 4));
    await service.update({ apiKey: "sk-ant-1234567890", model: "claude-sonnet-5", veoTemplate: "{{copy_completa}}", geminiTemplate: "{{produto}}" });

    expect(await service.getGenerationSettings()).toMatchObject({ apiKey: "sk-ant-1234567890", model: "claude-sonnet-5", geminiTemplate: "{{produto}}" });
  });

  it("não salva um template com variáveis desconhecidas", async () => {
    const service = new SettingsService(new InMemorySettingsRepository(), Buffer.alloc(32, 4));

    await expect(
      service.update({ model: "claude-sonnet-5", veoTemplate: "{{variavel_inventada}}", geminiTemplate: "{{produto}}" }),
    ).rejects.toThrow("Template VEO contém variáveis não permitidas: variavel_inventada.");
  });

  it("não salva um template Gemini com variáveis desconhecidas", async () => {
    const service = new SettingsService(new InMemorySettingsRepository(), Buffer.alloc(32, 4));

    await expect(service.update({ model: "claude-sonnet-5", veoTemplate: "{{copy_completa}}", geminiTemplate: "{{inventada}}" }))
      .rejects.toThrow("Template Gemini contém variáveis não permitidas: inventada.");
  });
});
