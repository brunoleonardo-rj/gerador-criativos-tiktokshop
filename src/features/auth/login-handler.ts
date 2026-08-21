import { authenticateAdmin, type AdminCredentials } from "./credentials";
import { LoginRateLimiter } from "./rate-limit";
import { enforceSameOrigin } from "./request-guard";
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "./session";

const FAILURE_MESSAGE = "Credenciais inválidas ou acesso temporariamente bloqueado";

function loginKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

export function makeLoginHandler(deps: {
  expected: AdminCredentials;
  secret: string;
  limiter: LoginRateLimiter;
  now?: () => Date;
}) {
  return async function handleLogin(request: Request): Promise<Response> {
    try {
      enforceSameOrigin(request);
    } catch {
      return Response.json({ message: "Solicitação inválida" }, { status: 403 });
    }

    const key = loginKey(request);
    if (!deps.limiter.check(key).allowed) return Response.json({ message: FAILURE_MESSAGE }, { status: 401 });

    let credentials: AdminCredentials;
    try {
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
      return Response.json({ message: FAILURE_MESSAGE }, { status: 401 });
    }

    if (!(await authenticateAdmin(credentials, deps.expected))) {
      deps.limiter.recordFailure(key);
      return Response.json({ message: FAILURE_MESSAGE }, { status: 401 });
    }

    deps.limiter.reset(key);
    const now = deps.now?.() ?? new Date();
    const token = await createSessionToken({ username: deps.expected.username, now }, deps.secret);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return new Response(null, {
      status: 204,
      headers: {
        "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
      },
    });
  };
}
