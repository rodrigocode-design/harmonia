import { getD1 } from "@/db";
import { AccessError, assertOwnedOrLinked, safeCsvCell, ValidationError } from "@/lib/access";
import { audit, ensureActor } from "@/lib/server/context";
import { loadPortalData } from "@/lib/server/data";

export const dynamic = "force-dynamic";

function latin1(value: string): Uint8Array {
  const replacements: Record<string, string> = { "–": "-", "—": "-", "•": "*", "“": '"', "”": '"', "’": "'" };
  const normalized = value.replace(/[–—•“”’]/g, (char) => replacements[char] ?? char);
  return Uint8Array.from(Array.from(normalized).map((char) => char.charCodeAt(0) <= 255 ? char.charCodeAt(0) : 63));
}

function escapePdf(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function createSimplePdf(lines: string[]): Uint8Array {
  const contentLines = ["BT", "/F1 11 Tf", "48 794 Td", "15 TL"];
  for (const line of lines.slice(0, 46)) contentLines.push(`(${escapePdf(line.slice(0, 105))}) Tj`, "T*");
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${latin1(stream).length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let source = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(latin1(source).length);
    source += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = latin1(source).length;
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) source += `${String(offset).padStart(10, "0")} 00000 n \n`;
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return latin1(source);
}

function download(bytes: BodyInit | Uint8Array, type: string, filename: string) {
  const body = bytes instanceof Uint8Array
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    : bytes;
  return new Response(body, { headers: {
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function GET(request: Request) {
  try {
    const actor = await ensureActor(request);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const db = getD1();
    if (kind === "report_pdf") {
      const id = url.searchParams.get("id");
      if (!id) throw new ValidationError("Relatório não informado.");
      const report = await db.prepare(
        `SELECT mr.id,mr.student_id,mr.teacher_id,mr.reference_month,mr.status,mr.current_version,
          su.display_name AS student_name,tu.display_name AS teacher_name,rv.data_json,rv.coordination_comment
         FROM monthly_reports mr JOIN student_profiles sp ON sp.id=mr.student_id JOIN users su ON su.id=sp.user_id
         JOIN teacher_profiles tp ON tp.id=mr.teacher_id JOIN users tu ON tu.id=tp.user_id
         JOIN report_versions rv ON rv.report_id=mr.id AND rv.version_number=mr.current_version
         WHERE mr.school_id=? AND mr.id=?`,
      ).bind(actor.schoolId, id).first<{
        id: string; student_id: string; teacher_id: string; reference_month: string; status: string; current_version: number;
        student_name: string; teacher_name: string; data_json: string; coordination_comment: string | null;
      }>();
      if (!report) throw new ValidationError("Relatório não encontrado.");
      if (["ALUNO", "RESPONSAVEL"].includes(actor.activeRole)) {
        if (report.status !== "PUBLISHED") throw new AccessError("Somente relatórios publicados podem ser exportados.");
        assertOwnedOrLinked({ role: actor.activeRole, actorStudentId: actor.studentId, requestedStudentId: report.student_id, linkedStudentIds: actor.linkedStudentIds });
      } else if (actor.activeRole === "PROFESSOR") {
        if (!actor.teacherId || report.teacher_id !== actor.teacherId) throw new AccessError("Este relatório pertence a outro professor.");
      } else if (!["ADMIN", "DIRECAO", "COORDENACAO"].includes(actor.activeRole)) throw new AccessError();
      const data = JSON.parse(report.data_json || "{}") as Record<string, unknown>;
      const lines = [
        "HARMONIA · RELATÓRIO PEDAGÓGICO MENSAL",
        `Aluno: ${report.student_name}`,
        `Referência: ${report.reference_month} · Professor: ${report.teacher_name}`,
        `Status: ${report.status} · Versão: ${report.current_version}`,
        "",
        `Aulas previstas: ${data.plannedLessons ?? "-"} · realizadas: ${data.completedLessons ?? "-"}`,
        `Presença: ${data.attendanceRate ?? "-"}%`,
        `Tarefas concluídas: ${data.completedTasks ?? "-"} · pendentes: ${data.pendingTasks ?? "-"}`,
        `Prática informada: ${data.practiceFrequency ?? "-"}`,
        "",
        `Conteúdos: ${data.contents ?? "-"}`,
        `Repertório: ${data.repertoire ?? "-"}`,
        `Habilidades: ${data.skills ?? "-"}`,
        `Pontos fortes: ${data.strengths ?? "-"}`,
        `Dificuldades: ${data.difficulties ?? "-"}`,
        `Evolução: ${data.evolution ?? "-"}`,
        `Metas: ${data.nextGoals ?? "-"}`,
        `Recomendações: ${data.recommendations ?? "-"}`,
        report.coordination_comment ? `Coordenação: ${report.coordination_comment}` : "",
        "",
        `Documento confidencial · emitido para ${actor.displayName}`,
        `Emissão: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date())}`,
      ].filter(Boolean) as string[];
      await audit({ db, actor, request, action: "REPORT_EXPORTED", entityType: "MONTHLY_REPORT", entityId: id, metadata: { format: "PDF", version: report.current_version } });
      return download(createSimplePdf(lines), "application/pdf", `relatorio-${report.reference_month}.pdf`);
    }
    if (kind === "lessons_csv") {
      const data = await loadPortalData(actor);
      const rows = [
        ["Data/hora", "Título", "Professor", "Alunos", "Sala", "Modalidade", "Status"],
        ...data.lessons.map((lesson) => [lesson.startsAt, lesson.title, lesson.teacherName, lesson.studentNames.join(", "), lesson.roomName ?? "", lesson.modality, lesson.status]),
      ];
      const csv = `\uFEFF${rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n")}`;
      await audit({ db, actor, request, action: "LESSONS_EXPORTED", entityType: "LESSON", metadata: { format: "CSV", rowCount: data.lessons.length } });
      return download(csv, "text/csv; charset=utf-8", "agenda-harmonia.csv");
    }
    throw new ValidationError("Formato de exportação inválido.");
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return Response.json({ error: status >= 500 ? "Não foi possível gerar a exportação." : error instanceof Error ? error.message : "Exportação inválida." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
