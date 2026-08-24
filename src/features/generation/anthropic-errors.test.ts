import { expect, it } from "vitest";
import { failureForAnthropic } from "./anthropic-errors";

it.each([[400, "INVALID_MODEL_OUTPUT"], [401, "INVALID_API_KEY"], [403, "INVALID_API_KEY"], [429, "RATE_LIMITED"]] as const)(
  "maps status %s to %s",
  (status, code) => {
    expect(failureForAnthropic({ status }, new AbortController().signal)).toMatchObject({ code });
  },
);
