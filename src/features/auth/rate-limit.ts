export class LoginRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly options: { maxAttempts: number; windowMs: number; maxBuckets?: number }) {}

  check(key: string, now = Date.now()) {
    const failures = this.activeFailures(key, now);
    return { allowed: failures.length < this.options.maxAttempts };
  }

  recordFailure(key: string, now = Date.now()) {
    const failures = this.activeFailures(key, now);
    this.evictFor(key);
    failures.push(now);
    this.buckets.set(key, failures);
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  bucketCount() {
    return this.buckets.size;
  }

  private activeFailures(key: string, now: number) {
    const since = now - this.options.windowMs;
    const failures = (this.buckets.get(key) ?? []).filter((attemptedAt) => attemptedAt > since);
    if (failures.length === 0) this.buckets.delete(key);
    else this.buckets.set(key, failures);
    return failures;
  }

  private evictFor(key: string) {
    if (this.buckets.has(key)) return;
    const maxBuckets = this.options.maxBuckets ?? 10_000;
    while (this.buckets.size >= maxBuckets) {
      const oldest = [...this.buckets.entries()].reduce<string | undefined>((candidate, [bucketKey, attempts]) => {
        if (!candidate) return bucketKey;
        const candidateLastAttempt = this.buckets.get(candidate)?.at(-1) ?? Number.POSITIVE_INFINITY;
        return (attempts.at(-1) ?? Number.POSITIVE_INFINITY) < candidateLastAttempt ? bucketKey : candidate;
      }, undefined);
      if (!oldest) return;
      this.buckets.delete(oldest);
    }
  }
}
