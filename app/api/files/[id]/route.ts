import { getBucket, getD1 } from "@/db";
import { AccessError, assertPermission, ValidationError } from "@/lib/access";
import { audit, checkSameOrigin, ensureActor } from "@/lib/server/context";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

class QuarantinedFileError extends Error {
  readonly status = 423;
}

async function authorizedFile(request: Request, id: string) {
  const actor = await ensureActor(request);
  assertPermission(actor.activeRole, "files:read_authorized");
  const db = getD1();
  const file = await db.prepare("SELECT * FROM files WHERE school_id=? AND id=? AND deleted_at IS NULL").bind(actor.schoolId, id).first<{
    id: string; owner_user_id: string; storage_key: string; original_name: string; detected_mime: string; size_bytes: number; scan_status: string;
  }>();
  if (!file) throw new ValidationError("Arquivo não encontrado.");
  const privileged = ["ADMIN", "DIRECAO"].includes(actor.activeRole);
  let allowed = privileged || file.owner_user_id === actor.userId;
  if (!allowed && actor.activeRole === "PROFESSOR" && actor.teacherId) {
    const linked = await db.prepare(
      `SELECT 1 AS ok FROM submission_versions sv JOIN submissions s ON s.id=sv.submission_id JOIN tasks t ON t.id=s.task_id
       WHERE sv.school_id=? AND t.teacher_id=? AND EXISTS (SELECT 1 FROM json_each(sv.file_ids_json) WHERE value=?) LIMIT 1`,
    ).bind(actor.schoolId, actor.teacherId, id).first<{ ok: number }>();
    allowed = Boolean(linked);
  }
  const studentIds = actor.activeRole === "ALUNO" && actor.studentId ? [actor.studentId]
    : actor.activeRole === "RESPONSAVEL" ? actor.linkedStudentIds : [];
  if (!allowed && studentIds.length) {
    const slots = studentIds.map(() => "?").join(",");
    const linked = await db.prepare(
      `SELECT 1 AS ok FROM submission_versions sv JOIN submissions s ON s.id=sv.submission_id
       WHERE sv.school_id=? AND s.student_id IN (${slots})
       AND EXISTS (SELECT 1 FROM json_each(sv.file_ids_json) WHERE value=?)
       UNION ALL
       SELECT 1 AS ok FROM task_materials tm JOIN task_recipients tr ON tr.task_id=tm.task_id
       WHERE tm.school_id=? AND tr.student_id IN (${slots}) AND tm.file_id=? LIMIT 1`,
    ).bind(actor.schoolId, ...studentIds, id, actor.schoolId, ...studentIds, id).first<{ ok: number }>();
    allowed = Boolean(linked);
  }
  if (!allowed) throw new AccessError("Você não tem acesso a este arquivo.");
  if (file.scan_status !== "CLEAN") throw new QuarantinedFileError("O arquivo ainda está em quarentena ou foi bloqueado.");
  return { actor, db, file };
}

export async function GET(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const { actor, db, file } = await authorizedFile(request, id);
    const object = await getBucket().get(file.storage_key);
    if (!object?.body) throw new ValidationError("Arquivo não encontrado no armazenamento.");
    await audit({ db, actor, request, action: "FILE_DOWNLOADED", entityType: "FILE", entityId: id });
    const safeName = file.original_name.replace(/["\r\n]/g, "_");
    return new Response(object.body, {
      headers: {
        "Content-Type": file.detected_mime,
        "Content-Length": String(file.size_bytes),
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return Response.json({ error: status >= 500 ? "Não foi possível baixar o arquivo." : error instanceof Error ? error.message : "Acesso negado." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request, context: Params) {
  try {
    checkSameOrigin(request);
    const { id } = await context.params;
    const actor = await ensureActor(request);
    const db = getD1();
    const file = await db.prepare("SELECT owner_user_id,storage_key FROM files WHERE school_id=? AND id=? AND deleted_at IS NULL").bind(actor.schoolId, id).first<{ owner_user_id: string; storage_key: string }>();
    if (!file) throw new ValidationError("Arquivo não encontrado.");
    if (file.owner_user_id !== actor.userId && !["ADMIN", "DIRECAO"].includes(actor.activeRole)) throw new AccessError("Você não pode excluir este arquivo.");
    await getBucket().delete(file.storage_key);
    await db.prepare("UPDATE files SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND id=?").bind(actor.schoolId, id).run();
    await audit({ db, actor, request, action: "FILE_DELETED", entityType: "FILE", entityId: id });
    return Response.json({ ok: true, message: "Arquivo excluído." });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return Response.json({ error: status >= 500 ? "Não foi possível excluir o arquivo." : error instanceof Error ? error.message : "Acesso negado." }, { status });
  }
}
