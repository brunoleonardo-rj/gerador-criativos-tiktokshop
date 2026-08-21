export class LoginRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly options: { maxAttempts: number; windowMs: number }) {}

  check(key: string, now = Date.now()) {
    const failures = this.activeFailures(key, now);
    return { allowed: failures.length < this.options.maxAttempts };
  }

  recordFailure(key: string, now = Date.now()) {
    const failures = this.activeFailures(key, now);
    failures.push(now);
    this.buckets.set(key, failures);
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private activeFailures(key: string, now: number) {
    const since = now - this.options.windowMs;
    const failures = (this.buckets.get(key) ?? []).filter((attemptedAt) => attemptedAt > since);
    if (failures.length === 0) this.buckets.delete(key);
    else this.buckets.set(key, failures);
    return failures;
  }
}
