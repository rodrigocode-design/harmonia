import test from "node:test";
import assert from "node:assert/strict";
import {
  AccessError, assertOwnedOrLinked, buildBookingLockKeys, canTransitionReport,
  hasPermission, safeCsvCell,
} from "../lib/access.ts";
import { announcementSchema, createLessonSchema, submissionSchema } from "../lib/validation.ts";

test("nega por padrão uma permissão financeira ao professor", () => {
  assert.equal(hasPermission("PROFESSOR", "finance:manage"), false);
  assert.equal(hasPermission("FINANCEIRO", "reports:review"), false);
  assert.equal(hasPermission("ADMIN", "audit:read"), true);
});

test("responsável acompanha sem entregar tarefa ou confirmar evento pelo aluno", () => {
  assert.equal(hasPermission("RESPONSAVEL", "tasks:submit_own"), false);
  assert.equal(hasPermission("RESPONSAVEL", "events:participate"), false);
  assert.equal(hasPermission("RESPONSAVEL", "finance:read_limited"), true);
});

test("responsável não acessa aluno sem vínculo", () => {
  assert.throws(() => assertOwnedOrLinked({
    role: "RESPONSAVEL", requestedStudentId: "student-b", linkedStudentIds: ["student-a"],
  }), AccessError);
});

test("professor não acessa aluno de outro professor", () => {
  assert.throws(() => assertOwnedOrLinked({
    role: "PROFESSOR", requestedStudentId: "student-b", teacherStudentIds: ["student-a"],
  }), /escopo/);
});

test("aluno acessa apenas o próprio registro", () => {
  assert.doesNotThrow(() => assertOwnedOrLinked({ role: "ALUNO", actorStudentId: "student-a", requestedStudentId: "student-a" }));
  assert.throws(() => assertOwnedOrLinked({ role: "ALUNO", actorStudentId: "student-a", requestedStudentId: "student-b" }));
});

test("gera locks para professor, aluno, sala e intervalo", () => {
  const keys = buildBookingLockKeys({
    schoolId: "school-1", startsAt: "2026-10-01T12:00:00.000Z", endsAt: "2026-10-01T13:00:00.000Z",
    bufferMinutes: 10,
    resources: [{ type: "TEACHER", id: "teacher-1" }, { type: "STUDENT", id: "student-1" }, { type: "ROOM", id: "room-1" }],
  });
  assert.equal(keys.length, 42);
  assert.equal(new Set(keys).size, keys.length);
});

test("bloqueia duração inválida e intervalo abusivo", () => {
  assert.throws(() => buildBookingLockKeys({ schoolId: "s", startsAt: "2026-10-01T13:00:00Z", endsAt: "2026-10-01T12:00:00Z", bufferMinutes: 10, resources: [] }));
  assert.throws(() => buildBookingLockKeys({ schoolId: "s", startsAt: "2026-10-01T12:00:00Z", endsAt: "2026-10-01T13:00:00Z", bufferMinutes: 900, resources: [] }));
});

test("protege CSV contra fórmula injetada", () => {
  assert.equal(safeCsvCell("=HYPERLINK(\"x\")").startsWith("\"'="), true);
});

test("valida payload malicioso e URL inválida", () => {
  const result = createLessonSchema.safeParse({ title: "<script>", teacherId: "teacher-123", studentIds: ["student-123"], startsAt: "2026-10-01T12:00:00Z", endsAt: "2026-10-01T13:00:00Z", bufferMinutes: 10, modality: "ONLINE", meetingUrl: "javascript:alert(1)", recurring: false, occurrences: 1, useMakeupCredit: false });
  assert.equal(result.success, false);
  const emptySubmission = submissionSchema.safeParse({ taskId: "task-1234", studentId: "student-123", textContent: "", linkUrl: "", fileIds: [] });
  assert.equal(emptySubmission.success, false);
  const unsafeLink = submissionSchema.safeParse({ taskId: "task-1234", studentId: "student-123", textContent: "", linkUrl: "javascript:alert(1)", fileIds: [] });
  assert.equal(unsafeLink.success, false);
  const missingAudience = announcementSchema.safeParse({ title: "Aviso", body: "Mensagem válida", priority: "NORMAL", audienceType: "CLASS", audienceId: null, requiresAcknowledgement: false });
  assert.equal(missingAudience.success, false);
});

test("fluxo de relatório exige coordenação para publicação", () => {
  assert.equal(canTransitionReport("DRAFT", "AWAITING_REVIEW", "PROFESSOR"), true);
  assert.equal(canTransitionReport("AWAITING_REVIEW", "APPROVED", "PROFESSOR"), false);
  assert.equal(canTransitionReport("AWAITING_REVIEW", "APPROVED", "COORDENACAO"), true);
  assert.equal(canTransitionReport("APPROVED", "PUBLISHED", "DIRECAO"), true);
  assert.equal(canTransitionReport("PUBLISHED", "RECTIFIED", "ALUNO"), false);
});
