import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  primaryColor: text("primary_color").notNull().default("#102746"),
  accentColor: text("accent_color").notNull().default("#E49B32"),
  logoFileId: text("logo_file_id"),
  settingsJson: text("settings_json").notNull().default("{}"),
  ...timestamps,
});

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
  addressJson: text("address_json").notNull().default("{}"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [index("idx_units_school").on(t.schoolId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  identitySubject: text("identity_subject").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  phoneEncrypted: text("phone_encrypted"),
  status: text("status").notNull().default("ACTIVE"),
  mfaRequired: integer("mfa_required", { mode: "boolean" }).notNull().default(false),
  lastLoginAt: text("last_login_at"),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_users_school_subject").on(t.schoolId, t.identitySubject),
  uniqueIndex("uq_users_school_email").on(t.schoolId, t.email),
  index("idx_users_school_status").on(t.schoolId, t.status),
]);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  systemRole: integer("system_role", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("uq_roles_school_code").on(t.schoolId, t.code)]);

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  dataScope: text("data_scope").notNull().default("SCHOOL"),
  ...timestamps,
});

export const userRoles = sqliteTable("user_roles", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  userId: text("user_id").notNull().references(() => users.id),
  roleId: text("role_id").notNull().references(() => roles.id),
  unitId: text("unit_id").references(() => units.id),
  grantedBy: text("granted_by"),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_user_roles_context").on(t.schoolId, t.userId, t.roleId, t.unitId),
  index("idx_user_roles_user").on(t.schoolId, t.userId),
]);

export const rolePermissions = sqliteTable("role_permissions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  roleId: text("role_id").notNull().references(() => roles.id),
  permissionId: text("permission_id").notNull().references(() => permissions.id),
  ...timestamps,
}, (t) => [uniqueIndex("uq_role_permissions").on(t.schoolId, t.roleId, t.permissionId)]);

export const studentProfiles = sqliteTable("student_profiles", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  userId: text("user_id").notNull().references(() => users.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  birthDate: text("birth_date"),
  notesRestricted: text("notes_restricted"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_student_profiles_user").on(t.schoolId, t.userId),
  index("idx_students_unit_active").on(t.schoolId, t.unitId, t.active),
]);

export const teacherProfiles = sqliteTable("teacher_profiles", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  userId: text("user_id").notNull().references(() => users.id),
  bio: text("bio"),
  employmentReference: text("employment_reference"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("uq_teacher_profiles_user").on(t.schoolId, t.userId)]);

export const guardianLinks = sqliteTable("guardian_links", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  guardianUserId: text("guardian_user_id").notNull().references(() => users.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  relationship: text("relationship").notNull(),
  financialAccess: integer("financial_access", { mode: "boolean" }).notNull().default(true),
  scheduleAuthority: integer("schedule_authority", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_guardian_student").on(t.schoolId, t.guardianUserId, t.studentId),
  index("idx_guardian_links_student").on(t.schoolId, t.studentId),
]);

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
  description: text("description"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [index("idx_courses_school_active").on(t.schoolId, t.active)]);

export const instruments = sqliteTable("instruments", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
  family: text("family"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("uq_instruments_school_name").on(t.schoolId, t.name)]);

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(1),
  accessible: integer("accessible", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("uq_rooms_unit_name").on(t.schoolId, t.unitId, t.name)]);

export const roomResources = sqliteTable("room_resources", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  roomId: text("room_id").notNull().references(() => rooms.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  ...timestamps,
}, (t) => [index("idx_room_resources_room").on(t.schoolId, t.roomId)]);

export const schoolInstruments = sqliteTable("school_instruments", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  instrumentId: text("instrument_id").notNull().references(() => instruments.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  assetTag: text("asset_tag").notNull(),
  condition: text("condition").notNull().default("GOOD"),
  status: text("status").notNull().default("AVAILABLE"),
  ...timestamps,
}, (t) => [uniqueIndex("uq_school_instruments_asset").on(t.schoolId, t.assetTag)]);

export const instrumentLoans = sqliteTable("instrument_loans", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  schoolInstrumentId: text("school_instrument_id").notNull().references(() => schoolInstruments.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  loanedAt: text("loaned_at").notNull(),
  dueAt: text("due_at").notNull(),
  returnedAt: text("returned_at"),
  responsibilityFileId: text("responsibility_file_id"),
  ...timestamps,
}, (t) => [index("idx_loans_school_student").on(t.schoolId, t.studentId)]);

export const instrumentMaintenances = sqliteTable("instrument_maintenances", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  schoolInstrumentId: text("school_instrument_id").notNull().references(() => schoolInstruments.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  description: text("description").notNull(),
  costCents: integer("cost_cents"),
  ...timestamps,
}, (t) => [index("idx_maintenance_instrument").on(t.schoolId, t.schoolInstrumentId, t.startsAt)]);

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  courseId: text("course_id").notNull().references(() => courses.id),
  instrumentId: text("instrument_id").references(() => instruments.id),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(1),
  modality: text("modality").notNull().default("IN_PERSON"),
  status: text("status").notNull().default("ACTIVE"),
  ...timestamps,
}, (t) => [index("idx_classes_school_unit").on(t.schoolId, t.unitId, t.status)]);

export const enrollments = sqliteTable("enrollments", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  classId: text("class_id").notNull().references(() => classes.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  status: text("status").notNull().default("ACTIVE"),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_enrollment_active").on(t.schoolId, t.classId, t.studentId, t.startsOn),
  index("idx_enrollments_student").on(t.schoolId, t.studentId, t.status),
]);

export const classTeachers = sqliteTable("class_teachers", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  classId: text("class_id").notNull().references(() => classes.id),
  teacherId: text("teacher_id").notNull().references(() => teacherProfiles.id),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  ...timestamps,
}, (t) => [index("idx_class_teachers_teacher").on(t.schoolId, t.teacherId, t.startsOn)]);

export const recurringAvailability = sqliteTable("recurring_availability", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  teacherId: text("teacher_id").notNull().references(() => teacherProfiles.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  validFrom: text("valid_from").notNull(),
  validUntil: text("valid_until"),
  ...timestamps,
}, (t) => [index("idx_availability_teacher_day").on(t.schoolId, t.teacherId, t.weekday)]);

export const availabilityExceptions = sqliteTable("availability_exceptions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  teacherId: text("teacher_id").references(() => teacherProfiles.id),
  unitId: text("unit_id").references(() => units.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  kind: text("kind").notNull(),
  available: integer("available", { mode: "boolean" }).notNull().default(false),
  reason: text("reason"),
  ...timestamps,
}, (t) => [index("idx_availability_exception_range").on(t.schoolId, t.startsAt, t.endsAt)]);

export const lessonSeries = sqliteTable("lesson_series", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  ruleRrule: text("rule_rrule").notNull(),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  exceptionPolicy: text("exception_policy").notNull().default("KEEP"),
  ...timestamps,
}, (t) => [index("idx_lesson_series_school").on(t.schoolId, t.startsOn)]);

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  seriesId: text("series_id").references(() => lessonSeries.id),
  classId: text("class_id").references(() => classes.id),
  teacherId: text("teacher_id").notNull().references(() => teacherProfiles.id),
  substituteTeacherId: text("substitute_teacher_id").references(() => teacherProfiles.id),
  roomId: text("room_id").references(() => rooms.id),
  instrumentId: text("instrument_id").references(() => instruments.id),
  title: text("title").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  bufferMinutes: integer("buffer_minutes").notNull().default(10),
  modality: text("modality").notNull().default("IN_PERSON"),
  meetingUrlEncrypted: text("meeting_url_encrypted"),
  status: text("status").notNull().default("SCHEDULED"),
  changeScope: text("change_scope"),
  cancellationReason: text("cancellation_reason"),
  createdBy: text("created_by").notNull().references(() => users.id),
  ...timestamps,
}, (t) => [
  index("idx_lessons_school_range").on(t.schoolId, t.startsAt, t.endsAt),
  index("idx_lessons_teacher_range").on(t.schoolId, t.teacherId, t.startsAt),
  index("idx_lessons_room_range").on(t.schoolId, t.roomId, t.startsAt),
]);

export const lessonParticipants = sqliteTable("lesson_participants", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  status: text("status").notNull().default("CONFIRMED"),
  waitlistPosition: integer("waitlist_position"),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_lesson_participant").on(t.schoolId, t.lessonId, t.studentId),
  index("idx_lesson_participant_student").on(t.schoolId, t.studentId, t.lessonId),
]);

export const bookingLocks = sqliteTable("booking_locks", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  slotStart: text("slot_start").notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_booking_lock").on(t.schoolId, t.resourceType, t.resourceId, t.slotStart),
  index("idx_booking_locks_lesson").on(t.schoolId, t.lessonId),
]);

export const attendances = sqliteTable("attendances", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  status: text("status").notNull(),
  actualStartAt: text("actual_start_at"),
  actualEndAt: text("actual_end_at"),
  content: text("content"),
  repertoire: text("repertoire"),
  exercises: text("exercises"),
  privateNotes: text("private_notes"),
  nextGoal: text("next_goal"),
  replacementNeeded: integer("replacement_needed", { mode: "boolean" }).notNull().default(false),
  recordedBy: text("recorded_by").notNull().references(() => users.id),
  recordedAt: text("recorded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
}, (t) => [uniqueIndex("uq_attendance_lesson_student").on(t.schoolId, t.lessonId, t.studentId)]);

export const makeupCredits = sqliteTable("makeup_credits", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  sourceLessonId: text("source_lesson_id").notNull().references(() => lessons.id),
  usedLessonId: text("used_lesson_id").references(() => lessons.id),
  expiresAt: text("expires_at").notNull(),
  status: text("status").notNull().default("AVAILABLE"),
  ...timestamps,
}, (t) => [
  index("idx_makeup_student_status").on(t.schoolId, t.studentId, t.status, t.expiresAt),
  uniqueIndex("uq_makeup_source_student").on(t.schoolId, t.studentId, t.sourceLessonId),
]);

export const makeupCreditUses = sqliteTable("makeup_credit_uses", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  creditId: text("credit_id").notNull().references(() => makeupCredits.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id),
  usedAt: text("used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex("uq_makeup_credit_once").on(t.schoolId, t.creditId),
  uniqueIndex("uq_makeup_lesson_once").on(t.schoolId, t.lessonId),
]);

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name").notNull(),
  extension: text("extension").notNull(),
  detectedMime: text("detected_mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  scanStatus: text("scan_status").notNull().default("QUARANTINED"),
  sensitivity: text("sensitivity").notNull().default("PRIVATE"),
  deletedAt: text("deleted_at"),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_files_storage_key").on(t.schoolId, t.storageKey),
  index("idx_files_owner").on(t.schoolId, t.ownerUserId, t.createdAt),
]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  teacherId: text("teacher_id").notNull().references(() => teacherProfiles.id),
  courseId: text("course_id").references(() => courses.id),
  instrumentId: text("instrument_id").references(() => instruments.id),
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  publishedAt: text("published_at"),
  dueAt: text("due_at").notNull(),
  priority: text("priority").notNull().default("MEDIUM"),
  evaluationMode: text("evaluation_mode").notNull().default("CONCEPT"),
  criteriaJson: text("criteria_json").notNull().default("[]"),
  maxAttempts: integer("max_attempts").notNull().default(2),
  status: text("status").notNull().default("DRAFT"),
  ...timestamps,
}, (t) => [index("idx_tasks_teacher_due").on(t.schoolId, t.teacherId, t.dueAt)]);

export const taskRecipients = sqliteTable("task_recipients", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  taskId: text("task_id").notNull().references(() => tasks.id),
  studentId: text("student_id").references(() => studentProfiles.id),
  classId: text("class_id").references(() => classes.id),
  status: text("status").notNull().default("PUBLISHED"),
  ...timestamps,
}, (t) => [index("idx_task_recipients_student").on(t.schoolId, t.studentId, t.status)]);

export const taskMaterials = sqliteTable("task_materials", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  taskId: text("task_id").notNull().references(() => tasks.id),
  fileId: text("file_id").references(() => files.id),
  url: text("url"),
  label: text("label").notNull(),
  ...timestamps,
}, (t) => [index("idx_task_materials_task").on(t.schoolId, t.taskId)]);

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  taskId: text("task_id").notNull().references(() => tasks.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  status: text("status").notNull().default("IN_PROGRESS"),
  currentVersion: integer("current_version").notNull().default(0),
  submittedAt: text("submitted_at"),
  completedAt: text("completed_at"),
  ...timestamps,
}, (t) => [uniqueIndex("uq_submission_task_student").on(t.schoolId, t.taskId, t.studentId)]);

export const submissionVersions = sqliteTable("submission_versions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  submissionId: text("submission_id").notNull().references(() => submissions.id),
  versionNumber: integer("version_number").notNull(),
  textContent: text("text_content"),
  linkUrl: text("link_url"),
  fileIdsJson: text("file_ids_json").notNull().default("[]"),
  submittedAt: text("submitted_at").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("uq_submission_version").on(t.schoolId, t.submissionId, t.versionNumber)]);

export const feedbacks = sqliteTable("feedbacks", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  submissionVersionId: text("submission_version_id").notNull().references(() => submissionVersions.id),
  authorUserId: text("author_user_id").notNull().references(() => users.id),
  privateMessage: text("private_message").notNull(),
  strengthsJson: text("strengths_json").notNull().default("[]"),
  improvementsJson: text("improvements_json").notNull().default("[]"),
  gradeValue: text("grade_value"),
  rubricJson: text("rubric_json").notNull().default("{}"),
  guidanceFileId: text("guidance_file_id").references(() => files.id),
  requestsRevision: integer("requests_revision", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (t) => [index("idx_feedback_submission").on(t.schoolId, t.submissionVersionId)]);

export const practiceEntries = sqliteTable("practice_entries", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  practicedOn: text("practiced_on").notNull(),
  minutes: integer("minutes").notNull(),
  repertoire: text("repertoire"),
  difficulty: text("difficulty"),
  observations: text("observations"),
  shareWithTeacher: integer("share_with_teacher", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [index("idx_practice_student_date").on(t.schoolId, t.studentId, t.practicedOn)]);

export const repertoireCatalog = sqliteTable("repertoire_catalog", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  title: text("title").notNull(),
  composer: text("composer"),
  kind: text("kind").notNull().default("MUSIC"),
  level: text("level"),
  ...timestamps,
}, (t) => [index("idx_repertoire_title").on(t.schoolId, t.title)]);

export const studentRepertoire = sqliteTable("student_repertoire", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  repertoireId: text("repertoire_id").notNull().references(() => repertoireCatalog.id),
  tempoBpm: integer("tempo_bpm"),
  keySignature: text("key_signature"),
  level: text("level"),
  status: text("status").notNull().default("CURRENT"),
  startedOn: text("started_on"),
  completedOn: text("completed_on"),
  ...timestamps,
}, (t) => [index("idx_student_repertoire").on(t.schoolId, t.studentId, t.status)]);

export const studentGoals = sqliteTable("student_goals", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  title: text("title").notNull(),
  targetDate: text("target_date"),
  status: text("status").notNull().default("ACTIVE"),
  progressPercent: integer("progress_percent").notNull().default(0),
  ...timestamps,
}, (t) => [index("idx_student_goals").on(t.schoolId, t.studentId, t.status)]);

export const monthlyReports = sqliteTable("monthly_reports", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  teacherId: text("teacher_id").notNull().references(() => teacherProfiles.id),
  referenceMonth: text("reference_month").notNull(),
  status: text("status").notNull().default("DRAFT"),
  currentVersion: integer("current_version").notNull().default(1),
  publishedAt: text("published_at"),
  publishedBy: text("published_by").references(() => users.id),
  ...timestamps,
}, (t) => [
  uniqueIndex("uq_monthly_report").on(t.schoolId, t.studentId, t.teacherId, t.referenceMonth),
  index("idx_reports_status_month").on(t.schoolId, t.status, t.referenceMonth),
]);

export const reportVersions = sqliteTable("report_versions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  reportId: text("report_id").notNull().references(() => monthlyReports.id),
  versionNumber: integer("version_number").notNull(),
  authorUserId: text("author_user_id").notNull().references(() => users.id),
  dataJson: text("data_json").notNull(),
  coordinationComment: text("coordination_comment"),
  changeReason: text("change_reason"),
  ...timestamps,
}, (t) => [uniqueIndex("uq_report_version").on(t.schoolId, t.reportId, t.versionNumber)]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  unitId: text("unit_id").references(() => units.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  location: text("location").notNull(),
  capacity: integer("capacity"),
  audienceJson: text("audience_json").notNull().default("{}"),
  responsibleUserIdsJson: text("responsible_user_ids_json").notNull().default("[]"),
  attachmentFileIdsJson: text("attachment_file_ids_json").notNull().default("[]"),
  status: text("status").notNull().default("PUBLISHED"),
  ...timestamps,
}, (t) => [index("idx_events_school_start").on(t.schoolId, t.startsAt)]);

export const eventRegistrations = sqliteTable("event_registrations", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  eventId: text("event_id").notNull().references(() => events.id),
  userId: text("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("CONFIRMED"),
  waitlistPosition: integer("waitlist_position"),
  checkedInAt: text("checked_in_at"),
  ...timestamps,
}, (t) => [uniqueIndex("uq_event_registration").on(t.schoolId, t.eventId, t.userId)]);

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  authorUserId: text("author_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  priority: text("priority").notNull().default("NORMAL"),
  publishedAt: text("published_at").notNull(),
  expiresAt: text("expires_at"),
  requiresAcknowledgement: integer("requires_acknowledgement", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (t) => [index("idx_announcements_school_publish").on(t.schoolId, t.publishedAt)]);

export const announcementAudiences = sqliteTable("announcement_audiences", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  announcementId: text("announcement_id").notNull().references(() => announcements.id),
  audienceType: text("audience_type").notNull(),
  audienceId: text("audience_id"),
  ...timestamps,
}, (t) => [index("idx_announcement_audience").on(t.schoolId, t.audienceType, t.audienceId)]);

export const readReceipts = sqliteTable("read_receipts", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  announcementId: text("announcement_id").notNull().references(() => announcements.id),
  userId: text("user_id").notNull().references(() => users.id),
  readAt: text("read_at").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("uq_read_receipt").on(t.schoolId, t.announcementId, t.userId)]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  readAt: text("read_at"),
  ...timestamps,
}, (t) => [index("idx_notifications_user_unread").on(t.schoolId, t.userId, t.readAt, t.createdAt)]);

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  userId: text("user_id").notNull().references(() => users.id),
  channel: text("channel").notNull(),
  eventType: text("event_type").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("uq_notification_preference").on(t.schoolId, t.userId, t.channel, t.eventType)]);

export const financialPlans = sqliteTable("financial_plans", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  billingCycle: text("billing_cycle").notNull().default("MONTHLY"),
  lessonCredits: integer("lesson_credits"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [index("idx_plans_school_active").on(t.schoolId, t.active)]);

export const charges = sqliteTable("charges", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  studentId: text("student_id").notNull().references(() => studentProfiles.id),
  planId: text("plan_id").references(() => financialPlans.id),
  referenceMonth: text("reference_month").notNull(),
  dueDate: text("due_date").notNull(),
  originalAmountCents: integer("original_amount_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  finalAmountCents: integer("final_amount_cents").notNull(),
  status: text("status").notNull().default("OPEN"),
  paymentVersion: integer("payment_version").notNull().default(0),
  ...timestamps,
}, (t) => [index("idx_charges_student_due").on(t.schoolId, t.studentId, t.dueDate)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  chargeId: text("charge_id").notNull().references(() => charges.id),
  chargeVersion: integer("charge_version").notNull().default(0),
  amountCents: integer("amount_cents").notNull(),
  paidAt: text("paid_at").notNull(),
  method: text("method").notNull(),
  providerReference: text("provider_reference"),
  receiptFileId: text("receipt_file_id").references(() => files.id),
  recordedBy: text("recorded_by").notNull().references(() => users.id),
  ...timestamps,
}, (t) => [
  index("idx_payments_charge").on(t.schoolId, t.chargeId, t.paidAt),
  uniqueIndex("uq_payments_charge_version").on(t.schoolId, t.chargeId, t.chargeVersion),
]);

export const consents = sqliteTable("consents", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  subjectUserId: text("subject_user_id").notNull().references(() => users.id),
  grantedByUserId: text("granted_by_user_id").references(() => users.id),
  purpose: text("purpose").notNull(),
  legalBasis: text("legal_basis").notNull(),
  noticeVersion: text("notice_version").notNull(),
  status: text("status").notNull(),
  source: text("source").notNull(),
  grantedAt: text("granted_at"),
  revokedAt: text("revoked_at"),
  expiresAt: text("expires_at"),
  evidenceHash: text("evidence_hash"),
  ...timestamps,
}, (t) => [index("idx_consents_subject_purpose").on(t.schoolId, t.subjectUserId, t.purpose, t.status)]);

export const teacherAbsences = sqliteTable("teacher_absences", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  teacherId: text("teacher_id").notNull().references(() => teacherProfiles.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("REQUESTED"),
  approvedBy: text("approved_by").references(() => users.id),
  ...timestamps,
}, (t) => [index("idx_teacher_absences").on(t.schoolId, t.teacherId, t.startsAt)]);

export const lessonSubstitutions = sqliteTable("lesson_substitutions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id),
  originalTeacherId: text("original_teacher_id").notNull().references(() => teacherProfiles.id),
  substituteTeacherId: text("substitute_teacher_id").notNull().references(() => teacherProfiles.id),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  approvedBy: text("approved_by").references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  ...timestamps,
}, (t) => [index("idx_substitutions_lesson").on(t.schoolId, t.lessonId)]);

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  userId: text("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  requestKey: text("request_key").notNull(),
  responseJson: text("response_json"),
  expiresAt: text("expires_at").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("uq_idempotency_request").on(t.schoolId, t.userId, t.action, t.requestKey)]);

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  subjectKey: text("subject_key").notNull(),
  operation: text("operation").notNull(),
  windowStart: text("window_start").notNull(),
  requestCount: integer("request_count").notNull().default(1),
  ...timestamps,
}, (t) => [uniqueIndex("uq_rate_limit_window").on(t.schoolId, t.subjectKey, t.operation, t.windowStart)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  actorUserId: text("actor_user_id").references(() => users.id),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  outcome: text("outcome").notNull(),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index("idx_audit_school_time").on(t.schoolId, t.occurredAt),
  index("idx_audit_entity").on(t.schoolId, t.entityType, t.entityId),
]);

export const indicatorSnapshots = sqliteTable("indicator_snapshots", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  teacherId: text("teacher_id").notNull().references(() => teacherProfiles.id),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  metricsJson: text("metrics_json").notNull(),
  sampleSize: integer("sample_size").notNull(),
  sourceVersion: text("source_version").notNull(),
  calculatedAt: text("calculated_at").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("uq_indicator_snapshot").on(t.schoolId, t.teacherId, t.periodStart, t.periodEnd)]);
