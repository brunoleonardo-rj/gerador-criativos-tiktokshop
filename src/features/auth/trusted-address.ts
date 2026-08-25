import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AddressResolver } from "./login-handler";

export const UNTRUSTED_ADDRESS = "proxy-untrusted";

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

export function hasTrustedProxyProof(request: Request, proxySecret: string) {
  const proof = request.headers.get("x-trusted-proxy-secret") ?? "";
  return timingSafeEqual(hash(proof), hash(proxySecret));
}

export function createTrustedAddressResolver(proxySecret: string): AddressResolver {
  return (request) => {
    if (!hasTrustedProxyProof(request, proxySecret)) return UNTRUSTED_ADDRESS;
    return request.headers.get("x-trusted-client-ip")?.trim() || UNTRUSTED_ADDRESS;
  };
}
