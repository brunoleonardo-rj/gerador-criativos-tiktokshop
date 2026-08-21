// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("nginx proxy example", () => {
  it("mantém o upstream em loopback e sobrescreve os cabeçalhos confiáveis", () => {
    const config = readFileSync(path.resolve(process.cwd(), "deploy/nginx/gerador-criativos.conf.example"), "utf8");

    expect(config).toMatch(/proxy_pass\s+http:\/\/127\.0\.0\.1:3100/);
    expect(config).toMatch(/proxy_set_header\s+X-Trusted-Client-IP\s+\$remote_addr;/);
    expect(config).toMatch(/proxy_set_header\s+X-Trusted-Proxy-Secret\s+REPLACE_WITH_TRUSTED_PROXY_SECRET;/);
  });
});
