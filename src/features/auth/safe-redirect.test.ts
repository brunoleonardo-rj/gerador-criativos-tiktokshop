import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("aceita somente caminho interno com query e hash", () => {
    expect(safeRedirect("/resultado/123?aba=copy#veo")).toBe("/resultado/123?aba=copy#veo");
  });

  it("rejeita URL protocol-relative", () => {
    expect(safeRedirect("//evil.example/steal")).toBe("/");
  });

  it("rejeita URL absoluta de outra origem", () => {
    expect(safeRedirect("https://evil.example/steal")).toBe("/");
  });
});
