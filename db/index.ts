import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure o binding `DB` no wrangler.json/wrangler.toml do seu ambiente (local ou produção) antes de usar o banco."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1(): D1Database {
  if (!env.DB) {
    throw new Error("O banco de dados está temporariamente indisponível.");
  }
  return env.DB;
}

export function getBucket(): R2Bucket {
  if (!env.BUCKET) {
    throw new Error("O armazenamento privado está temporariamente indisponível.");
  }
  return env.BUCKET;
}
