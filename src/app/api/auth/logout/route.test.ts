// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    process.env = {
      ...process.env,
      NODE_ENV: "test",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "senha-segura",
      AUTH_SECRET: "s".repeat(32),
      SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    };
  });

  it("rejeita logout sem sessão", async () => {
    const response = await POST(new Request("http://local/api/auth/logout", { method: "POST", headers: { origin: "http://local" } }));

    expect(response.status).toBe(401);
  });

  it("expira cookie estrito após logout autenticado", async () => {
    const { createSessionToken, SESSION_COOKIE } = await import("@/features/auth/session");
    const token = await createSessionToken({ username: "admin" }, process.env.AUTH_SECRET!);
    const response = await POST(new Request("http://local/api/auth/logout", { method: "POST", headers: { origin: "http://local", cookie: `${SESSION_COOKIE}=${token}` } }));

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Strict/);
  });
});
