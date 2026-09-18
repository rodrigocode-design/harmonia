import test from "node:test";
import assert from "node:assert/strict";
import { attendanceSchema, feedbackSchema, taskSchema } from "../lib/validation.ts";

test("registro de aula separa observação privada do conteúdo compartilhável", () => {
  const parsed = attendanceSchema.parse({ lessonId: "lesson-123", studentId: "student-123", status: "PRESENT", content: "Escalas", repertoire: "Satie", exercises: "Hanon", privateNotes: "Observação individual", nextGoal: "72 bpm", replacementNeeded: false });
  assert.equal(parsed.privateNotes, "Observação individual");
  assert.equal(parsed.content, "Escalas");
});

test("tarefa publicada exige destinatário e prazo válido", () => {
  const result = taskSchema.safeParse({ title: "Estudo rítmico", instructions: "Pratique lentamente", studentIds: [], dueAt: "informe depois", priority: "MEDIUM", evaluationMode: "RUBRIC", maxAttempts: 2, publish: true });
  assert.equal(result.success, false);
});

test("feedback suporta revisão e rubrica privada", () => {
  const parsed = feedbackSchema.parse({ submissionId: "submission-123", message: "Boa articulação", strengths: ["Ritmo"], improvements: ["Dinâmica"], gradeValue: "B", requestsRevision: true });
  assert.equal(parsed.requestsRevision, true);
  assert.deepEqual(parsed.strengths, ["Ritmo"]);
});
