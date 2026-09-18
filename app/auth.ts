import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, getSessionSecret, verifySessionCookieValue, type SessionPayload } from "@/lib/server/session";

export type AppUser = {
  userId: string; // identity_subject local (ex.: "local:<uuid>")
  displayName: string;
  email: string;
};

const LOGIN_PATH = "/login";

export async function getAppUser(): Promise<AppUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  let secret: string;
  try {
    secret = getSessionSecret(env as { SESSION_SECRET?: string });
  } catch {
    return null;
  }
  const session: SessionPayload | null = await verifySessionCookieValue(raw, secret);
  if (!session) return null;
  return { userId: session.sub, displayName: session.name, email: session.email };
}

export async function requireUser(returnTo: string): Promise<AppUser> {
  const user = await getAppUser();
  if (user) return user;
  redirect(loginPath(returnTo));
}

export function loginPath(returnTo: string): string {
  const safe = safeRelativeReturnPath(returnTo);
  return `${LOGIN_PATH}?return_to=${encodeURIComponent(safe)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (url.pathname === LOGIN_PATH) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
