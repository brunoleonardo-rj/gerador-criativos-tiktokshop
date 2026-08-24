import "server-only";
import { decryptSecret, encryptSecret } from "./crypto";
import type { SettingsRepository } from "./repository";
import { validateVeoTemplate } from "./veo-template";
import { DEFAULT_GEMINI_TEMPLATE, validateGeminiTemplate } from "./gemini-template";

export const DEFAULT_VEO_TEMPLATE = `Create a highly realistic 9:16 vertical video using the provided frame as the visual reference.
Preserve the identity, product, environment, lighting direction, and overall composition shown in the image, while allowing natural motion and continuity to bring the scene to life.

PRODUCT: {{produto}}
ENVIRONMENT: {{ambiente}}
WARDROBE: {{figurino}}

VISUAL REALISM:
- Photorealistic skin with subtle texture, natural pores, soft highlights, and realistic shadows.
- Natural hair movement with fine strand detail and believable physics.
- Accurate fabric behavior and product materials with correct reflections and weight.
- Clean, sharp image with natural color, balanced contrast, and realistic depth of field.
- No over-processing, no artificial cinematic effects.

CAMERA & MOTION:
- Apply gentle, human-like camera movement (slow push-in, slight parallax, or soft handheld stabilization).
- Movement should feel intentional and calm, never random or aggressive.
- EXCEPTION FOR PRODUCT BEATS: when the influencer names a specific product feature, the camera is allowed to move faster and more decisively (quick tilt, fast push-in to detail, brief hold) as listed in SPEECH-SYNCED PRODUCT BEATS. These moves must still land smoothly, with a clear settle at the end — quick, but never shaky or jerky.
- Framing may subtly evolve to increase intimacy or focus, guided by the scene and the product.
- Avoid static shots, but keep everything smooth and coherent.
- The camera is on a fixed tripod. The influencer never holds a phone. This is not a mirror selfie.

INFLUENCER BEHAVIOR:
- The influencer behaves naturally, as if recording a real casual video.
- Relaxed posture, soft gestures, small head movements, natural blinking, and micro-expressions.
- Starting pose: {{pose}}
- No exaggerated acting or sales performance.

INFLUENCER SPEECH (Portuguese only) — SHOULD BE THE SAME WORD BY WORD AS BELOW:
"{{copy_completa}}"
- Speech must sound spontaneous, with light pauses, natural rhythm, and a soft Brazilian Portuguese accent.
- Tone is friendly, curious, and confident — never scripted or forced.
- Do not add, remove, or reorder any word.

SPEECH-SYNCED PRODUCT BEATS (CRITICAL — image must follow the words):
Every time the influencer names a specific feature, the camera and her hands must SHOW that exact feature at that exact moment. The visual lands ON the word, not before and not after. Each detail shot holds for about 1 second, then returns to the wider framing.

{{speech_beats}}

Timing rule: the hand gesture starts a fraction BEFORE the word and the camera move lands ON the word. Never let her name a feature while the camera stays wide — a named feature that isn't shown is a failed shot.

PRODUCT INTERACTION:
- The product remains visually accurate at all times.
- If touched or held, hand pressure, grip, and movement must be realistic and proportional.
- Hands must never cover the feature being named — they frame it, brush alongside it, or gesture toward it, always leaving the detail visible to camera.
- No distortion, no scale changes, no visual artifacts.

GENERAL GUIDELINES:
- Let realism guide every decision.
- Keep the video clean, modern, human, and believable.
- No on-screen text, captions, overlays, or graphic elements.
- The result should feel like a real person recording a real moment — not an ad.`;

export type PublicSettings = {
  apiKeyConfigured: boolean;
  apiKeyMask: string | null;
  model: string;
  veoTemplate: string;
  geminiTemplate: string;
  updatedAt: Date;
};

export type GenerationSettings = { apiKey: string; model: string; veoTemplate: string; geminiTemplate: string; updatedAt: Date };

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly encryptionKey: Buffer,
    private readonly defaultTemplate = DEFAULT_VEO_TEMPLATE,
    private readonly defaultGeminiTemplate = DEFAULT_GEMINI_TEMPLATE,
  ) {}

  async getPublic(): Promise<PublicSettings> {
    const settings = await this.repository.getOrCreate(this.defaultTemplate, this.defaultGeminiTemplate);
    return {
      apiKeyConfigured: settings.encryptedApiKey !== null,
      apiKeyMask: settings.apiKeyLastFour ? `••••${settings.apiKeyLastFour}` : null,
      model: settings.model,
      veoTemplate: settings.veoTemplate,
      geminiTemplate: settings.geminiTemplate,
      updatedAt: settings.updatedAt,
    };
  }

  async update(input: { apiKey?: string; model: string; veoTemplate: string; geminiTemplate: string }): Promise<PublicSettings> {
    const validation = validateVeoTemplate(input.veoTemplate);
    if (!validation.valid) throw new Error(`Template VEO contém variáveis não permitidas: ${validation.unknown.join(", ")}.`);
    const geminiValidation = validateGeminiTemplate(input.geminiTemplate);
    if (!geminiValidation.valid) throw new Error(`Template Gemini contém variáveis não permitidas: ${geminiValidation.unknown.join(", ")}.`);
    const updated = await this.repository.update({
      model: input.model,
      veoTemplate: input.veoTemplate,
      geminiTemplate: input.geminiTemplate,
      ...(input.apiKey === undefined ? {} : { encryptedApiKey: encryptSecret(input.apiKey, this.encryptionKey), apiKeyLastFour: input.apiKey.slice(-4) }),
    });
    return {
      apiKeyConfigured: updated.encryptedApiKey !== null,
      apiKeyMask: updated.apiKeyLastFour ? `••••${updated.apiKeyLastFour}` : null,
      model: updated.model,
      veoTemplate: updated.veoTemplate,
      geminiTemplate: updated.geminiTemplate,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteApiKey(): Promise<void> {
    await this.repository.getOrCreate(this.defaultTemplate, this.defaultGeminiTemplate);
    await this.repository.deleteApiKey();
  }

  async getGenerationSettings(): Promise<GenerationSettings> {
    const settings = await this.repository.getOrCreate(this.defaultTemplate, this.defaultGeminiTemplate);
    if (!settings.encryptedApiKey) throw new Error("A chave da Anthropic não está configurada.");
    return { apiKey: decryptSecret(settings.encryptedApiKey, this.encryptionKey), model: settings.model, veoTemplate: settings.veoTemplate, geminiTemplate: settings.geminiTemplate, updatedAt: settings.updatedAt };
  }
}
