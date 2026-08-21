// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTrustedAddressResolver, UNTRUSTED_ADDRESS } from "./trusted-address";

describe("createTrustedAddressResolver", () => {
  const resolver = createTrustedAddressResolver("p".repeat(32));

  it("retorna uma identidade constante sem prova de proxy", () => {
    expect(resolver(new Request("http://local", { headers: { "x-trusted-client-ip": "192.0.2.1" } }))).toBe(UNTRUSTED_ADDRESS);
  });

  it("rejeita prova inválida mesmo com tamanho diferente", () => {
    for (const proof of ["curta", "x".repeat(31), "x".repeat(33)]) {
      expect(resolver(new Request("http://local", { headers: { "x-trusted-client-ip": "192.0.2.1", "x-trusted-proxy-secret": proof } }))).toBe(UNTRUSTED_ADDRESS);
    }
  });

  it("aceita endereços distintos somente com prova válida", () => {
    const first = resolver(new Request("http://local", { headers: { "x-trusted-client-ip": "192.0.2.1", "x-trusted-proxy-secret": "p".repeat(32) } }));
    const second = resolver(new Request("http://local", { headers: { "x-trusted-client-ip": "192.0.2.2", "x-trusted-proxy-secret": "p".repeat(32) } }));

    expect(first).toBe("192.0.2.1");
    expect(second).toBe("192.0.2.2");
  });
});
