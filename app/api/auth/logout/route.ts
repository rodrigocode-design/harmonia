import { checkSameOrigin } from "@/lib/server/context";
import { buildClearSessionCookieHeader } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    checkSameOrigin(request);
  } catch {
    // Mesmo se a verificação falhar, seguimos limpando o cookie no navegador do próprio usuário.
  }
  const url = new URL(request.url);
  const response = new Response(null, {
    status: 303,
    headers: { Location: "/login", "Cache-Control": "no-store, private" },
  });
  response.headers.append("Set-Cookie", buildClearSessionCookieHeader({ secure: url.protocol === "https:" }));
  return response;
}
