import { authenticateAdmin, type AdminCredentials } from "./credentials";
import { LoginRateLimiter } from "./rate-limit";
import { enforceSameOrigin } from "./request-guard";
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "./session";

const FAILURE_MESSAGE = "Credenciais inválidas ou acesso temporariamente bloqueado";

export type AddressResolver = (request: Request) => string;

export const trustedAddressResolver: AddressResolver = (request) =>
  request.headers.get("x-trusted-client-ip")?.trim() || "proxy-unidentified";

function hasJsonContentType(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
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
      const body: unknown = await request.json();
      if (
        !body ||
        typeof body !== "object" ||
        typeof (body as Record<string, unknown>).username !== "string" ||
        typeof (body as Record<string, unknown>).password !== "string"
      ) {
        throw new Error("Invalid body");
      }
      credentials = body as AdminCredentials;
    } catch {
      deps.limiter.recordFailure(key);
      deps.globalLimiter.recordFailure("global");
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
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return new Response(null, {
      status: 204,
      headers: {
        "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; SameSite=Strict${secure}`,
      },
    });
  };
}
