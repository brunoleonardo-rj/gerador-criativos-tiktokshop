import "server-only";
import { generationInputSchema } from "./schema";
import type { GenerationService } from "./service";
import { GenerationFailure, type GenerationErrorCode } from "./anthropic-port";
import type { GenerationImage } from "./prompt-builder";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_BODY_BYTES = 56 * 1024 * 1024;
const roles = { product: { max: 8, forward: true }, ad: { max: 5, forward: true }, ugc: { max: 5, forward: false } } as const;
const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
class PayloadTooLarge extends Error {}
class InvalidRequest extends Error {}
type ServiceApi = Pick<GenerationService, "generate">;
type Dependencies = { service: ServiceApi; requireSession: (request: Request) => Promise<unknown>; enforceSameOrigin: (request: Request) => void };

async function readBounded(request: Request): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/u.test(declared) && Number(declared) > MAX_BODY_BYTES) throw new PayloadTooLarge();
  if (!request.body) throw new InvalidRequest();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new PayloadTooLarge(); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; } return body;
}
function matchesMagic(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (mime === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}
async function parseForm(request: Request): Promise<FormData> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw new InvalidRequest();
  await readBounded(request.clone());
  try { return await request.formData(); } catch { throw new InvalidRequest(); }
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
    try { form = await parseForm(request); } catch (error) { return Response.json({ code: error instanceof PayloadTooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST", message: "Solicitação inválida." }, { status: error instanceof PayloadTooLarge ? 413 : 422 }); }
    const payload = form.getAll("payload");
    if (payload.length !== 1 || typeof payload[0] !== "string") return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 });
    let input;
    try { input = generationInputSchema.parse(JSON.parse(payload[0])); } catch { return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 }); }
    const images: GenerationImage[] = []; const counts: Record<keyof typeof roles, number> = { product: 0, ad: 0, ugc: 0 };
    for (const [name, value] of form.entries()) {
      if (name === "payload") continue;
      if (!(name in roles) || typeof value === "string") return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 });
      const role = name as keyof typeof roles; counts[role] += 1;
      if (counts[role] > roles[role].max || value.size > MAX_FILE_BYTES || !mimeTypes.has(value.type)) return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 });
      const bytes = new Uint8Array(await value.arrayBuffer());
      if (!matchesMagic(bytes, value.type)) return Response.json({ code: "INVALID_REQUEST", message: "Solicitação inválida." }, { status: 422 });
      if (role !== "ugc") images.push({ role, mediaType: value.type as GenerationImage["mediaType"], data: Buffer.from(bytes).toString("base64") });
    }
    const signal = AbortSignal.timeout(100_000);
    try { return Response.json(await deps.service.generate({ input, images }, signal)); }
    catch (error) { return errorResponse(error instanceof GenerationFailure ? error.code : "UPSTREAM_UNAVAILABLE"); }
  };
}
