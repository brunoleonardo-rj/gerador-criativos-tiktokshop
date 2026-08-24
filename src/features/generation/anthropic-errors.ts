export type GenerationErrorCode = "API_NOT_CONFIGURED" | "INVALID_API_KEY" | "RATE_LIMITED" | "REFUSAL" | "TIMEOUT" | "INVALID_MODEL_OUTPUT" | "UPSTREAM_UNAVAILABLE";

export class GenerationFailure extends Error {
  constructor(readonly code: GenerationErrorCode) {
    super(code);
  }
}

export function failureForAnthropic(error: unknown, signal: AbortSignal): GenerationFailure {
  if (error instanceof GenerationFailure) return error;
  if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return new GenerationFailure("TIMEOUT");
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status?: unknown }).status : undefined;
  if (status === 401 || status === 403) return new GenerationFailure("INVALID_API_KEY");
  if (status === 429) return new GenerationFailure("RATE_LIMITED");
  return new GenerationFailure("UPSTREAM_UNAVAILABLE");
}
