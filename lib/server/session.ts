// Sessão própria (cookie assinado), substituindo a autenticação anteriormente
// delegada ao ambiente ChatGPT/Sites. Sem estado no servidor: o cookie carrega
// a identidade e uma expiração, autenticados com HMAC-SHA256.

export const SESSION_COOKIE_NAME = "harmonia_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type SessionPayload = {
  sub: string; // identity_subject local, ex.: "local:<uuid>"
  email: string;
  name: string;
  exp: number; // epoch seconds
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function getSessionSecret(env: { SESSION_SECRET?: string }): string {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET não configurado. Defina uma variável de ambiente/segredo forte antes de aceitar logins.",
    );
  }
  return secret;
}

export async function createSessionCookieValue(
  payload: Omit<SessionPayload, "exp">,
  secret: string,
): Promise<string> {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(full)));
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionCookieValue(value: string, secret: string): Promise<SessionPayload | null> {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  try {
    const key = await getHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature) as BufferSource,
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return null;
}

export function buildSessionCookieHeader(value: string, options: { secure: boolean; maxAgeSeconds?: number }): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds ?? SESSION_TTL_SECONDS}`,
  ];
  if (options.secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function buildClearSessionCookieHeader(options: { secure: boolean }): string {
  const attrs = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (options.secure) attrs.push("Secure");
  return attrs.join("; ");
}
