import { env } from "cloudflare:workers";
import { getD1 } from "@/db";
import { checkSameOrigin } from "@/lib/server/context";
import { verifyPassword } from "@/lib/server/passwords";
import { buildSessionCookieHeader, createSessionCookieValue, getSessionSecret } from "@/lib/server/session";
import { loginPath } from "@/app/auth";

export const dynamic = "force-dynamic";

function redirectTo(path: string, status = 303): Response {
  return new Response(null, { status, headers: { Location: path, "Cache-Control": "no-store, private" } });
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") || "/";

  try {
    checkSameOrigin(request);
  } catch {
    return redirectTo(loginPath(returnTo) + "&error=1");
  }

  const secret = getSessionSecret(env as { SESSION_SECRET?: string });
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) return redirectTo(loginPath(returnTo) + "&error=1");

  const db = getD1();
  const school = await db.prepare("SELECT id FROM schools ORDER BY created_at LIMIT 1").first<{ id: string }>();
  if (!school) return redirectTo(loginPath(returnTo) + "&error=1");

  const user = await db
    .prepare(
      "SELECT id, identity_subject, email, display_name, password_hash FROM users WHERE school_id = ? AND email = ? AND status = 'ACTIVE' LIMIT 1",
    )
    .bind(school.id, email)
    .first<{ id: string; identity_subject: string; email: string; display_name: string; password_hash: string | null }>();

  // Mensagem genérica em ambos os casos (usuário inexistente ou senha errada) para não vazar quais e-mails existem.
  const invalid = !user || !(await verifyPassword(password, user.password_hash));
  if (invalid) return redirectTo(loginPath(returnTo) + "&error=1");

  const cookieValue = await createSessionCookieValue(
    { sub: user!.identity_subject, email: user!.email, name: user!.display_name },
    secret,
  );

  const response = redirectTo(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
  response.headers.append(
    "Set-Cookie",
    buildSessionCookieHeader(cookieValue, { secure: url.protocol === "https:" }),
  );
  await db
    .prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(user!.id)
    .run();
  return response;
}
