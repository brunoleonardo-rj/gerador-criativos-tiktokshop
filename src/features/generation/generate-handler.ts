import "server-only";
import { createHash } from "node:crypto";
import { generationInputSchema } from "./schema";
import { warnUnexpectedFailure, type GenerationService } from "./service";
import { GenerationFailure, type GenerationErrorCode } from "./anthropic-port";
import type { GenerationImage } from "./prompt-builder";
import {
  collectImageFields,
  parseBoundedMultipart,
  UploadRequestFailure,
} from "../uploads/server-images";

export const MAX_BODY_BYTES = 56 * 1024 * 1024;
export const GENERATION_TIMEOUT_MS = 300_000;
export const GENERATION_ATTEMPT_TTL_MS = 5 * 60_000;
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const imageSpecs = {
  product: { min: 0, max: 8 },
  ad: { min: 0, max: 5 },
  ugc: { min: 0, max: 5 },
} as const;
type ServiceApi = Pick<GenerationService, "generate">;
type Dependencies = { service: ServiceApi; requireSession: (request: Request) => Promise<unknown>; enforceSameOrigin: (request: Request) => void };
type GenerationValue = Awaited<ReturnType<ServiceApi["generate"]>>;
type AttemptOutcome = { ok: true; value: GenerationValue } | { ok: false; code: GenerationErrorCode };
type Attempt = { fingerprint: string; expiresAt: number; outcome: Promise<AttemptOutcome> };

function uploadFailureResponse(error: unknown): Response {
  const code =
    error instanceof UploadRequestFailure ? error.code : "INVALID_REQUEST";
  return Response.json(
    { code, message: "Solicitação inválida." },
    { status: code === "PAYLOAD_TOO_LARGE" ? 413 : 422 },
  );
}
function errorResponse(code: GenerationErrorCode): Response {
  const status: Record<GenerationErrorCode, number> = { API_NOT_CONFIGURED: 409, INVALID_API_KEY: 401, MODEL_NOT_FOUND: 409, RATE_LIMITED: 429, REFUSAL: 422, TIMEOUT: 504, INVALID_MODEL_OUTPUT: 502, UPSTREAM_UNAVAILABLE: 503 };
  return Response.json({ code, message: "Não foi possível gerar os criativos." }, { status: status[code] });
}
function attemptResponse(outcome: AttemptOutcome): Response {
  return outcome.ok ? Response.json(outcome.value) : errorResponse(outcome.code);
}
function fingerprint(input: unknown, images: GenerationImage[]): string {
  const hash = createHash("sha256").update(JSON.stringify(input));
  for (const image of images) hash.update(image.role).update(image.mediaType).update(image.data);
  return hash.digest("hex");
}
export function makeGenerateHandler(deps: Dependencies) {
  const attempts = new Map<string, Attempt>();
  return async (request: Request): Promise<Response> => {
    try { await deps.requireSession(request); } catch { return new Response(null, { status: 401 }); }
    try { deps.enforceSameOrigin(request); } catch { return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 403 }); }
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    let form: FormData;
    try { form = await parseBoundedMultipart(request, MAX_BODY_BYTES); } catch (error) { return uploadFailureResponse(error); }
    const payload = form.getAll("payload");
    if (payload.length !== 1 || typeof payload[0] !== "string") return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 });
    let input;
    try { input = generationInputSchema.parse(JSON.parse(payload[0])); } catch { return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 }); }
    const requestIds = form.getAll("requestId");
    if (requestIds.length > 1 || (requestIds.length === 1 && (typeof requestIds[0] !== "string" || !requestIdPattern.test(requestIds[0])))) return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 });
    const requestId = requestIds.length === 1 ? requestIds[0] as string : null;
    let validatedImages;
    try { validatedImages = await collectImageFields(form, imageSpecs, ["payload", "requestId"]); } catch (error) { return uploadFailureResponse(error); }
    const images: GenerationImage[] = [];
    for (const image of validatedImages) {
      if (image.field === "product") {
        images.push({ role: image.field, mediaType: image.mediaType, data: image.data });
      }
    }
    const execute = async (): Promise<AttemptOutcome> => {
      const signal = AbortSignal.timeout(GENERATION_TIMEOUT_MS);
      try { return { ok: true, value: await deps.service.generate({ input, images }, signal) }; }
      catch (error) {
        if (!(error instanceof GenerationFailure)) warnUnexpectedFailure("handler", error);
        return { ok: false, code: error instanceof GenerationFailure ? error.code : "UPSTREAM_UNAVAILABLE" };
      }
    };
    if (!requestId) return attemptResponse(await execute());

    const now = Date.now();
    for (const [id, attempt] of attempts) if (attempt.expiresAt <= now) attempts.delete(id);
    const currentFingerprint = fingerprint(input, images);
    const existing = attempts.get(requestId);
    if (existing) {
      if (existing.fingerprint !== currentFingerprint) return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 });
      return attemptResponse(await existing.outcome);
    }
    const outcome = execute();
    attempts.set(requestId, { fingerprint: currentFingerprint, expiresAt: now + GENERATION_ATTEMPT_TTL_MS, outcome });
    return attemptResponse(await outcome);
  };
}
