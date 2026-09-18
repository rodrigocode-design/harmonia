import { getD1 } from "@/db";
import { loadPortalData, performAction } from "@/lib/server/data";
import { audit, checkSameOrigin, ensureActor, enforceRateLimit } from "@/lib/server/context";
import { ValidationError } from "@/lib/access";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
  const publicMessage = status >= 500 ? "Não foi possível concluir a operação. Tente novamente." : error instanceof Error ? error.message : "Requisição inválida.";
  if (status >= 500) console.error(JSON.stringify({ level: "error", event: "app_route_failure", error: error instanceof Error ? error.name : "UnknownError" }));
  return json({ error: publicMessage }, status);
}

export async function GET(request: Request) {
  try {
    const actor = await ensureActor(request);
    const data = await loadPortalData(actor);
    if (["ADMIN", "DIRECAO"].includes(actor.activeRole)) {
      await audit({ db: getD1(), actor, request, action: "ADMIN_PORTAL_VIEWED", entityType: "SENSITIVE_OVERVIEW", metadata: { sections: ["academic", "financial", "metrics"] } });
    }
    return json(data);
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  let actor: Awaited<ReturnType<typeof ensureActor>> | null = null;
  try {
    checkSameOrigin(request);
    actor = await ensureActor(request);
    const db = getD1();
    await enforceRateLimit(db, actor, request, "write", 40);
    const body = await request.json() as { action?: unknown; payload?: unknown };
    if (typeof body.action !== "string" || body.action.length > 80) throw new ValidationError("Ação inválida.");
    const requestKey = request.headers.get("idempotency-key");
    if (!requestKey || requestKey.length < 12 || requestKey.length > 100) throw new ValidationError("Chave de idempotência ausente ou inválida.");

    const cached = await db.prepare(
      "SELECT response_json FROM idempotency_keys WHERE school_id=? AND user_id=? AND action=? AND request_key=? AND expires_at>CURRENT_TIMESTAMP",
    ).bind(actor.schoolId, actor.userId, body.action, requestKey).first<{ response_json: string | null }>();
    if (cached?.response_json) return json(JSON.parse(cached.response_json));
    try {
      await db.prepare(
        "INSERT INTO idempotency_keys (id,school_id,user_id,action,request_key,expires_at) VALUES (?,?,?,?,?,?)",
      ).bind(crypto.randomUUID(), actor.schoolId, actor.userId, body.action, requestKey, new Date(Date.now()+24*3_600_000).toISOString()).run();
    } catch {
      return json({ error: "Esta operação ainda está sendo processada." }, 409);
    }

    try {
      const result = await performAction(body.action, body.payload, actor, request);
      await db.prepare(
        "UPDATE idempotency_keys SET response_json=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND user_id=? AND action=? AND request_key=?",
      ).bind(JSON.stringify(result), actor.schoolId, actor.userId, body.action, requestKey).run();
      return json(result);
    } catch (error) {
      // Uma operação rejeitada não deve envenenar a chave por 24 horas; o cliente pode corrigir e reenviar.
      await db.prepare(
        "DELETE FROM idempotency_keys WHERE school_id=? AND user_id=? AND action=? AND request_key=? AND response_json IS NULL",
      ).bind(actor.schoolId, actor.userId, body.action, requestKey).run().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return safeError(error);
  }
}
