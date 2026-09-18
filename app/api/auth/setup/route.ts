import { env } from "cloudflare:workers";
import { getD1 } from "@/db";
import { checkSameOrigin, seedSchool } from "@/lib/server/context";
import { hashPassword } from "@/lib/server/passwords";
import { buildSessionCookieHeader, createSessionCookieValue, getSessionSecret } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function redirectTo(path: string, status = 303): Response {
  return new Response(null, { status, headers: { Location: path, "Cache-Control": "no-store, private" } });
}

export async function POST(request: Request): Promise<Response> {
  try {
    checkSameOrigin(request);
  } catch {
    return redirectTo("/setup?error=1");
  }

  const secret = getSessionSecret(env as { SESSION_SECRET?: string });
  const db = getD1();

  // Evita seed duplicado se o formulário for reenviado ou duas abas chegarem juntas.
  const existing = await db.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (existing) return redirectTo("/login");

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!name || !email || password.length < 8) return redirectTo("/setup?error=1");

  const identitySubject = `local:${crypto.randomUUID()}`;
  const passwordHash = await hashPassword(password);

  try {
    await seedSchool(db, { userId: identitySubject, email, displayName: name }, passwordHash);
  } catch {
    return redirectTo("/setup?error=1");
  }

  const cookieValue = await createSessionCookieValue({ sub: identitySubject, email, name }, secret);
  const url = new URL(request.url);
  const response = redirectTo("/");
  response.headers.append(
    "Set-Cookie",
    buildSessionCookieHeader(cookieValue, { secure: url.protocol === "https:" }),
  );
  return response;
}
