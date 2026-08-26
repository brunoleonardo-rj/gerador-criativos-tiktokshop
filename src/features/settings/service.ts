import "server-only";
import { decryptSecret, encryptSecret } from "./crypto";
import type { SettingsRepository } from "./repository";
import { validateVeoTemplate } from "./veo-template";
import { DEFAULT_GEMINI_TEMPLATE, validateGeminiTemplate } from "./gemini-template";

export const DEFAULT_VEO_TEMPLATE = `Create a highly realistic 9:16 vertical video using the provided frame as the visual reference.
Preserve the identity, product, environment, lighting direction, and overall composition shown in the image, while allowing natural motion and continuity to bring the scene to life. {{continuidade}}

CRITICAL FIDELITY — read this before anything else, violating any of these ruins the shot:
- {{ancoragem_produto}}
- The product's shape, color, material, and every visible feature (pockets, buttons, zippers, logos, texture) are pixel-identical to the reference frame in every single frame — no invented or missing details, ever.
- Her skin is pixel-identical to the reference frame in every single frame — no invented tattoo, mark, scar, or piercing anywhere, at any point in the video. If a real tattoo or mark is visible in the reference frame, it only ever shows on exposed skin, properly hidden under clothing wherever fabric covers it — never visible on top of or through the fabric.
- Her hair length, color, and style stay exactly as shown in the reference frame — natural movement only, never regrown, cut, or restyled.
- Her clothing is pixel-identical to the reference frame too — plain fabric stays plain. Never print, embroider, or draw any graphic, pattern, necklace, charm, or decorative design onto the clothing that isn't already visible in the reference frame.
- Exactly two arms, two hands, five fingers per hand, one head, at all times — never an extra or missing limb, hand, or finger.

PRODUCT: {{produto}}
ENVIRONMENT: {{ambiente}}
WARDROBE: {{figurino}}

VISUAL REALISM:
- Photorealistic skin with subtle texture, natural pores, soft highlights, and realistic shadows.
- Hair length, color, and style stay exactly as shown in the reference frame throughout the whole video — natural movement and physics are allowed, but never lengthen, shorten, thicken, or restyle it.
- Accurate fabric behavior and product materials with correct reflections and weight.
- Clean, sharp image with natural color, balanced contrast, and realistic depth of field.
- No over-processing, no artificial cinematic effects.

CAMERA & MOTION:
- Apply gentle, human-like camera movement (slow push-in, slight parallax, or soft handheld stabilization).
- Movement should feel intentional and calm, never random or aggressive.
- EXCEPTION FOR PRODUCT BEATS: when the influencer names a specific product feature, the camera is allowed to move faster and more decisively (quick tilt, fast push-in to detail, brief hold) as listed in SPEECH-SYNCED PRODUCT BEATS. These moves must still land smoothly, with a clear settle at the end — quick, but never shaky or jerky.
- Framing may subtly evolve to increase intimacy or focus, guided by the scene and the product.
- Avoid static shots, but keep everything smooth and coherent.
- The camera is on a fixed tripod. Whether she holds a phone or not must match exactly what the reference frame shows — never add or remove a phone that isn't already in the frame.

INFLUENCER BEHAVIOR:
- The influencer behaves naturally, as if recording a real casual video.
- Relaxed posture, soft gestures, small head movements, natural blinking, and micro-expressions.
- Starting pose: {{pose}}
- No exaggerated acting or sales performance.

INFLUENCER SPEECH (Portuguese only) — SHOULD BE THE SAME WORD BY WORD AS BELOW:
"{{copy_trecho}}"
- Speech must sound spontaneous, with light pauses, natural rhythm, and a soft Brazilian Portuguese accent.
- Tone is friendly, curious, and confident — never scripted or forced.
- Do not add, remove, or reorder any word.

SPEECH-SYNCED PRODUCT BEATS (CRITICAL — image must follow the words):
Every time the influencer names a specific feature, the camera and her hands must SHOW that exact feature at that exact moment. The visual lands ON the word, not before and not after. Each detail shot holds for about 1 second, then returns to the wider framing.

{{speech_beats}}

Timing rule: the hand gesture starts a fraction BEFORE the word and the camera move lands ON the word. Never let her name a feature while the camera stays wide — a named feature that isn't shown is a failed shot.

PRODUCT INTERACTION:
- The product must stay pixel-consistent with the reference frame at all times. Never invent, add, or remove product features — no new pockets, buttons, zippers, seams, patterns, logos, or texture that isn't already visible in the reference frame.
- Her skin must stay pixel-consistent with the reference frame too. Never invent, add, or remove tattoos, marks, scars, or piercings that aren't already visible in the reference frame; a real one only shows on exposed skin, never on top of or through clothing.
- Her clothing stays plain and pixel-consistent with the reference frame too. Never print, embroider, or draw a graphic, pattern, necklace, charm, or decoration onto the fabric that isn't already there.
- If a phone is visible in her hand (matching the reference frame), its screen stays off or black for the entire video — never show an app, photo, thumbnail, or any interface on it.
- If touched or held, hand pressure, grip, and movement must be realistic and proportional.
- Hands must never cover the feature being named — they frame it, brush alongside it, or gesture toward it, always leaving the detail visible to camera.
- Correct human anatomy at all times, in every frame: exactly two arms, two hands, five fingers per hand, one head — never an extra or missing limb, hand, finger, or body part, even briefly during fast motion or hand gestures.
- No distortion, no scale changes, no visual artifacts.

GENERAL GUIDELINES:
- Let realism guide every decision.
- Keep the video clean, modern, human, and believable.
- Absolutely no on-screen text, captions, or subtitles of any kind, and no inserted image, logo, sticker, graphic, or animation composited over the footage — the video must be pure camera footage, nothing overlaid on top.
- The result should feel like a real person recording a real moment — not an ad.

LAST FRAME CHECK (verify before finishing): in the very last frame of the video, {{ancoragem_frame_final}}, her clothing still has no printed graphic or decoration beyond the reference frame, and her skin still shows no invented tattoo or mark. The shot must never end with a changed appearance.`;

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
