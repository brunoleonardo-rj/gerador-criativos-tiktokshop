import { authenticateAdmin, type AdminCredentials } from "./credentials";
import { LoginRateLimiter } from "./rate-limit";
import { enforceSameOrigin } from "./request-guard";
import { createSessionToken, sessionCookieValue } from "./session";

const FAILURE_MESSAGE = "Credenciais inválidas ou acesso temporariamente bloqueado";
const MAX_LOGIN_JSON_BYTES = 16 * 1024;

class LoginPayloadTooLargeError extends Error {}

export type AddressResolver = (request: Request) => string;

export const trustedAddressResolver: AddressResolver = (request) =>
  request.headers.get("x-trusted-client-ip")?.trim() || "proxy-unidentified";

function hasJsonContentType(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_LOGIN_JSON_BYTES) {
    await request.body?.cancel().catch(() => undefined);
    throw new LoginPayloadTooLargeError();
  }
  if (!request.body) throw new Error("Missing body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LOGIN_JSON_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new LoginPayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function makeLoginHandler(deps: {
  expected: AdminCredentials;
  secret: string;
  limiter: LoginRateLimiter;
  globalLimiter: LoginRateLimiter;
  resolveAddress?: AddressResolver;
  now?: () => Date;
}) {
  return async function handleLogin(request: Request): Promise<Response> {
    try {
      enforceSameOrigin(request);
    } catch {
      return Response.json({ message: "Solicitação inválida" }, { status: 403 });
    }

    const key = (deps.resolveAddress ?? trustedAddressResolver)(request);
    if (!deps.limiter.check(key).allowed || !deps.globalLimiter.check("global").allowed) {
      return Response.json({ message: FAILURE_MESSAGE }, { status: 401 });
    }

    let credentials: AdminCredentials;
    try {
      if (!hasJsonContentType(request)) throw new Error("Invalid content type");
      const body: unknown = await readBoundedJson(request);
      if (
        !body ||
        typeof body !== "object" ||
        typeof (body as Record<string, unknown>).username !== "string" ||
        typeof (body as Record<string, unknown>).password !== "string"
      ) {
        throw new Error("Invalid body");
      }
      credentials = body as AdminCredentials;
    } catch (error) {
      deps.limiter.recordFailure(key);
      deps.globalLimiter.recordFailure("global");
      if (error instanceof LoginPayloadTooLargeError) {
        return Response.json({ message: "Solicitação muito grande" }, { status: 413 });
      }
      return Response.json({ message: FAILURE_MESSAGE }, { status: 401 });
    }

    if (!(await authenticateAdmin(credentials, deps.expected))) {
      deps.limiter.recordFailure(key);
      deps.globalLimiter.recordFailure("global");
      return Response.json({ message: FAILURE_MESSAGE }, { status: 401 });
    }

    deps.limiter.reset(key);
    deps.globalLimiter.reset("global");
    const now = deps.now?.() ?? new Date();
    const token = await createSessionToken({ username: deps.expected.username, now }, deps.secret);
    return new Response(null, {
      status: 204,
      headers: {
        "set-cookie": sessionCookieValue(token, process.env.NODE_ENV === "production"),
      },
    });
  };
}
