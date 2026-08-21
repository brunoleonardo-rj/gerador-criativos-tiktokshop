export function safeRedirect(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  const target = new URL(next, "http://local");
  return target.origin === "http://local" ? `${target.pathname}${target.search}${target.hash}` : "/";
}
