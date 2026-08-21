import { enforceSameOrigin } from "@/features/auth/request-guard";
import { SESSION_COOKIE } from "@/features/auth/session";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
  } catch {
    return Response.json({ message: "Solicitação inválida" }, { status: 403 });
  }
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}` },
  });
}
