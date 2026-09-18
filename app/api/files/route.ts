import { getBucket, getD1 } from "@/db";
import { assertPermission, ValidationError } from "@/lib/access";
import { audit, checkSameOrigin, ensureActor, enforceRateLimit } from "@/lib/server/context";

export const dynamic = "force-dynamic";

const MAX_UPLOAD = 24 * 1024 * 1024;
const USER_QUOTA = 500 * 1024 * 1024;

type Signature = { extension: string; mime: string; max: number; matches(bytes: Uint8Array): boolean };
const signatures: Signature[] = [
  { extension: "pdf", mime: "application/pdf", max: 15 * 1024 * 1024, matches: (b) => ascii(b, 0, 5) === "%PDF-" },
  { extension: "png", mime: "image/png", max: 10 * 1024 * 1024, matches: (b) => b[0] === 0x89 && ascii(b, 1, 3) === "PNG" },
  { extension: "jpg", mime: "image/jpeg", max: 10 * 1024 * 1024, matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extension: "webp", mime: "image/webp", max: 10 * 1024 * 1024, matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP" },
  { extension: "mp3", mime: "audio/mpeg", max: 24 * 1024 * 1024, matches: (b) => ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { extension: "mp4", mime: "video/mp4", max: 24 * 1024 * 1024, matches: (b) => ascii(b, 4, 4) === "ftyp" },
  { extension: "webm", mime: "video/webm", max: 24 * 1024 * 1024, matches: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
];

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request) {
  try {
    checkSameOrigin(request);
    const actor = await ensureActor(request);
    assertPermission(actor.activeRole, "files:upload");
    const db = getD1();
    await enforceRateLimit(db, actor, request, "file_upload", 8);
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File)) throw new ValidationError("Selecione um arquivo.");
    if (candidate.size < 1 || candidate.size > MAX_UPLOAD) throw new ValidationError("O arquivo deve ter no máximo 24 MB neste ambiente.");
    const cleanName = candidate.name.replaceAll("\\", "/").split("/").at(-1)?.replace(/[\u0000-\u001f]/g, "").slice(0, 180) || "arquivo";
    const declaredExtension = cleanName.includes(".") ? cleanName.split(".").at(-1)?.toLowerCase() : "";
    const buffer = await candidate.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const signature = signatures.find((item) => item.matches(bytes));
    if (!signature || !declaredExtension || !([signature.extension, signature.extension === "jpg" ? "jpeg" : ""].includes(declaredExtension))) {
      throw new ValidationError("O conteúdo real do arquivo não corresponde a um formato permitido.");
    }
    if (candidate.size > signature.max) throw new ValidationError(`O limite para .${signature.extension} foi excedido.`);
    const usage = await db.prepare("SELECT COALESCE(SUM(size_bytes),0) AS total FROM files WHERE school_id=? AND owner_user_id=? AND deleted_at IS NULL").bind(actor.schoolId, actor.userId).first<{ total: number }>();
    if ((usage?.total ?? 0) + candidate.size > USER_QUOTA) throw new ValidationError("Sua cota de arquivos foi atingida.");
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const id = crypto.randomUUID();
    const storageKey = `${actor.schoolId}/${crypto.randomUUID()}.${signature.extension}`;
    const bucket = getBucket();
    await bucket.put(storageKey, buffer, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { fileId: id, quarantine: "true" } });
    try {
      await db.prepare("INSERT INTO files (id,school_id,owner_user_id,storage_key,original_name,extension,detected_mime,size_bytes,sha256,scan_status,sensitivity) VALUES (?,?,?,?,?,?,?,?,?,'QUARANTINED','PRIVATE')")
        .bind(id, actor.schoolId, actor.userId, storageKey, cleanName, signature.extension, signature.mime, candidate.size, sha256).run();
    } catch (error) {
      await bucket.delete(storageKey);
      throw error;
    }
    await audit({ db, actor, request, action: "FILE_UPLOADED", entityType: "FILE", entityId: id, metadata: { extension: signature.extension, sizeBytes: candidate.size, scanStatus: "QUARANTINED" } });
    return response({ file: { id, name: cleanName, size: candidate.size, status: "QUARANTINED" }, message: "Arquivo recebido e isolado. Ele será liberado após verificação antimalware." }, 201);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
    if (status >= 500) console.error(JSON.stringify({ level: "error", event: "file_upload_failure" }));
    return response({ error: status >= 500 ? "Não foi possível armazenar o arquivo." : error instanceof Error ? error.message : "Upload inválido." }, status);
  }
}
