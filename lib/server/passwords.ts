// Hash e verificação de senha usando PBKDF2 (Web Crypto), compatível com o
// runtime do Cloudflare Workers (não depende de bibliotecas nativas como bcrypt).

const ITERATIONS = 210_000;
const HASH_ALGORITHM = "SHA-256";
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(array).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: HASH_ALGORITHM },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
}

/** Gera um hash no formato `pbkdf2$<iterações>$<saltHex>$<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const derived = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(derived)}`;
}

/** Compara uma senha em texto puro com um hash gerado por `hashPassword`. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromHex(parts[2]);
  const expected = parts[3];
  const derived = toHex(await derive(password, salt, iterations));
  if (derived.length !== expected.length) return false;
  // Comparação em tempo constante para reduzir risco de timing attack.
  let diff = 0;
  for (let i = 0; i < derived.length; i += 1) diff |= derived.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
