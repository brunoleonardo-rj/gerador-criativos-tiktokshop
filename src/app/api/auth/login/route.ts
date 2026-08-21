import { getServerEnv } from "@/lib/env";
import { makeLoginHandler } from "@/features/auth/login-handler";
import { LoginRateLimiter } from "@/features/auth/rate-limit";

const limiter = new LoginRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1_000 });

export async function POST(request: Request) {
  const env = getServerEnv();
  return makeLoginHandler({
    expected: { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD },
    secret: env.AUTH_SECRET,
    limiter,
  })(request);
}
