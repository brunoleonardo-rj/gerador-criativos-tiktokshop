import { getServerEnv } from "@/lib/env";
import { makeLoginHandler } from "@/features/auth/login-handler";
import { LoginRateLimiter } from "@/features/auth/rate-limit";
import { createTrustedAddressResolver } from "@/features/auth/trusted-address";

const limiter = new LoginRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1_000 });
const globalLimiter = new LoginRateLimiter({ maxAttempts: 20, windowMs: 15 * 60 * 1_000, maxBuckets: 1 });

export async function POST(request: Request) {
  const env = getServerEnv();
  return makeLoginHandler({
    expected: { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD },
    secret: env.AUTH_SECRET,
    limiter,
    globalLimiter,
    resolveAddress: createTrustedAddressResolver(env.TRUSTED_PROXY_SECRET),
  })(request);
}
