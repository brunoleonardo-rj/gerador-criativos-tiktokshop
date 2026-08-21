import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AddressResolver } from "./login-handler";

export const UNTRUSTED_ADDRESS = "proxy-untrusted";

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

export function createTrustedAddressResolver(proxySecret: string): AddressResolver {
  return (request) => {
    const proof = request.headers.get("x-trusted-proxy-secret") ?? "";
    if (!timingSafeEqual(hash(proof), hash(proxySecret))) return UNTRUSTED_ADDRESS;
    return request.headers.get("x-trusted-client-ip")?.trim() || UNTRUSTED_ADDRESS;
  };
}
