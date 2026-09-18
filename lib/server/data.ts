import { getD1 } from "@/db";
import {
  AccessError,
  ConflictError,
  assertOwnedOrLinked,
  assertPermission,
  buildBookingLockKeys,
  canTransitionReport,
  isRoleCode,
  type LockResource,
  type Permission,
  PERMISSION_MATRIX,
  ValidationError,
} from "@/lib/access";
import type { Actor } from "@/lib/server/context";
import { audit } from "@/lib/server/context";
import { localIso } from "@/lib/server/constants";
import {
  announcementSchema,
  attendanceSchema,
  createLessonSchema,
  eventSchema,
  feedbackSchema,
  formatZodError,
  paymentSchema,
  practiceSchema,
  reportTransitionSchema,
  submissionSchema,
  taskSchema,
} from "@/lib/validation";
import { z } from "zod";

function stmt(db: D1Database, sql: string, ...values: unknown[]) {
  return db.prepare(sql).bind(...values);
}

async function all<T>(db: D1Database, sql: string, ...values: unknown[]): Promise<T[]> {
  return (await stmt(db, sql, ...values).all<T>()).results;
}

async function first<T>(db: D1Database, sql: string, ...values: unknown[]): Promise<T | null> {
  return (await stmt(db, sql, ...values).first<T>()) ?? null;
}

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(",");
}

function saoPauloParts(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: weekdays[get("weekday")],
  };
}

function scopedStudentIds(actor: Actor): string[] | null {
  if (["ADMIN", "DIRECAO", "SECRETARIA", "COORDENACAO", "FINANCEIRO"].includes(actor.activeRole)) return null;
  if (actor.activeRole === "PROFESSOR") return actor.teacherStudentIds;
  if (actor.activeRole === "ALUNO") return actor.studentId ? [actor.studentId] : [];
  if (actor.activeRole === "RESPONSAVEL") return actor.linkedStudentIds;
  return [];
}

async function communicationAudienceIds(db: D1Database, actor: Actor): Promise<string[]> {
  const ids = new Set<string>([actor.activeRole, actor.unitId]);
  const students = actor.activeRole === "ALUNO"
    ? (actor.studentId ? [actor.studentId] : [])
    : actor.activeRole === "RESPONSAVEL" ? actor.linkedStudentIds : [];
  if (students.length) {
    const memberships = await all<{ classId: string; courseId: string }>(db,
      `SELECT DISTINCT e.class_id AS classId,c.course_id AS courseId
       FROM enrollments e JOIN classes c ON c.id=e.class_id
       WHERE e.school_id=? AND e.status='ACTIVE' AND e.student_id IN (${placeholders(students)})`,
      actor.schoolId, ...students,
    );
    for (const membership of memberships) { ids.add(membership.classId); ids.add(membership.courseId); }
  }
  if (actor.activeRole === "PROFESSOR" && actor.teacherId) {
    const memberships = await all<{ classId: string; courseId: string }>(db,
      `SELECT DISTINCT ct.class_id AS classId,c.course_id AS courseId
       FROM class_teachers ct JOIN classes c ON c.id=ct.class_id
       WHERE ct.school_id=? AND ct.teacher_id=? AND (ct.ends_on IS NULL OR ct.ends_on>=date('now'))`,
      actor.schoolId, actor.teacherId,
    );
    for (const membership of memberships) { ids.add(membership.classId); ids.add(membership.courseId); }
  }
  return [...ids];
}

async function validateAudienceTarget(db: D1Database, actor: Actor, type: "ALL" | "ROLE" | "UNIT" | "COURSE" | "CLASS", id: string | null | undefined) {
  if (type === "ALL") return null;
  if (!id) throw new ValidationError("Selecione o público específico.");
  if (type === "ROLE") {
    if (!isRoleCode(id)) throw new ValidationError("Perfil de público inválido.");
    return id;
  }
  const tables = { UNIT: "units", COURSE: "courses", CLASS: "classes" } as const;
  const exists = await first<{ id: string }>(db, `SELECT id FROM ${tables[type]} WHERE school_id=? AND id=? LIMIT 1`, actor.schoolId, id);
  if (!exists) throw new ValidationError("Público não encontrado nesta escola.");
  return id;
}

async function loadScheduleOpportunities(db: D1Database, actor: Actor, lessons: Array<{ teacherId: string; startsAt: string; endsAt: string; status: string; bufferMinutes: number }>) {
  const now = Date.now();
  const slots: Array<{ teacherId: string; teacherName: string; startsAt: string; endsAt: string }> = [];
  const availableToday = new Set<string>();
  const exceptions = await all<{ teacherId: string | null; startsAt: string; endsAt: string }>(db,
    `SELECT teacher_id AS teacherId,starts_at AS startsAt,ends_at AS endsAt FROM availability_exceptions
     WHERE school_id=? AND available=0 AND starts_at<? AND ends_at>?`,
    actor.schoolId, localIso(4, 0), localIso(0, 0),
  );
  for (let dayOffset = 0; dayOffset < 4; dayOffset += 1) {
    const day = saoPauloParts(localIso(dayOffset, 12));
    const windows = await all<{ teacherId: string; teacherName: string; startTime: string; endTime: string }>(db,
      `SELECT ra.teacher_id AS teacherId,u.display_name AS teacherName,ra.start_time AS startTime,ra.end_time AS endTime
       FROM recurring_availability ra JOIN teacher_profiles tp ON tp.id=ra.teacher_id JOIN users u ON u.id=tp.user_id
       WHERE ra.school_id=? AND ra.unit_id=? AND ra.weekday=? AND ra.valid_from<=?
       AND (ra.valid_until IS NULL OR ra.valid_until>=?) ORDER BY u.display_name,ra.start_time`,
      actor.schoolId, actor.unitId, day.weekday, day.date, day.date,
    );
    for (const window of windows) {
      const [startHour, startMinute] = window.startTime.split(":").map(Number);
      const [endHour, endMinute] = window.endTime.split(":").map(Number);
      for (let minute = startHour * 60 + startMinute; minute + 60 <= endHour * 60 + endMinute; minute += 60) {
        const startsAt = localIso(dayOffset, Math.floor(minute / 60), minute % 60);
        const endsAt = new Date(Date.parse(startsAt) + 60 * 60_000).toISOString();
        if (Date.parse(startsAt) < now + 30 * 60_000) continue;
        const blocked = exceptions.some((item) => (!item.teacherId || item.teacherId === window.teacherId) && Date.parse(item.startsAt) < Date.parse(endsAt) && Date.parse(item.endsAt) > Date.parse(startsAt));
        const busy = lessons.some((lesson) => {
          const occupiedUntil = Date.parse(lesson.endsAt) + lesson.bufferMinutes * 60_000;
          return lesson.teacherId === window.teacherId
            && !["CANCELLED_SCHOOL", "CANCELLED_STUDENT", "RESCHEDULED"].includes(lesson.status)
            && Date.parse(lesson.startsAt) < Date.parse(endsAt)
            && occupiedUntil > Date.parse(startsAt);
        });
        if (!blocked && !busy) {
          if (dayOffset === 0) availableToday.add(window.teacherId);
          if (slots.length < 4) slots.push({ teacherId: window.teacherId, teacherName: window.teacherName, startsAt, endsAt });
        }
      }
    }
  }
  return { availableTeachersToday: availableToday.size, freeSlots: slots };
}

export async function loadPortalData(actor: Actor) {
  const db = getD1();
  const permissions = PERMISSION_MATRIX[actor.activeRole] as readonly (Permission | "*")[];
  const studentScope = scopedStudentIds(actor);
  const studentsWhere = studentScope === null
    ? "sp.school_id = ?"
    : studentScope.length
      ? `sp.school_id = ? AND sp.id IN (${placeholders(studentScope)})`
      : "sp.school_id = ? AND 1 = 0";
  const studentsParams = studentScope === null ? [actor.schoolId] : [actor.schoolId, ...studentScope];

  const people = await all<{
    id: string; name: string; email: string; birthDate: string | null; active: number;
  }>(db,
    `SELECT sp.id, u.display_name AS name,
      CASE WHEN ? IN ('ADMIN','DIRECAO','SECRETARIA','COORDENACAO') THEN u.email ELSE '' END AS email,
      CASE WHEN ? IN ('ADMIN','DIRECAO','SECRETARIA','COORDENACAO','PROFESSOR','ALUNO','RESPONSAVEL') THEN sp.birth_date ELSE NULL END AS birthDate,
      sp.active AS active
     FROM student_profiles sp JOIN users u ON u.id = sp.user_id
     WHERE ${studentsWhere} ORDER BY u.display_name LIMIT 100`,
    actor.activeRole, actor.activeRole, ...studentsParams,
  );

  const teachers = actor.activeRole === "FINANCEIRO" ? [] : await all<{ id: string; name: string; bio: string | null; active: number }>(db,
    `SELECT tp.id, u.display_name AS name, tp.bio, tp.active
     FROM teacher_profiles tp JOIN users u ON u.id = tp.user_id
     WHERE tp.school_id = ? ${actor.activeRole === "PROFESSOR" && actor.teacherId ? "AND tp.id = ?" : ""}
     ORDER BY u.display_name`,
    actor.schoolId, ...(actor.activeRole === "PROFESSOR" && actor.teacherId ? [actor.teacherId] : []),
  );

  const lessonScopeSql = ["ADMIN", "DIRECAO", "SECRETARIA", "COORDENACAO"].includes(actor.activeRole)
    ? "l.school_id = ?"
    : actor.activeRole === "PROFESSOR" && actor.teacherId
      ? "l.school_id = ? AND (l.teacher_id = ? OR l.substitute_teacher_id = ?)"
      : studentScope?.length
        ? `l.school_id = ? AND EXISTS (SELECT 1 FROM lesson_participants sx WHERE sx.lesson_id = l.id AND sx.student_id IN (${placeholders(studentScope)}))`
        : "l.school_id = ? AND 1 = 0";
  const lessonScopeParams = ["ADMIN", "DIRECAO", "SECRETARIA", "COORDENACAO"].includes(actor.activeRole)
    ? [actor.schoolId]
    : actor.activeRole === "PROFESSOR" && actor.teacherId
      ? [actor.schoolId, actor.teacherId, actor.teacherId]
      : [actor.schoolId, ...(studentScope ?? [])];
  const participantScopeSql = studentScope?.length ? `AND lp.student_id IN (${placeholders(studentScope)})` : "";
  const participantScopeParams = studentScope ?? [];
  const lessons = await all<{
    id: string; title: string; startsAt: string; endsAt: string; status: string; modality: string;
    teacherId: string; teacherName: string; roomId: string | null; roomName: string | null;
    studentIds: string; studentNames: string; attendanceStatus: string | null; bufferMinutes: number;
  }>(db,
    `SELECT l.id,l.title,l.starts_at AS startsAt,l.ends_at AS endsAt,l.status,l.modality,l.buffer_minutes AS bufferMinutes,
      l.teacher_id AS teacherId,tu.display_name AS teacherName,l.room_id AS roomId,r.name AS roomName,
      GROUP_CONCAT(lp.student_id,'|') AS studentIds,GROUP_CONCAT(su.display_name,'|') AS studentNames,
      MAX(a.status) AS attendanceStatus
     FROM lessons l
     JOIN teacher_profiles tp ON tp.id=l.teacher_id JOIN users tu ON tu.id=tp.user_id
     LEFT JOIN rooms r ON r.id=l.room_id
     LEFT JOIN lesson_participants lp ON lp.lesson_id=l.id ${participantScopeSql}
     LEFT JOIN student_profiles sp ON sp.id=lp.student_id LEFT JOIN users su ON su.id=sp.user_id
     LEFT JOIN attendances a ON a.lesson_id=l.id AND a.student_id=lp.student_id
     WHERE ${lessonScopeSql} AND l.starts_at >= ? AND l.starts_at < ?
     GROUP BY l.id ORDER BY l.starts_at LIMIT 160`,
    ...participantScopeParams, ...lessonScopeParams, localIso(-30, 0), localIso(90, 0),
  );

  const taskScope = ["ADMIN", "DIRECAO", "SECRETARIA", "COORDENACAO"].includes(actor.activeRole)
    ? { sql: "t.school_id = ?", params: [actor.schoolId] }
    : actor.activeRole === "PROFESSOR" && actor.teacherId
      ? { sql: "t.school_id = ? AND t.teacher_id = ?", params: [actor.schoolId, actor.teacherId] }
      : studentScope?.length
        ? { sql: `t.school_id = ? AND tr.student_id IN (${placeholders(studentScope)})`, params: [actor.schoolId, ...studentScope] }
        : { sql: "t.school_id = ? AND 1=0", params: [actor.schoolId] };
  const tasks = await all<{
    id: string; title: string; instructions: string; dueAt: string; priority: string; status: string;
    teacherId: string; teacherName: string; recipientIds: string; recipients: string;
    submissionId: string | null; submissionStatus: string | null; currentVersion: number | null;
  }>(db,
    `SELECT t.id,t.title,t.instructions,t.due_at AS dueAt,t.priority,t.status,t.teacher_id AS teacherId,
      tu.display_name AS teacherName,GROUP_CONCAT(DISTINCT tr.student_id) AS recipientIds,
      GROUP_CONCAT(DISTINCT su.display_name) AS recipients,
      MAX(sb.id) AS submissionId,MAX(sb.status) AS submissionStatus,MAX(sb.current_version) AS currentVersion
     FROM tasks t JOIN teacher_profiles tp ON tp.id=t.teacher_id JOIN users tu ON tu.id=tp.user_id
     LEFT JOIN task_recipients tr ON tr.task_id=t.id
     LEFT JOIN student_profiles sp ON sp.id=tr.student_id LEFT JOIN users su ON su.id=sp.user_id
     LEFT JOIN submissions sb ON sb.task_id=t.id ${studentScope?.length ? `AND sb.student_id IN (${placeholders(studentScope)})` : ""}
     WHERE ${taskScope.sql} GROUP BY t.id ORDER BY t.due_at LIMIT 100`,
    ...(studentScope ?? []), ...taskScope.params,
  );

  const reportScope = ["ADMIN", "DIRECAO", "COORDENACAO"].includes(actor.activeRole)
    ? { sql: "mr.school_id = ?", params: [actor.schoolId] }
    : actor.activeRole === "PROFESSOR" && actor.teacherId
      ? { sql: "mr.school_id = ? AND mr.teacher_id = ?", params: [actor.schoolId, actor.teacherId] }
      : ["ALUNO", "RESPONSAVEL"].includes(actor.activeRole) && studentScope?.length
        ? { sql: `mr.school_id = ? AND mr.status = 'PUBLISHED' AND mr.student_id IN (${placeholders(studentScope)})`, params: [actor.schoolId, ...studentScope] }
        : { sql: "mr.school_id = ? AND 1=0", params: [actor.schoolId] };
  const reports = await all<{
    id: string; referenceMonth: string; status: string; currentVersion: number; studentId: string;
    studentName: string; teacherName: string; dataJson: string; coordinationComment: string | null; updatedAt: string;
  }>(db,
    `SELECT mr.id,mr.reference_month AS referenceMonth,mr.status,mr.current_version AS currentVersion,
      mr.student_id AS studentId,su.display_name AS studentName,tu.display_name AS teacherName,
      rv.data_json AS dataJson,rv.coordination_comment AS coordinationComment,mr.updated_at AS updatedAt
     FROM monthly_reports mr JOIN student_profiles sp ON sp.id=mr.student_id JOIN users su ON su.id=sp.user_id
     JOIN teacher_profiles tp ON tp.id=mr.teacher_id JOIN users tu ON tu.id=tp.user_id
     JOIN report_versions rv ON rv.report_id=mr.id AND rv.version_number=mr.current_version
     WHERE ${reportScope.sql} ORDER BY mr.reference_month DESC,su.display_name LIMIT 100`,
    ...reportScope.params,
  );

  const communicationManager = ["ADMIN", "DIRECAO", "SECRETARIA", "COORDENACAO"].includes(actor.activeRole);
  const audienceIds = await communicationAudienceIds(db, actor);
  const eventAudienceSql = communicationManager ? "" : `AND (
    json_extract(e.audience_json,'$.type')='ALL' OR json_extract(e.audience_json,'$.id') IN (${placeholders(audienceIds)})
  )`;
  const events = await all<{
    id: string; type: string; title: string; description: string; startsAt: string; endsAt: string;
    location: string; capacity: number | null; registrations: number; myStatus: string | null;
  }>(db,
    `SELECT e.id,e.type,e.title,e.description,e.starts_at AS startsAt,e.ends_at AS endsAt,e.location,e.capacity,
      COUNT(er.id) AS registrations,MAX(CASE WHEN er.user_id=? THEN er.status ELSE NULL END) AS myStatus
     FROM events e LEFT JOIN event_registrations er ON er.event_id=e.id
     WHERE e.school_id=? AND e.status='PUBLISHED' AND e.ends_at>=? ${eventAudienceSql}
     GROUP BY e.id ORDER BY e.starts_at LIMIT 50`, actor.userId, actor.schoolId, localIso(-1, 0), ...(communicationManager ? [] : audienceIds),
  );

  const announcementAudienceSql = communicationManager ? "" : `AND EXISTS (
    SELECT 1 FROM announcement_audiences aa WHERE aa.announcement_id=a.id AND aa.school_id=a.school_id
    AND (aa.audience_type='ALL' OR aa.audience_id IN (${placeholders(audienceIds)}))
  )`;
  const announcements = await all<{
    id: string; title: string; body: string; priority: string; publishedAt: string;
    requiresAcknowledgement: number; readAt: string | null;
  }>(db,
    `SELECT a.id,a.title,a.body,a.priority,a.published_at AS publishedAt,
      a.requires_acknowledgement AS requiresAcknowledgement,rr.read_at AS readAt
     FROM announcements a
     LEFT JOIN read_receipts rr ON rr.announcement_id=a.id AND rr.user_id=?
     WHERE a.school_id=? AND (a.expires_at IS NULL OR a.expires_at>CURRENT_TIMESTAMP) ${announcementAudienceSql}
     ORDER BY a.published_at DESC LIMIT 30`, actor.userId, actor.schoolId, ...(communicationManager ? [] : audienceIds),
  );

  const rooms = actor.activeRole === "FINANCEIRO" ? [] : await all<{ id: string; name: string; capacity: number; accessible: number; resources: string }>(db,
    `SELECT r.id,r.name,r.capacity,r.accessible,GROUP_CONCAT(rr.name,', ') AS resources
     FROM rooms r LEFT JOIN room_resources rr ON rr.room_id=r.id
     WHERE r.school_id=? AND r.active=1 GROUP BY r.id ORDER BY r.name`, actor.schoolId,
  );

  const courses = actor.activeRole === "FINANCEIRO" ? [] : await all<{ id: string; name: string }>(db, "SELECT id,name FROM courses WHERE school_id=? AND active=1 ORDER BY name", actor.schoolId);
  const instruments = actor.activeRole === "FINANCEIRO" ? [] : await all<{ id: string; name: string }>(db, "SELECT id,name FROM instruments WHERE school_id=? AND active=1 ORDER BY name", actor.schoolId);
  const classes = communicationManager ? await all<{ id: string; name: string }>(db, "SELECT id,name FROM classes WHERE school_id=? AND status='ACTIVE' ORDER BY name", actor.schoolId) : [];

  const financeAllowed = ["ADMIN", "DIRECAO", "SECRETARIA", "FINANCEIRO", "ALUNO", "RESPONSAVEL"].includes(actor.activeRole);
  const chargeScope = ["ALUNO", "RESPONSAVEL"].includes(actor.activeRole) ? (studentScope ?? []) : null;
  const chargeWhere = !financeAllowed ? "c.school_id=? AND 1=0" : chargeScope === null
    ? "c.school_id=?"
    : chargeScope.length ? `c.school_id=? AND c.student_id IN (${placeholders(chargeScope)})` : "c.school_id=? AND 1=0";
  const charges = await all<{
    id: string; studentId: string; studentName: string; referenceMonth: string; dueDate: string;
    finalAmountCents: number; status: string; paidCents: number;
  }>(db,
    `SELECT c.id,c.student_id AS studentId,u.display_name AS studentName,c.reference_month AS referenceMonth,
      c.due_date AS dueDate,c.final_amount_cents AS finalAmountCents,c.status,COALESCE(SUM(p.amount_cents),0) AS paidCents
     FROM charges c JOIN student_profiles sp ON sp.id=c.student_id JOIN users u ON u.id=sp.user_id
     LEFT JOIN payments p ON p.charge_id=c.id WHERE ${chargeWhere}
     GROUP BY c.id ORDER BY c.due_date LIMIT 100`, actor.schoolId, ...(chargeScope ?? []),
  );

  const practiceScope = actor.activeRole === "PROFESSOR" ? actor.teacherStudentIds
    : actor.activeRole === "COORDENACAO" ? people.map((person) => person.id)
      : actor.activeRole === "ALUNO" ? (studentScope ?? []) : [];
  const practicePrivacySql = ["PROFESSOR", "COORDENACAO"].includes(actor.activeRole) ? "AND share_with_teacher=1" : "";
  const practice = practiceScope.length ? await all<{
    id: string; studentId: string; practicedOn: string; minutes: number; repertoire: string | null; difficulty: string | null;
  }>(db,
    `SELECT id,student_id AS studentId,practiced_on AS practicedOn,minutes,repertoire,difficulty
     FROM practice_entries WHERE school_id=? AND student_id IN (${placeholders(practiceScope)}) ${practicePrivacySql}
     ORDER BY practiced_on DESC LIMIT 30`, actor.schoolId, ...practiceScope,
  ) : [];

  const goals = practiceScope.length ? await all<{ id: string; title: string; progressPercent: number; targetDate: string | null }>(db,
    `SELECT id,title,progress_percent AS progressPercent,target_date AS targetDate FROM student_goals
     WHERE school_id=? AND student_id IN (${placeholders(practiceScope)}) AND status='ACTIVE' ORDER BY target_date`, actor.schoolId, ...practiceScope,
  ) : [];

  const auditRows = ["ADMIN", "DIRECAO"].includes(actor.activeRole) ? await all<{
    id: string; action: string; entityType: string; outcome: string; actorRole: string | null; occurredAt: string; metadataJson: string;
  }>(db,
    "SELECT id,action,entity_type AS entityType,outcome,actor_role AS actorRole,occurred_at AS occurredAt,metadata_json AS metadataJson FROM audit_logs WHERE school_id=? ORDER BY occurred_at DESC LIMIT 80",
    actor.schoolId,
  ) : [];

  const metrics = await loadTeacherMetrics(db, actor);
  const school = await first<{ name: string; timezone: string; settingsJson: string }>(db, "SELECT name,timezone,settings_json AS settingsJson FROM schools WHERE id=?", actor.schoolId);
  const unit = await first<{ id: string; name: string }>(db, "SELECT id,name FROM units WHERE school_id=? AND id=?", actor.schoolId, actor.unitId);
  const notifications = await all<{ id: string; title: string; body: string; readAt: string | null }>(db,
    "SELECT id,title,body,read_at AS readAt FROM notifications WHERE school_id=? AND user_id=? ORDER BY created_at DESC LIMIT 20", actor.schoolId, actor.userId,
  );
  const managesSchedule = ["ADMIN", "DIRECAO", "SECRETARIA"].includes(actor.activeRole);
  const scheduleOpportunities = managesSchedule
    ? await loadScheduleOpportunities(db, actor, lessons)
    : { availableTeachersToday: 0, freeSlots: [] as Array<{ teacherId: string; teacherName: string; startsAt: string; endsAt: string }> };
  const pendingMakeup = managesSchedule ? await first<{ count: number }>(db,
    "SELECT COUNT(*) AS count FROM makeup_credits WHERE school_id=? AND status='AVAILABLE' AND datetime(expires_at)>CURRENT_TIMESTAMP",
    actor.schoolId,
  ) : null;

  return {
    session: {
      user: { id: actor.userId, displayName: actor.displayName, email: actor.email },
      roles: actor.roles, activeRole: actor.activeRole, permissions,
      school: { name: school?.name ?? "Harmonia", timezone: school?.timezone ?? "America/Sao_Paulo" },
      unit: { id: unit?.id ?? actor.unitId, name: unit?.name ?? "Unidade" },
      studentId: actor.studentId, teacherId: actor.teacherId,
    },
    lessons: lessons.map((row) => ({ ...row, studentIds: row.studentIds ? row.studentIds.split("|") : [], studentNames: row.studentNames ? row.studentNames.split("|") : [] })),
    tasks,
    reports: reports.map((row) => ({ ...row, data: JSON.parse(row.dataJson || "{}") })),
    events,
    announcements,
    students: people,
    teachers,
    rooms,
    courses,
    classes,
    instruments,
    charges,
    practice,
    goals,
    metrics,
    audit: auditRows.map((row) => ({ ...row, metadata: JSON.parse(row.metadataJson || "{}") })),
    notifications,
    dashboard: { ...scheduleOpportunities, pendingMakeupCredits: Number(pendingMakeup?.count ?? 0) },
    system: {
      generatedAt: new Date().toISOString(),
      timezone: "America/Sao_Paulo",
      demoData: true,
      externalServices: { email: "NOT_CONFIGURED", whatsapp: "NOT_CONFIGURED", antivirus: "NOT_CONFIGURED", payments: "NOT_CONFIGURED", calendar: "ICS_AVAILABLE" },
    },
  };
}

async function loadTeacherMetrics(db: D1Database, actor: Actor) {
  if (!["ADMIN", "DIRECAO", "COORDENACAO", "PROFESSOR"].includes(actor.activeRole)) return [];
  const own = actor.activeRole === "PROFESSOR";
  if (own && !actor.teacherId) return [];
  return all<{
    teacherId: string; teacherName: string; plannedLessons: number; taughtLessons: number; taughtHours: number;
    attendanceRecords: number; expectedAttendanceRecords: number; tasksCreated: number; tasksReviewed: number;
    reportsDelivered: number; sampleSize: number;
  }>(db,
    `SELECT tp.id AS teacherId,u.display_name AS teacherName,
      COUNT(DISTINCT l.id) AS plannedLessons,
      COUNT(DISTINCT CASE WHEN l.status='COMPLETED' THEN l.id END) AS taughtLessons,
      ROUND(COALESCE(SUM(CASE WHEN l.status='COMPLETED' THEN (julianday(l.ends_at)-julianday(l.starts_at))*24 ELSE 0 END),0),1) AS taughtHours,
      COUNT(DISTINCT a.id) AS attendanceRecords,
      COUNT(DISTINCT CASE WHEN l.status='COMPLETED' THEN lp.id END) AS expectedAttendanceRecords,
      COUNT(DISTINCT t.id) AS tasksCreated,
      COUNT(DISTINCT f.id) AS tasksReviewed,
      COUNT(DISTINCT CASE WHEN mr.status IN ('APPROVED','PUBLISHED','RECTIFIED') THEN mr.id END) AS reportsDelivered,
      COUNT(DISTINCT lp.student_id) AS sampleSize
     FROM teacher_profiles tp JOIN users u ON u.id=tp.user_id
     LEFT JOIN lessons l ON l.teacher_id=tp.id AND l.starts_at>=? AND l.starts_at<?
     LEFT JOIN lesson_participants lp ON lp.lesson_id=l.id LEFT JOIN attendances a ON a.lesson_id=l.id
     LEFT JOIN tasks t ON t.teacher_id=tp.id
     LEFT JOIN submissions s ON s.task_id=t.id LEFT JOIN submission_versions sv ON sv.submission_id=s.id
     LEFT JOIN feedbacks f ON f.submission_version_id=sv.id
     LEFT JOIN monthly_reports mr ON mr.teacher_id=tp.id
     WHERE tp.school_id=? ${own ? "AND tp.id=?" : ""}
     GROUP BY tp.id ORDER BY u.display_name`,
    localIso(-31,0), localIso(1,0), actor.schoolId, ...(own ? [actor.teacherId] : []),
  );
}

export async function performAction(action: string, payload: unknown, actor: Actor, request: Request): Promise<Record<string, unknown>> {
  const db = getD1();
  switch (action) {
    case "create_lesson": return createLesson(db, payload, actor, request);
    case "cancel_lesson": return cancelLesson(db, payload, actor, request);
    case "record_attendance": return recordAttendance(db, payload, actor, request);
    case "create_task": return createTask(db, payload, actor, request);
    case "submit_task": return submitTask(db, payload, actor, request);
    case "review_submission": return reviewSubmission(db, payload, actor, request);
    case "transition_report": return transitionReport(db, payload, actor, request);
    case "create_event": return createEvent(db, payload, actor, request);
    case "rsvp_event": return rsvpEvent(db, payload, actor, request);
    case "create_announcement": return createAnnouncement(db, payload, actor, request);
    case "acknowledge_announcement": return acknowledgeAnnouncement(db, payload, actor, request);
    case "add_practice": return addPractice(db, payload, actor, request);
    case "record_payment": return recordPayment(db, payload, actor);
    case "create_student": return createStudent(db, payload, actor, request);
    default: throw new ValidationError("Ação desconhecida.");
  }
}

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(formatZodError(result.error));
  return result.data;
}

async function createLesson(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "schedule:manage");
  const data = parse(createLessonSchema, payload);
  if ((data.modality === "ONLINE" || data.modality === "HYBRID") && !data.meetingUrl) throw new ValidationError("Informe o link da aula online.");
  if (Date.parse(data.startsAt) < Date.now() + 12 * 3_600_000) throw new ValidationError("O agendamento exige antecedência mínima de 12 horas.");
  const bufferMinutes = data.bufferMinutes ?? 10;
  const teacher = await first<{ id: string }>(db, "SELECT id FROM teacher_profiles WHERE school_id=? AND id=? AND active=1", actor.schoolId, data.teacherId);
  if (!teacher) throw new ValidationError("Professor não encontrado.");
  const students = await all<{ id: string }>(db, `SELECT id FROM student_profiles WHERE school_id=? AND id IN (${placeholders(data.studentIds)}) AND active=1`, actor.schoolId, ...data.studentIds);
  if (students.length !== new Set(data.studentIds).size) throw new ValidationError("Um ou mais alunos não estão ativos.");
  if (data.roomId) {
    const room = await first<{ capacity: number }>(db, "SELECT capacity FROM rooms WHERE school_id=? AND id=? AND active=1", actor.schoolId, data.roomId);
    if (!room) throw new ValidationError("Sala não encontrada.");
    if (data.studentIds.length > room.capacity) throw new ConflictError(`A sala comporta no máximo ${room.capacity} pessoas.`);
  }
  const occurrences = data.recurring ? (data.occurrences ?? 1) : 1;
  const makeupCredit = data.useMakeupCredit ? await first<{ id: string }>(db,
    `SELECT id FROM makeup_credits
     WHERE school_id=? AND student_id=? AND status='AVAILABLE' AND datetime(expires_at)>CURRENT_TIMESTAMP
     ORDER BY expires_at LIMIT 1`,
    actor.schoolId, data.studentIds[0],
  ) : null;
  if (data.useMakeupCredit && !makeupCredit) throw new ValidationError("Nenhum crédito de reposição válido está disponível para este aluno.");
  const seriesId = data.recurring ? crypto.randomUUID() : null;
  const statements: D1PreparedStatement[] = [];
  if (seriesId) statements.push(stmt(db, "INSERT INTO lesson_series (id,school_id,rule_rrule,timezone,starts_on,ends_on) VALUES (?,?,?,'America/Sao_Paulo',?,?)", seriesId, actor.schoolId, `FREQ=WEEKLY;COUNT=${occurrences}`, data.startsAt.slice(0,10), new Date(Date.parse(data.startsAt)+(occurrences-1)*7*86_400_000).toISOString().slice(0,10)));
  const createdIds: string[] = [];
  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    const shift = occurrence * 7 * 86_400_000;
    const startsAt = new Date(Date.parse(data.startsAt) + shift).toISOString();
    const endsAt = new Date(Date.parse(data.endsAt) + shift).toISOString();
    const bufferedEndsAt = new Date(Date.parse(endsAt) + bufferMinutes * 60_000).toISOString();
    const localStart = saoPauloParts(startsAt);
    const localEnd = saoPauloParts(endsAt);
    if (localStart.date !== localEnd.date) throw new ValidationError("A aula deve começar e terminar no mesmo dia no fuso da escola.");
    const recurringWindow = await first<{ id: string }>(db,
      `SELECT id FROM recurring_availability
       WHERE school_id=? AND teacher_id=? AND weekday=? AND start_time<=? AND end_time>=?
       AND valid_from<=? AND (valid_until IS NULL OR valid_until>=?) LIMIT 1`,
      actor.schoolId, data.teacherId, localStart.weekday, localStart.time, localEnd.time, localStart.date, localStart.date,
    );
    if (!recurringWindow) throw new ConflictError("O professor não está disponível neste horário pelas regras semanais cadastradas.");
    const exception = await first<{ id: string }>(db,
      "SELECT id FROM availability_exceptions WHERE school_id=? AND available=0 AND starts_at<? AND ends_at>? AND (teacher_id=? OR (teacher_id IS NULL AND unit_id=?)) LIMIT 1",
      actor.schoolId, endsAt, startsAt, data.teacherId, actor.unitId,
    );
    if (exception) throw new ConflictError("Há um bloqueio ou exceção de disponibilidade neste horário.");
    const lessonConflict = await first<{ kind: string }>(db,
      `SELECT 'PROFESSOR' AS kind FROM lessons WHERE school_id=? AND status NOT IN ('CANCELLED_SCHOOL','CANCELLED_STUDENT','RESCHEDULED') AND teacher_id=? AND datetime(starts_at)<datetime(?) AND datetime(ends_at, '+' || buffer_minutes || ' minutes')>datetime(?) LIMIT 1`,
      actor.schoolId, data.teacherId, bufferedEndsAt, startsAt,
    );
    if (lessonConflict) throw new ConflictError("O professor já possui uma aula neste intervalo.");
    if (data.roomId) {
      const roomConflict = await first<{ id: string }>(db,
        "SELECT id FROM lessons WHERE school_id=? AND room_id=? AND status NOT IN ('CANCELLED_SCHOOL','CANCELLED_STUDENT','RESCHEDULED') AND datetime(starts_at)<datetime(?) AND datetime(ends_at, '+' || buffer_minutes || ' minutes')>datetime(?) LIMIT 1",
        actor.schoolId, data.roomId, bufferedEndsAt, startsAt,
      );
      if (roomConflict) throw new ConflictError("A sala já está reservada neste intervalo.");
    }
    if (data.instrumentId) {
      const instrumentConflict = await first<{ id: string }>(db,
        "SELECT id FROM lessons WHERE school_id=? AND instrument_id=? AND status NOT IN ('CANCELLED_SCHOOL','CANCELLED_STUDENT','RESCHEDULED') AND datetime(starts_at)<datetime(?) AND datetime(ends_at, '+' || buffer_minutes || ' minutes')>datetime(?) LIMIT 1",
        actor.schoolId, data.instrumentId, bufferedEndsAt, startsAt,
      );
      if (instrumentConflict) throw new ConflictError("O instrumento selecionado já está reservado neste intervalo.");
    }
    const studentConflict = await first<{ id: string }>(db,
      `SELECT l.id FROM lessons l JOIN lesson_participants lp ON lp.lesson_id=l.id
       WHERE l.school_id=? AND lp.student_id IN (${placeholders(data.studentIds)})
       AND l.status NOT IN ('CANCELLED_SCHOOL','CANCELLED_STUDENT','RESCHEDULED')
       AND datetime(l.starts_at)<datetime(?) AND datetime(l.ends_at, '+' || l.buffer_minutes || ' minutes')>datetime(?) LIMIT 1`,
      actor.schoolId, ...data.studentIds, bufferedEndsAt, startsAt,
    );
    if (studentConflict) throw new ConflictError("Um dos alunos já possui aula neste intervalo.");

    const lessonId = crypto.randomUUID();
    createdIds.push(lessonId);
    statements.push(stmt(db,
      "INSERT INTO lessons (id,school_id,unit_id,series_id,teacher_id,room_id,instrument_id,title,starts_at,ends_at,buffer_minutes,modality,meeting_url_encrypted,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'SCHEDULED',?)",
      lessonId, actor.schoolId, actor.unitId, seriesId, data.teacherId, data.roomId ?? null, data.instrumentId ?? null,
      data.title, startsAt, endsAt, bufferMinutes, data.modality, data.meetingUrl ?? null, actor.userId,
    ));
    if (makeupCredit && occurrence === 0) {
      statements.push(stmt(db,
        "INSERT INTO makeup_credit_uses (id,school_id,credit_id,lesson_id) VALUES (?,?,?,?)",
        crypto.randomUUID(), actor.schoolId, makeupCredit.id, lessonId,
      ));
      statements.push(stmt(db,
        "UPDATE makeup_credits SET status='USED',used_lesson_id=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND id=? AND status='AVAILABLE'",
        lessonId, actor.schoolId, makeupCredit.id,
      ));
    }
    for (const studentId of data.studentIds) statements.push(stmt(db,
      "INSERT INTO lesson_participants (id,school_id,lesson_id,student_id,status) VALUES (?,?,?,?,'CONFIRMED')",
      crypto.randomUUID(), actor.schoolId, lessonId, studentId,
    ));
    const resources: LockResource[] = [
      { type: "TEACHER", id: data.teacherId },
      ...data.studentIds.map((id): LockResource => ({ type: "STUDENT", id })),
      ...(data.roomId ? [{ type: "ROOM" as const, id: data.roomId }] : []),
      ...(data.instrumentId ? [{ type: "INSTRUMENT" as const, id: data.instrumentId }] : []),
    ];
    for (const key of buildBookingLockKeys({ schoolId: actor.schoolId, startsAt, endsAt, bufferMinutes, resources })) {
      const parts = key.split(":");
      const resourceType = parts[1];
      const resourceId = parts[2];
      const slotStart = parts.slice(3).join(":");
      statements.push(stmt(db,
        "INSERT INTO booking_locks (id,school_id,lesson_id,resource_type,resource_id,slot_start) VALUES (?,?,?,?,?,?)",
      crypto.randomUUID(), actor.schoolId, lessonId, resourceType, resourceId, slotStart,
      ));
    }
  }
  try { await db.batch(statements); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("uq_booking_lock") || message.includes("UNIQUE constraint failed: booking_locks")) throw new ConflictError("O horário acabou de ser reservado por outra pessoa. Escolha outro horário.");
    if (message.includes("uq_makeup_credit_once") || message.includes("makeup_credit_uses")) throw new ConflictError("Este crédito de reposição acabou de ser utilizado em outro agendamento.");
    throw error;
  }
  await audit({ db, actor, request, action: "LESSON_CREATED", entityType: "LESSON", entityId: createdIds[0], metadata: { occurrences, seriesId, fields: ["teacher_id","student_ids","room_id","starts_at","ends_at"] } });
  return { ok: true, message: occurrences > 1 ? `${occurrences} aulas agendadas com verificação de conflitos.` : "Aula agendada com verificação de conflitos.", ids: createdIds };
}

async function cancelLesson(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "schedule:manage");
  const data = parse(z.object({ lessonId: z.string().min(8), reason: z.string().trim().min(3).max(500), cancelledBy: z.enum(["SCHOOL","STUDENT"]), generateCredit: z.boolean().default(false) }), payload);
  const lesson = await first<{ id: string; starts_at: string; status: string }>(db, "SELECT id,starts_at,status FROM lessons WHERE school_id=? AND id=?", actor.schoolId, data.lessonId);
  if (!lesson) throw new ValidationError("Aula não encontrada.");
  if (["COMPLETED","CANCELLED_SCHOOL","CANCELLED_STUDENT"].includes(lesson.status)) throw new ConflictError("Esta aula não pode mais ser cancelada.");
  const participants = await all<{ student_id: string }>(db, "SELECT student_id FROM lesson_participants WHERE school_id=? AND lesson_id=?", actor.schoolId, data.lessonId);
  const statements = [
    stmt(db, "UPDATE lessons SET status=?,cancellation_reason=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND id=?", data.cancelledBy === "SCHOOL" ? "CANCELLED_SCHOOL" : "CANCELLED_STUDENT", data.reason, actor.schoolId, data.lessonId),
    stmt(db, "DELETE FROM booking_locks WHERE school_id=? AND lesson_id=?", actor.schoolId, data.lessonId),
  ];
  if (data.generateCredit) for (const participant of participants) statements.push(stmt(db,
    "INSERT INTO makeup_credits (id,school_id,student_id,source_lesson_id,expires_at,status) VALUES (?,?,?,?,?,'AVAILABLE')",
    crypto.randomUUID(), actor.schoolId, participant.student_id, data.lessonId, new Date(Date.now()+60*86_400_000).toISOString(),
  ));
  await db.batch(statements);
  await audit({ db, actor, request, action: "LESSON_CANCELLED", entityType: "LESSON", entityId: data.lessonId, metadata: { cancelledBy: data.cancelledBy, creditGenerated: data.generateCredit } });
  return { ok: true, message: data.generateCredit ? "Aula cancelada e crédito de reposição gerado." : "Aula cancelada." };
}

async function recordAttendance(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "attendance:manage_own");
  const data = parse(attendanceSchema, payload);
  const lesson = await first<{ teacher_id: string; substitute_teacher_id: string | null }>(db, "SELECT teacher_id,substitute_teacher_id FROM lessons WHERE school_id=? AND id=?", actor.schoolId, data.lessonId);
  if (!lesson || !actor.teacherId || ![lesson.teacher_id, lesson.substitute_teacher_id].includes(actor.teacherId)) throw new AccessError("Somente o professor responsável pode registrar esta aula.");
  const participant = await first<{ id: string }>(db, "SELECT id FROM lesson_participants WHERE school_id=? AND lesson_id=? AND student_id=?", actor.schoolId, data.lessonId, data.studentId);
  if (!participant) throw new ValidationError("Aluno não participa desta aula.");
  const statements: D1PreparedStatement[] = [stmt(db,
    `INSERT INTO attendances (id,school_id,lesson_id,student_id,status,actual_start_at,actual_end_at,content,repertoire,exercises,private_notes,next_goal,replacement_needed,recorded_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(school_id,lesson_id,student_id) DO UPDATE SET status=excluded.status,actual_start_at=excluded.actual_start_at,
     actual_end_at=excluded.actual_end_at,content=excluded.content,repertoire=excluded.repertoire,exercises=excluded.exercises,
     private_notes=excluded.private_notes,next_goal=excluded.next_goal,replacement_needed=excluded.replacement_needed,
     recorded_by=excluded.recorded_by,recorded_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`,
    crypto.randomUUID(), actor.schoolId, data.lessonId, data.studentId, data.status, data.actualStartAt ?? null, data.actualEndAt ?? null,
    data.content, data.repertoire, data.exercises, data.privateNotes, data.nextGoal, data.replacementNeeded ? 1 : 0, actor.userId,
  )];
  if (["EXCUSED_ABSENCE"].includes(data.status) && data.replacementNeeded) statements.push(stmt(db,
    "INSERT OR IGNORE INTO makeup_credits (id,school_id,student_id,source_lesson_id,expires_at,status) VALUES (?,?,?,?,?,'AVAILABLE')",
    crypto.randomUUID(), actor.schoolId, data.studentId, data.lessonId, new Date(Date.now()+60*86_400_000).toISOString(),
  ));
  statements.push(stmt(db, "UPDATE lessons SET status='COMPLETED',updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND id=?", actor.schoolId, data.lessonId));
  await db.batch(statements);
  await audit({ db, actor, request, action: "ATTENDANCE_RECORDED", entityType: "LESSON", entityId: data.lessonId, metadata: { studentId: data.studentId, status: data.status, privateNotesStored: Boolean(data.privateNotes) } });
  return { ok: true, message: "Presença e conteúdo registrados." };
}

async function createTask(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "tasks:manage_own");
  const data = parse(taskSchema, payload);
  if (!actor.teacherId) throw new AccessError("É necessário um perfil de professor.");
  for (const studentId of data.studentIds) assertOwnedOrLinked({ role: actor.activeRole, requestedStudentId: studentId, teacherStudentIds: actor.teacherStudentIds });
  const id = crypto.randomUUID();
  const statements = [stmt(db,
    "INSERT INTO tasks (id,school_id,teacher_id,title,instructions,published_at,due_at,priority,evaluation_mode,max_attempts,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    id, actor.schoolId, actor.teacherId, data.title, data.instructions, data.publish ? new Date().toISOString() : null, data.dueAt, data.priority, data.evaluationMode, data.maxAttempts, data.publish ? "PUBLISHED" : "DRAFT",
  )];
  for (const studentId of data.studentIds) statements.push(stmt(db, "INSERT INTO task_recipients (id,school_id,task_id,student_id,status) VALUES (?,?,?,?,?)", crypto.randomUUID(), actor.schoolId, id, studentId, data.publish ? "PUBLISHED" : "DRAFT"));
  await db.batch(statements);
  await audit({ db, actor, request, action: data.publish ? "TASK_PUBLISHED" : "TASK_CREATED", entityType: "TASK", entityId: id, metadata: { recipientCount: data.studentIds.length } });
  return { ok: true, message: data.publish ? "Tarefa publicada." : "Rascunho de tarefa salvo.", id };
}

async function submitTask(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "tasks:submit_own");
  const data = parse(submissionSchema, payload);
  assertOwnedOrLinked({ role: actor.activeRole, actorStudentId: actor.studentId, requestedStudentId: data.studentId, linkedStudentIds: actor.linkedStudentIds });
  const task = await first<{ max_attempts: number; due_at: string; status: string }>(db,
    "SELECT t.max_attempts,t.due_at,t.status FROM tasks t JOIN task_recipients tr ON tr.task_id=t.id WHERE t.school_id=? AND t.id=? AND tr.student_id=?", actor.schoolId, data.taskId, data.studentId,
  );
  if (!task || task.status !== "PUBLISHED") throw new AccessError("Tarefa não disponível para este aluno.");
  const existing = await first<{ id: string; current_version: number }>(db, "SELECT id,current_version FROM submissions WHERE school_id=? AND task_id=? AND student_id=?", actor.schoolId, data.taskId, data.studentId);
  const nextVersion = (existing?.current_version ?? 0) + 1;
  if (nextVersion > task.max_attempts) throw new ConflictError("O limite de tentativas desta tarefa foi atingido.");
  const submissionId = existing?.id ?? crypto.randomUUID();
  const status = Date.parse(new Date().toISOString()) > Date.parse(task.due_at) ? "LATE" : "DELIVERED";
  await db.batch([
    stmt(db,
      `INSERT INTO submissions (id,school_id,task_id,student_id,status,current_version,submitted_at) VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(school_id,task_id,student_id) DO UPDATE SET status=excluded.status,current_version=excluded.current_version,submitted_at=excluded.submitted_at,updated_at=CURRENT_TIMESTAMP`,
      submissionId, actor.schoolId, data.taskId, data.studentId, status, nextVersion, new Date().toISOString(),
    ),
    stmt(db, "INSERT INTO submission_versions (id,school_id,submission_id,version_number,text_content,link_url,file_ids_json,submitted_at) VALUES (?,?,?,?,?,?,?,?)", crypto.randomUUID(), actor.schoolId, submissionId, nextVersion, data.textContent || null, data.linkUrl || null, JSON.stringify(data.fileIds), new Date().toISOString()),
    stmt(db, "UPDATE task_recipients SET status=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND task_id=? AND student_id=?", status, actor.schoolId, data.taskId, data.studentId),
  ]);
  await audit({ db, actor, request, action: "SUBMISSION_CREATED", entityType: "SUBMISSION", entityId: submissionId, metadata: { version: nextVersion, fileCount: (data.fileIds ?? []).length } });
  return { ok: true, message: status === "LATE" ? "Entrega enviada com atraso." : "Entrega enviada com privacidade.", id: submissionId, version: nextVersion };
}

async function reviewSubmission(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "tasks:manage_own");
  const data = parse(feedbackSchema, payload);
  const submission = await first<{ teacher_id: string; version_id: string; student_id: string }>(db,
    `SELECT t.teacher_id,sv.id AS version_id,s.student_id FROM submissions s JOIN tasks t ON t.id=s.task_id
     JOIN submission_versions sv ON sv.submission_id=s.id AND sv.version_number=s.current_version
     WHERE s.school_id=? AND s.id=?`, actor.schoolId, data.submissionId,
  );
  if (!submission || !actor.teacherId || submission.teacher_id !== actor.teacherId) throw new AccessError("Somente o professor responsável pode corrigir esta entrega.");
  const feedbackId = crypto.randomUUID();
  await db.batch([
    stmt(db, "INSERT INTO feedbacks (id,school_id,submission_version_id,author_user_id,private_message,strengths_json,improvements_json,grade_value,requests_revision) VALUES (?,?,?,?,?,?,?,?,?)", feedbackId, actor.schoolId, submission.version_id, actor.userId, data.message, JSON.stringify(data.strengths), JSON.stringify(data.improvements), data.gradeValue || null, data.requestsRevision ? 1 : 0),
    stmt(db, "UPDATE submissions SET status=?,completed_at=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND id=?", data.requestsRevision ? "REVISION_REQUESTED" : "COMPLETED", data.requestsRevision ? null : new Date().toISOString(), actor.schoolId, data.submissionId),
    stmt(db, "UPDATE task_recipients SET status=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND task_id=(SELECT task_id FROM submissions WHERE id=?) AND student_id=?", data.requestsRevision ? "REVISION_REQUESTED" : "COMPLETED", actor.schoolId, data.submissionId, submission.student_id),
  ]);
  await audit({ db, actor, request, action: data.requestsRevision ? "SUBMISSION_REVISION_REQUESTED" : "SUBMISSION_REVIEWED", entityType: "SUBMISSION", entityId: data.submissionId, metadata: { feedbackId } });
  return { ok: true, message: data.requestsRevision ? "Feedback enviado e nova versão solicitada." : "Correção concluída.", id: feedbackId };
}

async function transitionReport(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  const data = parse(reportTransitionSchema, payload);
  const report = await first<{ status: string; teacher_id: string; current_version: number; data_json: string }>(db,
    "SELECT mr.status,mr.teacher_id,mr.current_version,rv.data_json FROM monthly_reports mr JOIN report_versions rv ON rv.report_id=mr.id AND rv.version_number=mr.current_version WHERE mr.school_id=? AND mr.id=?", actor.schoolId, data.reportId,
  );
  if (!report) throw new ValidationError("Relatório não encontrado.");
  if (actor.activeRole === "PROFESSOR") {
    assertPermission(actor.activeRole, "reports:manage_own");
    if (!actor.teacherId || report.teacher_id !== actor.teacherId) throw new AccessError("Este relatório pertence a outro professor.");
  } else assertPermission(actor.activeRole, "reports:review");
  if (!canTransitionReport(report.status, data.toStatus, actor.activeRole)) throw new ConflictError("Transição de status não permitida.");
  const nextVersion = data.toStatus === "RECTIFIED" ? report.current_version + 1 : report.current_version;
  const statements: D1PreparedStatement[] = [];
  if (data.toStatus === "RECTIFIED") statements.push(stmt(db,
    "INSERT INTO report_versions (id,school_id,report_id,version_number,author_user_id,data_json,coordination_comment,change_reason) VALUES (?,?,?,?,?,?,?,?)",
    crypto.randomUUID(), actor.schoolId, data.reportId, nextVersion, actor.userId, report.data_json, data.coordinationComment || null, data.changeReason || "Retificação administrativa",
  ));
  statements.push(stmt(db,
    "UPDATE monthly_reports SET status=?,current_version=?,published_at=CASE WHEN ?='PUBLISHED' THEN CURRENT_TIMESTAMP ELSE published_at END,published_by=CASE WHEN ?='PUBLISHED' THEN ? ELSE published_by END,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND id=?",
    data.toStatus, nextVersion, data.toStatus, data.toStatus, actor.userId, actor.schoolId, data.reportId,
  ));
  if (data.coordinationComment && data.toStatus !== "RECTIFIED") statements.push(stmt(db,
    "UPDATE report_versions SET coordination_comment=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND report_id=? AND version_number=?",
    data.coordinationComment, actor.schoolId, data.reportId, report.current_version,
  ));
  await db.batch(statements);
  await audit({ db, actor, request, action: `REPORT_${data.toStatus}`, entityType: "MONTHLY_REPORT", entityId: data.reportId, metadata: { from: report.status, to: data.toStatus, version: nextVersion } });
  return { ok: true, message: `Relatório atualizado para ${data.toStatus.toLowerCase().replaceAll("_", " ")}.` };
}

async function createEvent(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "events:manage");
  const data = parse(eventSchema, payload);
  if (Date.parse(data.endsAt) <= Date.parse(data.startsAt)) throw new ValidationError("O evento precisa terminar após o início.");
  const audienceId = await validateAudienceTarget(db, actor, data.audienceType, data.audienceId);
  const id = crypto.randomUUID();
  await stmt(db,
    "INSERT INTO events (id,school_id,unit_id,type,title,description,starts_at,ends_at,location,capacity,audience_json,responsible_user_ids_json,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'PUBLISHED')",
    id, actor.schoolId, actor.unitId, data.type, data.title, data.description, data.startsAt, data.endsAt, data.location, data.capacity ?? null, JSON.stringify({ type: data.audienceType, id: audienceId }), JSON.stringify([actor.userId]),
  ).run();
  await audit({ db, actor, request, action: "EVENT_CREATED", entityType: "EVENT", entityId: id, metadata: { audience: data.audienceType, capacity: data.capacity } });
  return { ok: true, message: "Evento publicado.", id };
}

async function rsvpEvent(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "events:participate");
  const data = parse(z.object({ eventId: z.string().min(8), attending: z.boolean() }), payload);
  const audienceIds = await communicationAudienceIds(db, actor);
  const event = await first<{ capacity: number | null; registrations: number }>(db,
    `SELECT e.capacity,COUNT(er.id) AS registrations FROM events e
     LEFT JOIN event_registrations er ON er.event_id=e.id AND er.status='CONFIRMED'
     WHERE e.school_id=? AND e.id=? AND e.status='PUBLISHED'
     AND (json_extract(e.audience_json,'$.type')='ALL' OR json_extract(e.audience_json,'$.id') IN (${placeholders(audienceIds)}))
     GROUP BY e.id`, actor.schoolId, data.eventId, ...audienceIds,
  );
  if (!event) throw new ValidationError("Evento não encontrado.");
  const full = data.attending && event.capacity !== null && event.registrations >= event.capacity;
  const status = !data.attending ? "DECLINED" : full ? "WAITLIST" : "CONFIRMED";
  await stmt(db,
    `INSERT INTO event_registrations (id,school_id,event_id,user_id,status,waitlist_position) VALUES (?,?,?,?,?,?)
     ON CONFLICT(school_id,event_id,user_id) DO UPDATE SET status=excluded.status,waitlist_position=excluded.waitlist_position,updated_at=CURRENT_TIMESTAMP`,
    crypto.randomUUID(), actor.schoolId, data.eventId, actor.userId, status, full ? event.registrations - (event.capacity ?? 0) + 1 : null,
  ).run();
  await audit({ db, actor, request, action: "EVENT_RSVP", entityType: "EVENT", entityId: data.eventId, metadata: { status } });
  return { ok: true, message: full ? "Evento lotado. Você entrou na lista de espera." : data.attending ? "Participação confirmada." : "Participação recusada." };
}

async function createAnnouncement(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "announcements:manage");
  const data = parse(announcementSchema, payload);
  const audienceId = await validateAudienceTarget(db, actor, data.audienceType, data.audienceId);
  const id = crypto.randomUUID();
  await db.batch([
    stmt(db, "INSERT INTO announcements (id,school_id,author_user_id,title,body,priority,published_at,requires_acknowledgement) VALUES (?,?,?,?,?,?,?,?)", id, actor.schoolId, actor.userId, data.title, data.body, data.priority, new Date().toISOString(), data.requiresAcknowledgement ? 1 : 0),
    stmt(db, "INSERT INTO announcement_audiences (id,school_id,announcement_id,audience_type,audience_id) VALUES (?,?,?,?,?)", crypto.randomUUID(), actor.schoolId, id, data.audienceType, audienceId),
  ]);
  await audit({ db, actor, request, action: "ANNOUNCEMENT_PUBLISHED", entityType: "ANNOUNCEMENT", entityId: id, metadata: { audienceType: data.audienceType } });
  return { ok: true, message: "Aviso publicado para o público selecionado.", id };
}

async function acknowledgeAnnouncement(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  const data = parse(z.object({ announcementId: z.string().min(8) }), payload);
  const manager = ["ADMIN", "DIRECAO", "SECRETARIA", "COORDENACAO"].includes(actor.activeRole);
  const audienceIds = await communicationAudienceIds(db, actor);
  const audienceCheck = manager ? "" : `AND EXISTS (
    SELECT 1 FROM announcement_audiences aa WHERE aa.announcement_id=announcements.id AND aa.school_id=announcements.school_id
    AND (aa.audience_type='ALL' OR aa.audience_id IN (${placeholders(audienceIds)}))
  )`;
  const exists = await first<{ id: string }>(db, `SELECT id FROM announcements WHERE school_id=? AND id=? ${audienceCheck}`, actor.schoolId, data.announcementId, ...(manager ? [] : audienceIds));
  if (!exists) throw new ValidationError("Aviso não encontrado.");
  await stmt(db,
    `INSERT INTO read_receipts (id,school_id,announcement_id,user_id,read_at) VALUES (?,?,?,?,?)
     ON CONFLICT(school_id,announcement_id,user_id) DO UPDATE SET read_at=excluded.read_at,updated_at=CURRENT_TIMESTAMP`,
    crypto.randomUUID(), actor.schoolId, data.announcementId, actor.userId, new Date().toISOString(),
  ).run();
  await audit({ db, actor, request, action: "ANNOUNCEMENT_ACKNOWLEDGED", entityType: "ANNOUNCEMENT", entityId: data.announcementId });
  return { ok: true, message: "Leitura confirmada." };
}

async function addPractice(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "practice:manage_own");
  const data = parse(practiceSchema, payload);
  assertOwnedOrLinked({ role: actor.activeRole, actorStudentId: actor.studentId, requestedStudentId: data.studentId, linkedStudentIds: actor.linkedStudentIds });
  const id = crypto.randomUUID();
  await stmt(db, "INSERT INTO practice_entries (id,school_id,student_id,practiced_on,minutes,repertoire,difficulty,observations,share_with_teacher) VALUES (?,?,?,?,?,?,?,?,?)", id, actor.schoolId, data.studentId, data.practicedOn, data.minutes, data.repertoire || null, data.difficulty || null, data.observations || null, data.shareWithTeacher ? 1 : 0).run();
  await audit({ db, actor, request, action: "PRACTICE_RECORDED", entityType: "PRACTICE_ENTRY", entityId: id, metadata: { minutes: data.minutes, shared: data.shareWithTeacher } });
  return { ok: true, message: "Prática registrada. Você controla o que é compartilhado.", id };
}

async function recordPayment(db: D1Database, payload: unknown, actor: Actor) {
  assertPermission(actor.activeRole, "finance:manage");
  const data = parse(paymentSchema, payload);
  const charge = await first<{ final_amount_cents: number; payment_version: number; paid: number }>(db,
    "SELECT c.final_amount_cents,c.payment_version,COALESCE(SUM(p.amount_cents),0) AS paid FROM charges c LEFT JOIN payments p ON p.charge_id=c.id WHERE c.school_id=? AND c.id=? GROUP BY c.id", actor.schoolId, data.chargeId,
  );
  if (!charge) throw new ValidationError("Cobrança não encontrada.");
  if (data.amountCents > charge.final_amount_cents - charge.paid) throw new ValidationError("O pagamento excede o saldo da cobrança.");
  const id = crypto.randomUUID();
  const newPaid = charge.paid + data.amountCents;
  const nextVersion = charge.payment_version + 1;
  try {
    await db.batch([
      stmt(db, "INSERT INTO payments (id,school_id,charge_id,charge_version,amount_cents,paid_at,method,recorded_by) VALUES (?,?,?,?,?,?,?,?)", id, actor.schoolId, data.chargeId, nextVersion, data.amountCents, new Date().toISOString(), data.method, actor.userId),
      stmt(db, "UPDATE charges SET status=?,payment_version=?,updated_at=CURRENT_TIMESTAMP WHERE school_id=? AND id=? AND payment_version=?", newPaid >= charge.final_amount_cents ? "PAID" : "PARTIAL", nextVersion, actor.schoolId, data.chargeId, charge.payment_version),
      stmt(db, "INSERT INTO audit_logs (id,school_id,actor_user_id,actor_role,action,entity_type,entity_id,outcome,metadata_json) VALUES (?,?,?,?,?,'PAYMENT',?,'SUCCESS',?)", crypto.randomUUID(), actor.schoolId, actor.userId, actor.activeRole, "PAYMENT_RECORDED", id, JSON.stringify({ chargeId: data.chargeId, amountCents: data.amountCents, method: data.method, chargeVersion: nextVersion })),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("uq_payments_charge_version") || message.includes("payments.school_id, payments.charge_id, payments.charge_version")) {
      throw new ConflictError("A cobrança foi atualizada por outra operação. Recarregue e confirme o saldo antes de tentar novamente.");
    }
    throw error;
  }
  return { ok: true, message: "Pagamento registrado e cobrança atualizada.", id };
}

async function createStudent(db: D1Database, payload: unknown, actor: Actor, request: Request) {
  assertPermission(actor.activeRole, "people:manage");
  const data = parse(z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), birthDate: z.string().date().optional().nullable() }), payload);
  const userId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  await db.batch([
    stmt(db, "INSERT INTO users (id,school_id,identity_subject,email,display_name,status,mfa_required) VALUES (?,?,?,?,?,'INVITED',0)", userId, actor.schoolId, `pending:${crypto.randomUUID()}`, data.email.toLowerCase(), data.name),
    stmt(db, "INSERT INTO student_profiles (id,school_id,user_id,unit_id,birth_date,active) VALUES (?,?,?,?,?,1)", studentId, actor.schoolId, userId, actor.unitId, data.birthDate ?? null),
    stmt(db, "INSERT INTO user_roles (id,school_id,user_id,role_id,unit_id,granted_by) VALUES (?,?,?,?,?,?)", crypto.randomUUID(), actor.schoolId, userId, "rol_aluno_harmonia", actor.unitId, actor.userId),
  ]);
  await audit({ db, actor, request, action: "STUDENT_CREATED", entityType: "STUDENT", entityId: studentId, metadata: { invitationPending: true } });
  return { ok: true, message: "Aluno cadastrado. O convite de acesso está pendente do provedor de identidade.", id: studentId };
}
