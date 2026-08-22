// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getServerEnv } from "@/lib/env";

describe("nginx proxy example", () => {
  it("mantém o upstream em loopback e sobrescreve os cabeçalhos confiáveis", () => {
    const config = readFileSync(path.resolve(process.cwd(), "deploy/nginx/gerador-criativos.conf.example"), "utf8");

    expect(config).toMatch(/proxy_pass\s+http:\/\/127\.0\.0\.1:3000/);
    expect(config).toMatch(/client_max_body_size\s+16k;/);
    expect(config).toMatch(/location\s+=\s+\/api\/auth\/login\s*\{[^}]*client_max_body_size\s+16k;/);
    expect(config).toMatch(/location\s+=\s+\/api\/settings\s*\{[^}]*client_max_body_size\s+24k;/);
    expect(config).toMatch(/location\s+=\s+\/api\/generate\s*\{[^}]*client_max_body_size\s+60m;/);
    expect(config).toMatch(/location\s+=\s+\/api\/library\/import\s*\{[^}]*client_max_body_size\s+60m;/);
    expect(config).toMatch(/proxy_read_timeout\s+120s;/);
    expect(config).toMatch(/proxy_set_header\s+X-Trusted-Client-IP\s+\$remote_addr;/);
    const match = config.match(/proxy_set_header\s+X-Trusted-Proxy-Secret\s+([^;]+);/);
    expect(match?.[1]).toBe("REPLACE_ME");
    expect(() =>
      getServerEnv({
        NODE_ENV: "test",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "senha-segura",
        AUTH_SECRET: "a".repeat(32),
        TRUSTED_PROXY_SECRET: match?.[1],
        SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      }),
    ).toThrow(/TRUSTED_PROXY_SECRET/);
  });
});
