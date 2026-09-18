export const ROLE_CODES = [
  "ADMIN",
  "DIRECAO",
  "SECRETARIA",
  "COORDENACAO",
  "PROFESSOR",
  "ALUNO",
  "RESPONSAVEL",
  "FINANCEIRO",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "Administrador",
  DIRECAO: "Direção",
  SECRETARIA: "Secretaria",
  COORDENACAO: "Coordenação pedagógica",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
  RESPONSAVEL: "Responsável",
  FINANCEIRO: "Financeiro",
};

export type Permission =
  | "dashboard:school"
  | "dashboard:own"
  | "schedule:read_school"
  | "schedule:read_own"
  | "schedule:manage"
  | "availability:manage_own"
  | "attendance:manage_own"
  | "tasks:manage_own"
  | "tasks:submit_own"
  | "reports:manage_own"
  | "reports:review"
  | "reports:read_published_own"
  | "metrics:read_school"
  | "metrics:read_own"
  | "people:manage"
  | "events:manage"
  | "events:participate"
  | "announcements:manage"
  | "finance:manage"
  | "finance:read_limited"
  | "practice:manage_own"
  | "assets:manage"
  | "files:upload"
  | "files:read_authorized"
  | "settings:manage"
  | "audit:read";

const ALL = "*" as const;

export const PERMISSION_MATRIX: Record<RoleCode, readonly (Permission | typeof ALL)[]> = {
  ADMIN: [ALL],
  DIRECAO: [
    "dashboard:school", "schedule:read_school", "schedule:manage", "reports:review",
    "metrics:read_school", "people:manage", "events:manage", "announcements:manage",
    "finance:manage", "assets:manage", "files:read_authorized", "settings:manage", "audit:read",
  ],
  SECRETARIA: [
    "dashboard:school", "schedule:read_school", "schedule:manage", "people:manage",
    "events:manage", "announcements:manage", "finance:read_limited", "assets:manage",
    "files:upload", "files:read_authorized",
  ],
  COORDENACAO: [
    "dashboard:school", "schedule:read_school", "reports:review", "metrics:read_school",
    "tasks:manage_own", "files:upload", "files:read_authorized",
  ],
  PROFESSOR: [
    "dashboard:own", "schedule:read_own", "availability:manage_own", "attendance:manage_own",
    "tasks:manage_own", "reports:manage_own", "metrics:read_own", "files:upload",
    "files:read_authorized", "events:participate",
  ],
  ALUNO: [
    "dashboard:own", "schedule:read_own", "tasks:submit_own", "reports:read_published_own",
    "practice:manage_own", "events:participate", "files:upload", "files:read_authorized",
  ],
  RESPONSAVEL: [
    "dashboard:own", "schedule:read_own", "reports:read_published_own",
    "finance:read_limited", "files:read_authorized",
  ],
  FINANCEIRO: ["dashboard:school", "finance:manage", "files:read_authorized"],
};

export function hasPermission(role: RoleCode, permission: Permission): boolean {
  const granted = PERMISSION_MATRIX[role];
  return granted.includes(ALL) || granted.includes(permission);
}

export function assertPermission(role: RoleCode, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AccessError("Você não tem permissão para realizar esta ação.");
  }
}

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === "string" && ROLE_CODES.includes(value as RoleCode);
}

export class AccessError extends Error {
  readonly status = 403;
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "AccessError";
  }
}

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export function assertOwnedOrLinked(params: {
  role: RoleCode;
  actorStudentId?: string | null;
  requestedStudentId: string;
  linkedStudentIds?: string[];
  teacherStudentIds?: string[];
}): void {
  const { role, actorStudentId, requestedStudentId, linkedStudentIds = [], teacherStudentIds = [] } = params;
  if (["ADMIN", "DIRECAO", "SECRETARIA", "COORDENACAO"].includes(role)) return;
  if (role === "ALUNO" && actorStudentId === requestedStudentId) return;
  if (role === "RESPONSAVEL" && linkedStudentIds.includes(requestedStudentId)) return;
  if (role === "PROFESSOR" && teacherStudentIds.includes(requestedStudentId)) return;
  throw new AccessError("Este aluno não pertence ao seu escopo de acesso.");
}

export type LockResource = { type: "TEACHER" | "STUDENT" | "ROOM" | "INSTRUMENT"; id: string };

export function buildBookingLockKeys(params: {
  schoolId: string;
  startsAt: string;
  endsAt: string;
  bufferMinutes: number;
  resources: LockResource[];
}): string[] {
  const start = Date.parse(params.startsAt);
  const end = Date.parse(params.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new ValidationError("O horário final deve ser posterior ao horário inicial.");
  }
  if (params.bufferMinutes < 0 || params.bufferMinutes > 120) {
    throw new ValidationError("O intervalo entre aulas deve estar entre 0 e 120 minutos.");
  }
  const durationMinutes = (end - start) / 60_000;
  if (durationMinutes < 15 || durationMinutes > 360 || durationMinutes % 5 !== 0) {
    throw new ValidationError("A duração da aula deve ficar entre 15 e 360 minutos.");
  }
  const slotMs = 5 * 60_000;
  const occupiedStart = Math.floor(start / slotMs) * slotMs;
  const occupiedEnd = end + params.bufferMinutes * 60_000;
  const keys: string[] = [];
  for (const resource of params.resources) {
    if (!resource.id) continue;
    for (let cursor = occupiedStart; cursor < occupiedEnd; cursor += slotMs) {
      keys.push(`${params.schoolId}:${resource.type}:${resource.id}:${new Date(cursor).toISOString()}`);
    }
  }
  return keys;
}

export function canTransitionReport(from: string, to: string, role: RoleCode): boolean {
  if (from === to) return true;
  const transitions: Record<string, string[]> = {
    DRAFT: ["AWAITING_REVIEW"],
    AWAITING_REVIEW: ["DRAFT", "APPROVED"],
    APPROVED: ["PUBLISHED", "DRAFT"],
    PUBLISHED: ["RECTIFIED"],
    RECTIFIED: ["PUBLISHED"],
  };
  if (!transitions[from]?.includes(to)) return false;
  if (["APPROVED", "PUBLISHED", "RECTIFIED"].includes(to)) {
    return ["ADMIN", "DIRECAO", "COORDENACAO"].includes(role);
  }
  return ["ADMIN", "DIRECAO", "COORDENACAO", "PROFESSOR"].includes(role);
}

export function safeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  const neutralized = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${neutralized.replaceAll('"', '""')}"`;
}
