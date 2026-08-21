import "server-only";
import { decryptSecret, encryptSecret } from "./crypto";
import type { SettingsRepository } from "./repository";
import { validateVeoTemplate } from "./veo-template";

export const DEFAULT_VEO_TEMPLATE = "Crie um vídeo UGC em português brasileiro. Preserve a fala natural exatamente como fornecida em {{copy_completa}}.";

export type PublicSettings = {
  apiKeyConfigured: boolean;
  apiKeyMask: string | null;
  model: string;
  veoTemplate: string;
  updatedAt: Date;
};

export type GenerationSettings = { apiKey: string; model: string; veoTemplate: string; updatedAt: Date };

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly encryptionKey: Buffer,
    private readonly defaultTemplate = DEFAULT_VEO_TEMPLATE,
  ) {}

  async getPublic(): Promise<PublicSettings> {
    const settings = await this.repository.getOrCreate(this.defaultTemplate);
    return {
      apiKeyConfigured: settings.encryptedApiKey !== null,
      apiKeyMask: settings.apiKeyLastFour ? `••••${settings.apiKeyLastFour}` : null,
      model: settings.model,
      veoTemplate: settings.veoTemplate,
      updatedAt: settings.updatedAt,
    };
  }

  async update(input: { apiKey?: string; model: string; veoTemplate: string }): Promise<PublicSettings> {
    const validation = validateVeoTemplate(input.veoTemplate);
    if (!validation.valid) throw new Error(`Template VEO contém variáveis não permitidas: ${validation.unknown.join(", ")}.`);
    const updated = await this.repository.update({
      model: input.model,
      veoTemplate: input.veoTemplate,
      ...(input.apiKey === undefined ? {} : { encryptedApiKey: encryptSecret(input.apiKey, this.encryptionKey), apiKeyLastFour: input.apiKey.slice(-4) }),
    });
    return {
      apiKeyConfigured: updated.encryptedApiKey !== null,
      apiKeyMask: updated.apiKeyLastFour ? `••••${updated.apiKeyLastFour}` : null,
      model: updated.model,
      veoTemplate: updated.veoTemplate,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteApiKey(): Promise<void> {
    await this.repository.getOrCreate(this.defaultTemplate);
    await this.repository.deleteApiKey();
  }

  async getGenerationSettings(): Promise<GenerationSettings> {
    const settings = await this.repository.getOrCreate(this.defaultTemplate);
    if (!settings.encryptedApiKey) throw new Error("A chave da Anthropic não está configurada.");
    return { apiKey: decryptSecret(settings.encryptedApiKey, this.encryptionKey), model: settings.model, veoTemplate: settings.veoTemplate, updatedAt: settings.updatedAt };
  }
}
