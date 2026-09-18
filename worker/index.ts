import app from "vinext/server/fetch-handler";

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; upgrade-insecure-requests"],
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
];

export default {
  async fetch(request: Request, env: Cloudflare.Env, context: ExecutionContext): Promise<Response> {
    const response = await app.fetch(request, env, context);
    const headers = new Headers(response.headers);
    for (const [name, value] of SECURITY_HEADERS) if (!headers.has(name)) headers.set(name, value);
    if ((headers.get("Content-Type") ?? "").startsWith("text/html")) headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<Cloudflare.Env>;
