// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "./session";

describe("session", () => {
  const secret = "s".repeat(32);

  it("expira a sessão depois de 12 horas", async () => {
    const token = await createSessionToken(
      { username: "admin", now: new Date("2026-08-21T10:00:00Z") },
      secret,
    );

    await expect(verifySessionToken(token, secret, new Date("2026-08-21T22:00:01Z"))).resolves.toBeNull();
  });

  it("recupera o administrador de um token válido", async () => {
    const token = await createSessionToken({ username: "admin", now: new Date("2026-08-21T10:00:00Z") }, secret);

    await expect(verifySessionToken(token, secret, new Date("2026-08-21T21:59:59Z"))).resolves.toEqual({
      username: "admin",
      expiresAt: Math.floor(Date.parse("2026-08-21T22:00:00Z") / 1_000),
    });
    expect(SESSION_COOKIE).toBe("creative_session");
  });

  it("rejeita tokens alterados", async () => {
    const token = await createSessionToken({ username: "admin" }, secret);

    await expect(verifySessionToken(`${token}x`, secret)).resolves.toBeNull();
  });
});
