import { z } from "zod";

const id = z.string().min(8).max(100);
const safeText = (max: number) => z.string().trim().min(1).max(max).refine(
  (value) => !/[<>]/.test(value),
  "Não use marcação HTML neste campo.",
);
const httpsUrl = (max: number) => z.string().url().max(max).refine((value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use uma URL HTTPS válida.");

export const createLessonSchema = z.object({
  title: safeText(120),
  teacherId: id,
  studentIds: z.array(id).min(1).max(30),
  roomId: id.optional().nullable(),
  instrumentId: id.optional().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  bufferMinutes: z.coerce.number().int().min(0).max(120).default(10),
  modality: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]),
  meetingUrl: httpsUrl(500).optional().nullable(),
  recurring: z.boolean().default(false),
  occurrences: z.coerce.number().int().min(1).max(12).default(1),
  useMakeupCredit: z.boolean().default(false),
}).superRefine((value, context) => {
  const start = Date.parse(value.startsAt);
  const end = Date.parse(value.endsAt);
  const durationMinutes = (end - start) / 60_000;
  if (!Number.isFinite(durationMinutes) || durationMinutes < 20 || durationMinutes > 240) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "A aula deve durar entre 20 minutos e 4 horas." });
  }
  if (new Set(value.studentIds).size !== value.studentIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["studentIds"], message: "Não repita o mesmo aluno na aula." });
  }
  if (value.useMakeupCredit && (value.studentIds.length !== 1 || value.recurring)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["useMakeupCredit"], message: "Créditos de reposição valem para uma aula individual não recorrente." });
  }
});

export const attendanceSchema = z.object({
  lessonId: id,
  studentId: id,
  status: z.enum(["PRESENT", "LATE", "EXCUSED_ABSENCE", "UNEXCUSED_ABSENCE"]),
  actualStartAt: z.string().datetime({ offset: true }).optional().nullable(),
  actualEndAt: z.string().datetime({ offset: true }).optional().nullable(),
  content: z.string().trim().max(4000).default(""),
  repertoire: z.string().trim().max(2000).default(""),
  exercises: z.string().trim().max(2000).default(""),
  privateNotes: z.string().trim().max(4000).default(""),
  nextGoal: z.string().trim().max(1000).default(""),
  replacementNeeded: z.boolean().default(false),
});

export const taskSchema = z.object({
  title: safeText(140),
  instructions: z.string().trim().min(3).max(8000),
  studentIds: z.array(id).min(1).max(100),
  dueAt: z.string().datetime({ offset: true }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  evaluationMode: z.enum(["GRADE", "CONCEPT", "RUBRIC"]),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  publish: z.boolean(),
});

export const submissionSchema = z.object({
  taskId: id,
  studentId: id,
  textContent: z.string().trim().max(12000).optional().default(""),
  linkUrl: httpsUrl(1000).optional().or(z.literal("")),
  fileIds: z.array(id).max(10).default([]),
}).refine((value) => value.textContent || value.linkUrl || value.fileIds.length, {
  message: "Inclua texto, link ou arquivo na entrega.",
});

export const feedbackSchema = z.object({
  submissionId: id,
  message: z.string().trim().min(2).max(8000),
  strengths: z.array(z.string().trim().max(300)).max(20).default([]),
  improvements: z.array(z.string().trim().max(300)).max(20).default([]),
  gradeValue: z.string().trim().max(40).optional().default(""),
  requestsRevision: z.boolean().default(false),
});

export const reportTransitionSchema = z.object({
  reportId: id,
  toStatus: z.enum(["DRAFT", "AWAITING_REVIEW", "APPROVED", "PUBLISHED", "RECTIFIED"]),
  changeReason: z.string().trim().max(500).optional().default(""),
  coordinationComment: z.string().trim().max(2000).optional().default(""),
});

export const announcementSchema = z.object({
  title: safeText(160),
  body: z.string().trim().min(3).max(8000),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
  audienceType: z.enum(["ALL", "ROLE", "UNIT", "COURSE", "CLASS"]),
  audienceId: z.string().max(100).optional().nullable(),
  requiresAcknowledgement: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.audienceType !== "ALL" && !value.audienceId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["audienceId"], message: "Selecione o público específico do aviso." });
  }
});

export const practiceSchema = z.object({
  studentId: id,
  practicedOn: z.string().date(),
  minutes: z.coerce.number().int().min(1).max(720),
  repertoire: z.string().trim().max(1000).default(""),
  difficulty: z.string().trim().max(500).default(""),
  observations: z.string().trim().max(2000).default(""),
  shareWithTeacher: z.boolean().default(true),
});

export const paymentSchema = z.object({
  chargeId: id,
  amountCents: z.coerce.number().int().positive().max(10_000_000),
  method: z.enum(["PIX", "CARD", "CASH", "TRANSFER", "OTHER"]),
});

export const eventSchema = z.object({
  type: z.enum(["RECITAL", "AUDITION", "EXAM", "REHEARSAL", "WORKSHOP", "MASTERCLASS", "MEETING", "HOLIDAY"]),
  title: safeText(160),
  description: z.string().trim().min(3).max(6000),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  location: safeText(240),
  capacity: z.coerce.number().int().min(1).max(5000).optional().nullable(),
  audienceType: z.enum(["ALL", "ROLE", "UNIT", "COURSE", "CLASS"]),
  audienceId: z.string().max(100).optional().nullable(),
}).superRefine((value, context) => {
  if (value.audienceType !== "ALL" && !value.audienceId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["audienceId"], message: "Selecione o público específico do evento." });
  }
});

export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
