import "server-only";
import { generationInputSchema } from "./schema";
import type { GenerationService } from "./service";
import { GenerationFailure, type GenerationErrorCode } from "./anthropic-port";
import type { GenerationImage } from "./prompt-builder";
import {
  collectImageFields,
  parseBoundedMultipart,
  UploadRequestFailure,
} from "../uploads/server-images";

export const MAX_BODY_BYTES = 56 * 1024 * 1024;
export const GENERATION_TIMEOUT_MS = 300_000;
const imageSpecs = {
  product: { min: 0, max: 8 },
  ad: { min: 0, max: 5 },
  ugc: { min: 0, max: 5 },
} as const;
type ServiceApi = Pick<GenerationService, "generate">;
type Dependencies = { service: ServiceApi; requireSession: (request: Request) => Promise<unknown>; enforceSameOrigin: (request: Request) => void };

function uploadFailureResponse(error: unknown): Response {
  const code =
    error instanceof UploadRequestFailure ? error.code : "INVALID_REQUEST";
  return Response.json(
    { code, message: "Solicitação inválida." },
    { status: code === "PAYLOAD_TOO_LARGE" ? 413 : 422 },
  );
}
function errorResponse(code: GenerationErrorCode): Response {
  const status: Record<GenerationErrorCode, number> = { API_NOT_CONFIGURED: 409, INVALID_API_KEY: 401, RATE_LIMITED: 429, REFUSAL: 422, TIMEOUT: 504, INVALID_MODEL_OUTPUT: 502, UPSTREAM_UNAVAILABLE: 503 };
  return Response.json({ code, message: "Não foi possível gerar os criativos." }, { status: status[code] });
}
export function makeGenerateHandler(deps: Dependencies) {
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
    let validatedImages;
    try { validatedImages = await collectImageFields(form, imageSpecs, ["payload"]); } catch (error) { return uploadFailureResponse(error); }
    const images: GenerationImage[] = [];
    for (const image of validatedImages) {
      if (image.field === "product" || image.field === "ad") {
        images.push({ role: image.field, mediaType: image.mediaType, data: image.data });
      }
    }
    const signal = AbortSignal.timeout(GENERATION_TIMEOUT_MS);
    try { return Response.json(await deps.service.generate({ input, images }, signal)); }
    catch (error) { return errorResponse(error instanceof GenerationFailure ? error.code : "UPSTREAM_UNAVAILABLE"); }
  };
}
