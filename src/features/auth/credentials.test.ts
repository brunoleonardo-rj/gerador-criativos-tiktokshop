import { describe, expect, it } from "vitest";
import { authenticateAdmin } from "./credentials";

describe("authenticateAdmin", () => {
  it("compara credenciais sem revelar qual campo falhou", async () => {
    const expected = { username: "admin", password: "certa" };

    await expect(authenticateAdmin({ username: "admin", password: "certa" }, expected)).resolves.toBe(true);
    await expect(authenticateAdmin({ username: "admin", password: "errada" }, expected)).resolves.toBe(false);
    await expect(authenticateAdmin({ username: "outra", password: "certa" }, expected)).resolves.toBe(false);
  });
});
