import "server-only";
import {
  GenerationFailure,
  type GenerationErrorCode,
} from "@/features/generation/anthropic-errors";
import type { ProductSourceImage } from "./prompt";
import type { ProductExtractionService } from "./service";
import {
  collectImageFields,
  parseBoundedMultipart,
  UploadRequestFailure,
} from "@/features/uploads/server-images";

export const MAX_PRODUCT_EXTRACTION_BODY_BYTES = 26 * 1024 * 1024;

type ProductExtractionApi = Pick<ProductExtractionService, "extract">;

type Dependencies = {
  service: ProductExtractionApi;
  requireSession: (request: Request) => Promise<unknown>;
  enforceSameOrigin: (request: Request) => void;
};

const sourceImageSpecs = {
  source: { min: 1, max: 8 },
} as const;

const extractionFailureStatuses: Record<GenerationErrorCode, number> = {
  API_NOT_CONFIGURED: 409,
  INVALID_API_KEY: 401,
  RATE_LIMITED: 429,
  REFUSAL: 422,
  TIMEOUT: 504,
  INVALID_MODEL_OUTPUT: 502,
  UPSTREAM_UNAVAILABLE: 503,
};

function invalidRequestResponse(status = 422): Response {
  return Response.json(
    { code: "INVALID_REQUEST", message: "Solicitação inválida." },
    { status },
  );
}

function uploadFailureResponse(error: unknown): Response {
  const code =
    error instanceof UploadRequestFailure ? error.code : "INVALID_REQUEST";
  return Response.json(
    { code, message: "Solicitação inválida." },
    { status: code === "PAYLOAD_TOO_LARGE" ? 413 : 422 },
  );
}

function extractionFailureResponse(code: GenerationErrorCode): Response {
  return Response.json(
    {
      code,
      message: "Não foi possível extrair os dados do produto.",
    },
    { status: extractionFailureStatuses[code] },
  );
}

export function makeProductExtractionHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    try {
      await deps.requireSession(request);
    } catch {
      return new Response(null, { status: 401 });
    }

    try {
      deps.enforceSameOrigin(request);
    } catch {
      return invalidRequestResponse(403);
    }

    if (request.method !== "POST") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    let form: FormData;
    try {
      form = await parseBoundedMultipart(
        request,
        MAX_PRODUCT_EXTRACTION_BODY_BYTES,
      );
    } catch (error) {
      return uploadFailureResponse(error);
    }

    let images: ProductSourceImage[];
    try {
      images = (await collectImageFields(form, sourceImageSpecs, [])).map(
        ({ mediaType, data }) => ({ mediaType, data }),
      );
    } catch (error) {
      return uploadFailureResponse(error);
    }

    try {
      const extraction = await deps.service.extract(
        images,
        AbortSignal.timeout(60_000),
      );
      return Response.json(extraction);
    } catch (error) {
      const code =
        error instanceof GenerationFailure
          ? error.code
          : "UPSTREAM_UNAVAILABLE";
      return extractionFailureResponse(code);
    }
  };
}
