import { describe, expect, it } from "vitest";
import { LoginRateLimiter } from "./rate-limit";

describe("LoginRateLimiter", () => {
  it("bloqueia a sexta falha por quinze minutos", () => {
    const limiter = new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 });
    for (let index = 0; index < 5; index += 1) limiter.recordFailure("127.0.0.1", index);

    expect(limiter.check("127.0.0.1", 5).allowed).toBe(false);
  });

  it("libera o IP quando a janela expira", () => {
    const limiter = new LoginRateLimiter({ maxAttempts: 1, windowMs: 1_000 });
    limiter.recordFailure("127.0.0.1", 0);

    expect(limiter.check("127.0.0.1", 1_000).allowed).toBe(true);
  });

  it("limita a quantidade de buckets para impedir crescimento ilimitado", () => {
    const limiter = new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000, maxBuckets: 2 });
    limiter.recordFailure("primeiro", 1);
    limiter.recordFailure("segundo", 2);
    limiter.recordFailure("terceiro", 3);

    expect(limiter.bucketCount()).toBe(2);
    expect(limiter.check("primeiro", 3).allowed).toBe(true);
  });
});
