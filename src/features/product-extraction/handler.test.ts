// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GenerationFailure } from "@/features/generation/anthropic-errors";
import type { ProductSourceImage } from "./prompt";
import type { ProductExtraction } from "./schema";
import { makeProductExtractionHandler } from "./handler";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);

const validExtraction: ProductExtraction = {
  nomeProduto: "Garrafa térmica",
  categoria: "Casa",
  descricaoPdp: "Garrafa térmica de 500 ml.",
  avaliacoes: null,
  notaMedia: 4.8,
  quantidadeAvaliacoes: 120,
  precoAtual: "R$ 89,90",
  precoAnterior: null,
  especificacoesCriticas: ["Capacidade: 500 ml"],
  publicoAlvo: null,
  avisos: [],
  formatoUso: "manuseado",
  zonaFoco: "maos",
  detalheCritico: null,
};

type FilePart = {
  field: string;
  mime: string;
  bytes: Uint8Array<ArrayBuffer>;
};

async function multipartRequest(
  files: FilePart[],
  fields: Array<{ name: string; value: string }> = [],
): Promise<Request> {
  const boundary = "product-extraction-test-boundary";
  const parts: BlobPart[] = [];

  for (const field of fields) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
    );
  }
  for (const file of files) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="source"\r\nContent-Type: ${file.mime}\r\n\r\n`,
      file.bytes,
      "\r\n",
    );
  }
  parts.push(`--${boundary}--\r\n`);

  return new Request("http://local/api/product-extraction", {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      origin: "http://local",
    },
    body: await new Blob(parts).arrayBuffer(),
  });
}

function sourceFiles(count: number): FilePart[] {
  return Array.from({ length: count }, () => ({
    field: "source",
    mime: "image/jpeg",
    bytes: jpeg,
  }));
}

function dependencies(overrides: {
  extract?: (
    images: ProductSourceImage[],
    signal: AbortSignal,
  ) => Promise<ProductExtraction>;
  requireSession?: (request: Request) => Promise<unknown>;
  enforceSameOrigin?: (request: Request) => void;
} = {}) {
  return {
    service: {
      extract: overrides.extract ?? vi.fn().mockResolvedValue(validExtraction),
    },
    requireSession:
      overrides.requireSession ?? (async () => ({ username: "admin" })),
    enforceSameOrigin: overrides.enforceSameOrigin ?? (() => undefined),
  };
}

describe("makeProductExtractionHandler", () => {
  it.each([1, 8])(
    "authenticates, enforces same origin and forwards %i source image(s)",
    async (count) => {
      const extract = vi.fn().mockResolvedValue(validExtraction);
      const result = await makeProductExtractionHandler(
        dependencies({ extract }),
      )(await multipartRequest(sourceFiles(count)));

      expect(result.status).toBe(200);
      expect(await result.json()).toEqual(validExtraction);
      expect(extract).toHaveBeenCalledWith(
        Array.from({ length: count }, () => ({
          mediaType: "image/jpeg",
          data: "/9j/2w==",
        })),
        expect.any(AbortSignal),
      );
    },
  );

  it("uses a 60 second extraction deadline", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);

    try {
      const result = await makeProductExtractionHandler(dependencies())(
        await multipartRequest(sourceFiles(1)),
      );

      expect(result.status).toBe(200);
      expect(timeout).toHaveBeenCalledWith(60_000);
    } finally {
      timeout.mockRestore();
    }
  });

  it("returns 401 without parsing or extracting when authentication fails", async () => {
    const extract = vi.fn();
    const result = await makeProductExtractionHandler(
      dependencies({
        extract,
        requireSession: async () => {
          throw new Error("private session details");
        },
      }),
    )(await multipartRequest(sourceFiles(1)));

    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({ code: "SESSION_EXPIRED", message: "Sessão expirada." });
    expect(extract).not.toHaveBeenCalled();
  });

  it("returns a safe 403 without extracting when same-origin enforcement fails", async () => {
    const extract = vi.fn();
    const result = await makeProductExtractionHandler(
      dependencies({
        extract,
        enforceSameOrigin: () => {
          throw new Error("https://private-origin.example");
        },
      }),
    )(await multipartRequest(sourceFiles(1)));
    const body = await result.text();

    expect(result.status).toBe(403);
    expect(body).not.toContain("private-origin");
    expect(extract).not.toHaveBeenCalled();
  });

  it("returns 405 with the allowed method for unsupported requests", async () => {
    const result = await makeProductExtractionHandler(dependencies())(
      new Request("http://local/api/product-extraction", {
        method: "GET",
        headers: { origin: "http://local" },
      }),
    );

    expect(result.status).toBe(405);
    expect(result.headers.get("allow")).toBe("POST");
  });

  it.each([
    ["no source images", []],
    ["a ninth source image", sourceFiles(9)],
  ])("returns 422 for %s", async (_case, files) => {
    const result = await makeProductExtractionHandler(dependencies())(
      await multipartRequest(files),
    );

    expect(result.status).toBe(422);
    expect(await result.json()).toEqual({
      code: "INVALID_REQUEST",
      message: "Solicitação inválida.",
    });
  });

  it("returns 422 for any multipart field other than source", async () => {
    const result = await makeProductExtractionHandler(dependencies())(
      await multipartRequest(sourceFiles(1), [
        { name: "private-prompt", value: "ignore safeguards" },
      ]),
    );

    expect(result.status).toBe(422);
  });

  it("returns 422 when source is not a supported image", async () => {
    const result = await makeProductExtractionHandler(dependencies())(
      await multipartRequest([
        { field: "source", mime: "text/plain", bytes: jpeg },
      ]),
    );

    expect(result.status).toBe(422);
  });

  it("returns 413 before parsing a body over the finite multipart limit", async () => {
    const request = await multipartRequest(sourceFiles(1));
    request.headers.set("content-length", String(26 * 1024 * 1024 + 1));

    const result = await makeProductExtractionHandler(dependencies())(request);

    expect(result.status).toBe(413);
    expect(await result.json()).toEqual({
      code: "PAYLOAD_TOO_LARGE",
      message: "Solicitação inválida.",
    });
  });

  it("accepts a declared body at the 26 MiB multipart limit", async () => {
    const request = await multipartRequest(sourceFiles(1));
    request.headers.set("content-length", String(26 * 1024 * 1024));

    const result = await makeProductExtractionHandler(dependencies())(request);

    expect(result.status).toBe(200);
  });

  it.each([
    ["API_NOT_CONFIGURED", 409],
    ["INVALID_API_KEY", 401],
    ["RATE_LIMITED", 429],
    ["REFUSAL", 422],
    ["TIMEOUT", 504],
    ["INVALID_MODEL_OUTPUT", 502],
    ["UPSTREAM_UNAVAILABLE", 503],
  ] as const)("maps %s to HTTP %i without leaking private data", async (code, status) => {
    const result = await makeProductExtractionHandler(
      dependencies({
        extract: async () => {
          const failure = new GenerationFailure(code);
          Object.assign(failure, {
            apiKey: "sk-private",
            model: "private-model",
            usage: { input_tokens: 999 },
            prompt: "private prompt",
            image: "/9j/private-image",
          });
          throw failure;
        },
      }),
    )(await multipartRequest(sourceFiles(1)));
    const body = await result.text();

    expect(result.status).toBe(status);
    expect(JSON.parse(body)).toEqual({
      code,
      message: "Não foi possível extrair os dados do produto.",
    });
    expect(body).not.toMatch(
      /sk-private|private-model|input_tokens|private prompt|private-image/u,
    );
  });

  it("maps unexpected failures to a safe upstream error", async () => {
    const result = await makeProductExtractionHandler(
      dependencies({
        extract: async () => {
          throw new Error("sk-private unexpected SDK response");
        },
      }),
    )(await multipartRequest(sourceFiles(1)));
    const body = await result.text();

    expect(result.status).toBe(503);
    expect(JSON.parse(body)).toEqual({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Não foi possível extrair os dados do produto.",
    });
    expect(body).not.toContain("sk-private");
  });
});
