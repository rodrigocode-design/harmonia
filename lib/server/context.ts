import { env } from "cloudflare:workers";
import { getD1 } from "@/db";
import { AccessError, isRoleCode, type RoleCode } from "@/lib/access";
import { IDS, ROLE_NAMES, localIso, roleId } from "@/lib/server/constants";
import { getSessionSecret, readCookie, verifySessionCookieValue } from "@/lib/server/session";

export type Actor = {
  userId: string;
  identitySubject: string;
  email: string;
  displayName: string;
  schoolId: string;
  unitId: string;
  roles: RoleCode[];
  activeRole: RoleCode;
  studentId: string | null;
  teacherId: string | null;
  linkedStudentIds: string[];
  teacherStudentIds: string[];
};

class AuthenticationError extends Error {
  readonly status = 401;
}

export type AuthHeaders = { userId: string; email: string; displayName: string };

async function readAuthHeaders(request: Request): Promise<AuthHeaders> {
  const cookie = readCookie(request, "harmonia_session");
  if (!cookie) throw new AuthenticationError("Faça login para continuar.");
  const secret = getSessionSecret(env as { SESSION_SECRET?: string });
  const session = await verifySessionCookieValue(cookie, secret);
  if (!session) throw new AuthenticationError("Sua sessão expirou. Faça login novamente.");
  return { userId: session.sub, email: session.email.toLowerCase(), displayName: session.name };
}

function stmt(db: D1Database, sql: string, ...values: unknown[]) {
  return db.prepare(sql).bind(...values);
}

async function hashIdentifier(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).slice(0, 16).map((n) => n.toString(16).padStart(2, "0")).join("");
}

async function first<T>(db: D1Database, sql: string, ...values: unknown[]): Promise<T | null> {
  return (await stmt(db, sql, ...values).first<T>()) ?? null;
}

export async function ensureActor(request: Request): Promise<Actor> {
  const auth = await readAuthHeaders(request);
  const db = getD1();
  let school = await first<{ id: string }>(db, "SELECT id FROM schools ORDER BY created_at LIMIT 1");
  if (!school) {
    await seedSchool(db, auth);
    school = { id: IDS.school };
  }

  const user = await first<{ id: string; school_id: string; display_name: string; email: string }>(
    db,
    "SELECT id, school_id, display_name, email FROM users WHERE school_id = ? AND identity_subject = ? AND status = 'ACTIVE' LIMIT 1",
    school.id,
    auth.userId,
  );
  if (!user) throw new AccessError("Sua conta ainda não foi vinculada a esta escola.");

  await stmt(db, "UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", user.id).run();
  const rolesResult = await stmt(
    db,
    "SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.school_id = ? AND ur.user_id = ? ORDER BY r.name",
    school.id,
    user.id,
  ).all<{ code: RoleCode }>();
  const roles = rolesResult.results.map((row) => row.code).filter(isRoleCode);
  if (!roles.length) throw new AccessError("Nenhum perfil de acesso foi atribuído à sua conta.");

  const requestedRole = request.headers.get("x-harmonia-role") ?? new URL(request.url).searchParams.get("role");
  const activeRole = isRoleCode(requestedRole) && roles.includes(requestedRole) ? requestedRole : roles.includes("DIRECAO") ? "DIRECAO" : roles[0];
  const student = await first<{ id: string }>(db, "SELECT id FROM student_profiles WHERE school_id = ? AND user_id = ? AND active = 1", school.id, user.id);
  const teacher = await first<{ id: string }>(db, "SELECT id FROM teacher_profiles WHERE school_id = ? AND user_id = ? AND active = 1", school.id, user.id);
  const linked = await stmt(db, "SELECT student_id FROM guardian_links WHERE school_id = ? AND guardian_user_id = ?", school.id, user.id).all<{ student_id: string }>();
  const taught = teacher ? await stmt(
    db,
    `SELECT DISTINCT lp.student_id FROM lesson_participants lp
     JOIN lessons l ON l.id = lp.lesson_id
     WHERE l.school_id = ? AND (l.teacher_id = ? OR l.substitute_teacher_id = ?)
     UNION SELECT DISTINCT e.student_id FROM enrollments e
     JOIN class_teachers ct ON ct.class_id = e.class_id
     WHERE e.school_id = ? AND ct.teacher_id = ? AND e.status = 'ACTIVE'`,
    school.id, teacher.id, teacher.id, school.id, teacher.id,
  ).all<{ student_id: string }>() : { results: [] as { student_id: string }[] };

  return {
    userId: user.id,
    identitySubject: auth.userId,
    email: user.email,
    displayName: user.display_name,
    schoolId: user.school_id,
    unitId: IDS.unit,
    roles,
    activeRole,
    studentId: student?.id ?? null,
    teacherId: teacher?.id ?? null,
    linkedStudentIds: linked.results.map((row) => row.student_id),
    teacherStudentIds: taught.results.map((row) => row.student_id),
  };
}

export async function seedSchool(db: D1Database, auth: AuthHeaders, passwordHash?: string): Promise<void> {
  const now = new Date().toISOString();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const schoolSettings = JSON.stringify({
    scheduling: { minimumNoticeHours: 12, cancellationNoticeHours: 24, defaultBufferMinutes: 10, makeupValidityDays: 60 },
    reports: { coordinationReviewRequired: true },
    financeVisibleToFamilies: true,
    retention: { auditMonths: 60, academicMonths: 120, inactiveAccountsMonths: 24 },
  });
  const statements: D1PreparedStatement[] = [];
  const add = (sql: string, ...values: unknown[]) => statements.push(stmt(db, sql, ...values));

  add("INSERT INTO schools (id,name,legal_name,timezone,primary_color,accent_color,settings_json) VALUES (?,?,?,?,?,?,?)", IDS.school, "Harmonia", "Escola Harmonia de Música Ltda.", "America/Sao_Paulo", "#102746", "#E49B32", schoolSettings);
  add("INSERT INTO units (id,school_id,name,address_json,active) VALUES (?,?,?,?,1)", IDS.unit, IDS.school, "Unidade Centro", JSON.stringify({ city: "São Paulo", state: "SP" }));
  add("INSERT INTO users (id,school_id,identity_subject,email,display_name,password_hash,status,mfa_required) VALUES (?,?,?,?,?,?,'ACTIVE',1)", IDS.actorUser, IDS.school, auth.userId, auth.email, auth.displayName, passwordHash ?? null);
  add("INSERT INTO users (id,school_id,identity_subject,email,display_name,status,mfa_required) VALUES (?,?,?,?,?,'ACTIVE',0)", IDS.teacher2User, IDS.school, "demo:teacher:bruno", "bruno.salles@example.invalid", "Bruno Salles");
  add("INSERT INTO users (id,school_id,identity_subject,email,display_name,status,mfa_required) VALUES (?,?,?,?,?,'ACTIVE',0)", IDS.student1User, IDS.school, "demo:student:lia", "lia.martins@example.invalid", "Lia Martins");
  add("INSERT INTO users (id,school_id,identity_subject,email,display_name,status,mfa_required) VALUES (?,?,?,?,?,'ACTIVE',0)", IDS.student2User, IDS.school, "demo:student:caio", "caio.nunes@example.invalid", "Caio Nunes");
  add("INSERT INTO users (id,school_id,identity_subject,email,display_name,status,mfa_required) VALUES (?,?,?,?,?,'ACTIVE',0)", IDS.student3User, IDS.school, "demo:student:nina", "nina.azevedo@example.invalid", "Nina Azevedo");
  add("INSERT INTO users (id,school_id,identity_subject,email,display_name,status,mfa_required) VALUES (?,?,?,?,?,'ACTIVE',0)", IDS.guardianUser, IDS.school, "demo:guardian:elisa", "elisa.azevedo@example.invalid", "Elisa Azevedo");

  for (const [code, name] of Object.entries(ROLE_NAMES)) {
    add("INSERT INTO roles (id,school_id,code,name,system_role) VALUES (?,?,?,?,1)", roleId(code), IDS.school, code, name);
    add("INSERT INTO user_roles (id,school_id,user_id,role_id,unit_id,granted_by) VALUES (?,?,?,?,?,?)", `urr_${code.toLowerCase()}_owner`, IDS.school, IDS.actorUser, roleId(code), IDS.unit, IDS.actorUser);
  }
  add("INSERT INTO user_roles (id,school_id,user_id,role_id,unit_id,granted_by) VALUES (?,?,?,?,?,?)", "urr_demo_teacher", IDS.school, IDS.teacher2User, roleId("PROFESSOR"), IDS.unit, IDS.actorUser);
  add("INSERT INTO user_roles (id,school_id,user_id,role_id,unit_id,granted_by) VALUES (?,?,?,?,?,?)", "urr_demo_student1", IDS.school, IDS.student1User, roleId("ALUNO"), IDS.unit, IDS.actorUser);
  add("INSERT INTO user_roles (id,school_id,user_id,role_id,unit_id,granted_by) VALUES (?,?,?,?,?,?)", "urr_demo_student2", IDS.school, IDS.student2User, roleId("ALUNO"), IDS.unit, IDS.actorUser);
  add("INSERT INTO user_roles (id,school_id,user_id,role_id,unit_id,granted_by) VALUES (?,?,?,?,?,?)", "urr_demo_student3", IDS.school, IDS.student3User, roleId("ALUNO"), IDS.unit, IDS.actorUser);
  add("INSERT INTO user_roles (id,school_id,user_id,role_id,unit_id,granted_by) VALUES (?,?,?,?,?,?)", "urr_demo_guardian", IDS.school, IDS.guardianUser, roleId("RESPONSAVEL"), IDS.unit, IDS.actorUser);

  add("INSERT INTO teacher_profiles (id,school_id,user_id,bio,active) VALUES (?,?,?,?,1)", IDS.actorTeacher, IDS.school, IDS.actorUser, "Piano, percepção e prática de conjunto.");
  add("INSERT INTO teacher_profiles (id,school_id,user_id,bio,active) VALUES (?,?,?,?,1)", IDS.teacher2, IDS.school, IDS.teacher2User, "Violão popular e harmonia funcional.");
  add("INSERT INTO student_profiles (id,school_id,user_id,unit_id,birth_date,active) VALUES (?,?,?,?,?,1)", IDS.actorStudent, IDS.school, IDS.actorUser, IDS.unit, "2001-04-18");
  add("INSERT INTO student_profiles (id,school_id,user_id,unit_id,birth_date,active) VALUES (?,?,?,?,?,1)", IDS.student1, IDS.school, IDS.student1User, IDS.unit, "2013-08-22");
  add("INSERT INTO student_profiles (id,school_id,user_id,unit_id,birth_date,active) VALUES (?,?,?,?,?,1)", IDS.student2, IDS.school, IDS.student2User, IDS.unit, "2009-11-03");
  add("INSERT INTO student_profiles (id,school_id,user_id,unit_id,birth_date,active) VALUES (?,?,?,?,?,1)", IDS.student3, IDS.school, IDS.student3User, IDS.unit, "2015-02-14");
  add("INSERT INTO guardian_links (id,school_id,guardian_user_id,student_id,relationship,financial_access,schedule_authority) VALUES (?,?,?,?,?,1,1)", "gln_b705d2c91a4e4863", IDS.school, IDS.guardianUser, IDS.student3, "Mãe");

  add("INSERT INTO courses (id,school_id,name,description,active) VALUES (?,?,?,?,1)", IDS.coursePiano, IDS.school, "Piano", "Formação individual em piano.");
  add("INSERT INTO courses (id,school_id,name,description,active) VALUES (?,?,?,?,1)", IDS.courseGuitar, IDS.school, "Violão", "Violão popular e repertório brasileiro.");
  add("INSERT INTO instruments (id,school_id,name,family,active) VALUES (?,?,?,?,1)", IDS.instrumentPiano, IDS.school, "Piano", "Teclas");
  add("INSERT INTO instruments (id,school_id,name,family,active) VALUES (?,?,?,?,1)", IDS.instrumentGuitar, IDS.school, "Violão", "Cordas");
  add("INSERT INTO rooms (id,school_id,unit_id,name,capacity,accessible,active) VALUES (?,?,?,?,?,1,1)", IDS.room1, IDS.school, IDS.unit, "Sala Tom Jobim", 4);
  add("INSERT INTO rooms (id,school_id,unit_id,name,capacity,accessible,active) VALUES (?,?,?,?,?,1,1)", IDS.room2, IDS.school, IDS.unit, "Estúdio Elis", 8);
  add("INSERT INTO room_resources (id,school_id,room_id,name,quantity) VALUES (?,?,?,?,?)", "rrs_310e7c49a2b5486d", IDS.school, IDS.room1, "Piano vertical", 1);
  add("INSERT INTO room_resources (id,school_id,room_id,name,quantity) VALUES (?,?,?,?,?)", "rrs_9a72c4e61f304b85", IDS.school, IDS.room2, "Amplificador", 2);
  add("INSERT INTO classes (id,school_id,unit_id,course_id,instrument_id,name,capacity,modality,status) VALUES (?,?,?,?,?,?,?,'IN_PERSON','ACTIVE')", IDS.classPiano, IDS.school, IDS.unit, IDS.coursePiano, IDS.instrumentPiano, "Piano intermediário", 4);
  add("INSERT INTO classes (id,school_id,unit_id,course_id,instrument_id,name,capacity,modality,status) VALUES (?,?,?,?,?,?,?,'HYBRID','ACTIVE')", IDS.classGuitar, IDS.school, IDS.unit, IDS.courseGuitar, IDS.instrumentGuitar, "Conjunto de violões", 8);
  for (const [id, classId, studentId] of [
    ["enr_0c43f7a192de4b58", IDS.classPiano, IDS.actorStudent],
    ["enr_8a2f0d61c5374b49", IDS.classPiano, IDS.student1],
    ["enr_6e17b3c90a254d82", IDS.classGuitar, IDS.student2],
    ["enr_31d8a5f72c904b66", IDS.classGuitar, IDS.student3],
  ]) add("INSERT INTO enrollments (id,school_id,class_id,student_id,starts_on,status) VALUES (?,?,?,?,?,'ACTIVE')", id, IDS.school, classId, studentId, localIso(-90, 0).slice(0, 10));
  add("INSERT INTO class_teachers (id,school_id,class_id,teacher_id,starts_on) VALUES (?,?,?,?,?)", "cth_1e8a5b73d2404c96", IDS.school, IDS.classPiano, IDS.actorTeacher, localIso(-90, 0).slice(0, 10));
  add("INSERT INTO class_teachers (id,school_id,class_id,teacher_id,starts_on) VALUES (?,?,?,?,?)", "cth_9c31f6a70d824b55", IDS.school, IDS.classGuitar, IDS.teacher2, localIso(-90, 0).slice(0, 10));
  for (const teacherId of [IDS.actorTeacher, IDS.teacher2]) for (let weekday = 1; weekday <= 6; weekday += 1) {
    add("INSERT INTO recurring_availability (id,school_id,teacher_id,unit_id,weekday,start_time,end_time,valid_from) VALUES (?,?,?,?,?,?,?,?)", `avl_${teacherId.slice(-5)}_${weekday}`, IDS.school, teacherId, IDS.unit, weekday, "08:00", "21:00", localIso(-180, 0).slice(0, 10));
  }

  const lessonRows = [
    ["les_7f31a9c40d624e85", IDS.actorTeacher, IDS.room1, IDS.instrumentPiano, "Piano · Lia Martins", localIso(0, 9), localIso(0, 10), "CONFIRMED", IDS.student1],
    ["les_2b8e4d10a7654c39", IDS.teacher2, IDS.room2, IDS.instrumentGuitar, "Violão · Caio Nunes", localIso(0, 10, 30), localIso(0, 11, 30), "SCHEDULED", IDS.student2],
    ["les_5c91f2a70e384d66", IDS.actorTeacher, IDS.room1, IDS.instrumentPiano, "Piano · aula individual", localIso(0, 14), localIso(0, 15), "SCHEDULED", IDS.actorStudent],
    ["les_8d20a6c41f934b75", IDS.teacher2, IDS.room2, IDS.instrumentGuitar, "Conjunto de violões", localIso(0, 16), localIso(0, 17, 30), "SCHEDULED", IDS.student3],
    ["les_4e17b9a32c604d88", IDS.actorTeacher, IDS.room1, IDS.instrumentPiano, "Piano · Lia Martins", localIso(1, 9), localIso(1, 10), "SCHEDULED", IDS.student1],
    ["les_1a63d8e50b274c92", IDS.actorTeacher, IDS.room1, IDS.instrumentPiano, "Piano · aula realizada", localIso(-2, 14), localIso(-2, 15), "COMPLETED", IDS.actorStudent],
  ] as const;
  for (const [lessonId, teacherId, roomId, instrumentId, title, startsAt, endsAt, status, studentId] of lessonRows) {
    add("INSERT INTO lessons (id,school_id,unit_id,teacher_id,room_id,instrument_id,title,starts_at,ends_at,buffer_minutes,modality,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,10,'IN_PERSON',?,?)", lessonId, IDS.school, IDS.unit, teacherId, roomId, instrumentId, title, startsAt, endsAt, status, IDS.actorUser);
    add("INSERT INTO lesson_participants (id,school_id,lesson_id,student_id,status) VALUES (?,?,?,?, 'CONFIRMED')", `lpt_${lessonId.slice(-12)}`, IDS.school, lessonId, studentId);
  }
  add("INSERT INTO attendances (id,school_id,lesson_id,student_id,status,actual_start_at,actual_end_at,content,repertoire,exercises,next_goal,recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", "att_4d80b2f19a634e77", IDS.school, "les_1a63d8e50b274c92", IDS.actorStudent, "PRESENT", localIso(-2,14,2), localIso(-2,15), "Escalas maiores e independência das mãos", "Gymnopédie nº 1", "Hanon nº 5", "Estabilizar o andamento em 72 bpm", IDS.actorUser);

  add("INSERT INTO tasks (id,school_id,teacher_id,course_id,instrument_id,title,instructions,published_at,due_at,priority,evaluation_mode,max_attempts,status) VALUES (?,?,?,?,?,?,?,?,?,'HIGH','RUBRIC',3,'PUBLISHED')", "tsk_6a31f9c20d854e77", IDS.school, IDS.actorTeacher, IDS.coursePiano, IDS.instrumentPiano, "Gravar estudo de dinâmica", "Envie um vídeo curto tocando o trecho A com contraste claro entre piano e forte.", now, localIso(2, 20));
  add("INSERT INTO task_recipients (id,school_id,task_id,student_id,status) VALUES (?,?,?,?,'DELIVERED')", "trc_3f80a1d29c654e76", IDS.school, "tsk_6a31f9c20d854e77", IDS.actorStudent);
  add("INSERT INTO submissions (id,school_id,task_id,student_id,status,current_version,submitted_at) VALUES (?,?,?,?, 'DELIVERED',1,?)", "sub_8d27c1a49e604b35", IDS.school, "tsk_6a31f9c20d854e77", IDS.actorStudent, localIso(-1,19));
  add("INSERT INTO submission_versions (id,school_id,submission_id,version_number,text_content,link_url,file_ids_json,submitted_at) VALUES (?,?,?,?,?,?,?,?)", "svr_2a90d7e31c654f88", IDS.school, "sub_8d27c1a49e604b35", 1, "Trabalhei o contraste em blocos de quatro compassos.", "https://example.invalid/entrega-demonstracao", "[]", localIso(-1,19));
  add("INSERT INTO tasks (id,school_id,teacher_id,course_id,instrument_id,title,instructions,published_at,due_at,priority,evaluation_mode,max_attempts,status) VALUES (?,?,?,?,?,?,?,?,?,'MEDIUM','CONCEPT',2,'PUBLISHED')", "tsk_1c84e6a20b594d73", IDS.school, IDS.teacher2, IDS.courseGuitar, IDS.instrumentGuitar, "Trocas de acordes sem pausa", "Pratique a sequência G–D–Em–C com metrônomo.", now, localIso(4,20));
  add("INSERT INTO task_recipients (id,school_id,task_id,student_id,status) VALUES (?,?,?,?,'PUBLISHED')", "trc_7b32f0d19a864e55", IDS.school, "tsk_1c84e6a20b594d73", IDS.student2);

  const reportData = JSON.stringify({ plannedLessons: 4, completedLessons: 3, attendanceRate: 100, completedTasks: 2, lateTasks: 0, pendingTasks: 1, practiceFrequency: "3 vezes por semana", contents: "Escalas, leitura e dinâmica", repertoire: "Gymnopédie nº 1", skills: "Independência das mãos", strengths: "Regularidade e leitura", difficulties: "Controle de dinâmica", evolution: "Maior estabilidade rítmica", nextGoals: "Consolidar trecho B a 72 bpm", recommendations: "Sessões curtas e frequentes" });
  add("INSERT INTO monthly_reports (id,school_id,student_id,teacher_id,reference_month,status,current_version,published_at,published_by) VALUES (?,?,?,?,?,'PUBLISHED',1,?,?)", "rpt_7a2e1c90d4654b38", IDS.school, IDS.actorStudent, IDS.actorTeacher, month, now, IDS.actorUser);
  add("INSERT INTO report_versions (id,school_id,report_id,version_number,author_user_id,data_json,coordination_comment) VALUES (?,?,?,?,?,?,?)", "rpv_4d91a6e30b754c82", IDS.school, "rpt_7a2e1c90d4654b38", 1, IDS.actorUser, reportData, "Relatório revisado e aprovado para publicação.");
  add("INSERT INTO monthly_reports (id,school_id,student_id,teacher_id,reference_month,status,current_version) VALUES (?,?,?,?,?,'AWAITING_REVIEW',1)", "rpt_2c70e5a91d384b66", IDS.school, IDS.student1, IDS.actorTeacher, month);
  add("INSERT INTO report_versions (id,school_id,report_id,version_number,author_user_id,data_json) VALUES (?,?,?,?,?,?)", "rpv_8a31f6d20c954e44", IDS.school, "rpt_2c70e5a91d384b66", 1, IDS.actorUser, reportData);

  add("INSERT INTO events (id,school_id,unit_id,type,title,description,starts_at,ends_at,location,capacity,audience_json,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,'PUBLISHED')", "evt_3e91a7c20d654b88", IDS.school, IDS.unit, "RECITAL", "Recital de primavera", "Apresentação dos alunos no auditório da unidade.", localIso(12,18), localIso(12,20), "Auditório Harmonia", 120, JSON.stringify({ type: "ALL" }));
  add("INSERT INTO events (id,school_id,unit_id,type,title,description,starts_at,ends_at,location,capacity,audience_json,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,'PUBLISHED')", "evt_7b20d4a91c654e38", IDS.school, IDS.unit, "WORKSHOP", "Workshop de improvisação", "Prática guiada com vagas limitadas.", localIso(6,14), localIso(6,17), "Estúdio Elis", 18, JSON.stringify({ type: "COURSE", id: IDS.courseGuitar }));
  add("INSERT INTO announcements (id,school_id,author_user_id,title,body,priority,published_at,requires_acknowledgement) VALUES (?,?,?,?,?,'IMPORTANT',?,1)", "ann_9a34e7c20d614b85", IDS.school, IDS.actorUser, "Confirmação do recital", "Confirme a participação até sexta-feira para organizarmos a ordem das apresentações.", now);
  add("INSERT INTO announcement_audiences (id,school_id,announcement_id,audience_type) VALUES (?,?,?,'ALL')", "aua_2c81d5e70b964f33", IDS.school, "ann_9a34e7c20d614b85");
  add("INSERT INTO announcements (id,school_id,author_user_id,title,body,priority,published_at,requires_acknowledgement) VALUES (?,?,?,?,?,'NORMAL',?,0)", "ann_1d70a4c82e954b66", IDS.school, IDS.actorUser, "Manutenção da Sala Tom Jobim", "O piano será afinado na próxima terça-feira, das 8h às 10h.", now);
  add("INSERT INTO announcement_audiences (id,school_id,announcement_id,audience_type,audience_id) VALUES (?,?,?,'UNIT',?)", "aua_6f28b1d90c734e55", IDS.school, "ann_1d70a4c82e954b66", IDS.unit);
  add("INSERT INTO notifications (id,school_id,user_id,type,title,body,entity_type,entity_id) VALUES (?,?,?,?,?,?,?,?)", "ntf_5e81c2a70d394b66", IDS.school, IDS.actorUser, "TASK_FEEDBACK", "Novo feedback disponível", "Seu professor comentou a última entrega.", "SUBMISSION", "sub_8d27c1a49e604b35");

  add("INSERT INTO financial_plans (id,school_id,name,amount_cents,billing_cycle,lesson_credits,active) VALUES (?,?,?,?,'MONTHLY',4,1)", IDS.plan, IDS.school, "Plano Individual · 4 aulas", 48000);
  add("INSERT INTO charges (id,school_id,student_id,plan_id,reference_month,due_date,original_amount_cents,discount_cents,final_amount_cents,status) VALUES (?,?,?,?,?,?,?,?,?,'OPEN')", "chg_4a72d9e10c654b38", IDS.school, IDS.actorStudent, IDS.plan, month, localIso(3,0).slice(0,10), 48000, 3000, 45000);
  add("INSERT INTO charges (id,school_id,student_id,plan_id,reference_month,due_date,original_amount_cents,discount_cents,final_amount_cents,status) VALUES (?,?,?,?,?,?,?,?,?,'OVERDUE')", "chg_8d31a5e70c294b66", IDS.school, IDS.student3, IDS.plan, month, localIso(-5,0).slice(0,10), 48000, 0, 48000);
  add("INSERT INTO practice_entries (id,school_id,student_id,practiced_on,minutes,repertoire,difficulty,observations,share_with_teacher) VALUES (?,?,?,?,?,?,?,?,1)", "prc_1e84b7a20d954c36", IDS.school, IDS.actorStudent, localIso(-1,0).slice(0,10), 35, "Gymnopédie nº 1", "Dinâmica no trecho B", "Estudo confortável, sem dor.");
  add("INSERT INTO repertoire_catalog (id,school_id,title,composer,kind,level) VALUES (?,?,?,?,?,?)", IDS.repertoire1, IDS.school, "Gymnopédie nº 1", "Erik Satie", "MUSIC", "Intermediário");
  add("INSERT INTO repertoire_catalog (id,school_id,title,composer,kind,level) VALUES (?,?,?,?,?,?)", IDS.repertoire2, IDS.school, "O Leãozinho", "Caetano Veloso", "MUSIC", "Iniciante");
  add("INSERT INTO student_repertoire (id,school_id,student_id,repertoire_id,tempo_bpm,key_signature,level,status,started_on) VALUES (?,?,?,?,?,?,?,'CURRENT',?)", "srp_8a20d4e91c654b37", IDS.school, IDS.actorStudent, IDS.repertoire1, 68, "Ré maior", "Intermediário", localIso(-60,0).slice(0,10));
  add("INSERT INTO student_goals (id,school_id,student_id,title,target_date,status,progress_percent) VALUES (?,?,?,?,?,'ACTIVE',?)", "gol_3c91e7a20d654b48", IDS.school, IDS.actorStudent, "Tocar a peça completa a 72 bpm", localIso(28,0).slice(0,10), 68);
  add("INSERT INTO audit_logs (id,school_id,actor_user_id,actor_role,action,entity_type,entity_id,outcome,metadata_json,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?)", "aud_7e21c9a40d654b38", IDS.school, IDS.actorUser, "SECRETARIA", "LESSON_CREATED", "LESSON", "les_7f31a9c40d624e85", "SUCCESS", JSON.stringify({ source: "demo", fields: ["starts_at", "teacher_id", "room_id"] }), now);

  try {
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("UNIQUE constraint failed")) throw error;
  }
}

export async function audit(params: {
  db: D1Database; actor: Actor; request: Request; action: string; entityType: string;
  entityId?: string | null; outcome?: "SUCCESS" | "DENIED" | "FAILED"; metadata?: Record<string, unknown>;
}): Promise<void> {
  const ip = params.request.headers.get("cf-connecting-ip") ?? "unknown";
  const ua = params.request.headers.get("user-agent") ?? "unknown";
  await stmt(params.db,
    "INSERT INTO audit_logs (id,school_id,actor_user_id,actor_role,action,entity_type,entity_id,outcome,ip_hash,user_agent_hash,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    crypto.randomUUID(), params.actor.schoolId, params.actor.userId, params.actor.activeRole,
    params.action, params.entityType, params.entityId ?? null, params.outcome ?? "SUCCESS",
    await hashIdentifier(ip), await hashIdentifier(ua), JSON.stringify(params.metadata ?? {}),
  ).run();
}

export function checkSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (origin && origin !== new URL(request.url).origin) throw new AccessError("Origem da solicitação não permitida.");
  if (!origin && site && site !== "same-origin") throw new AccessError("Solicitação entre sites bloqueada.");
}

export async function enforceRateLimit(db: D1Database, actor: Actor, request: Request, operation: string, limit = 40): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const subjects = [
    `user:${await hashIdentifier(actor.identitySubject)}`,
    `ip:${await hashIdentifier(ip)}`,
  ];
  await db.batch(subjects.map((subject) => stmt(db,
    `INSERT INTO rate_limits (id,school_id,subject_key,operation,window_start,request_count)
     VALUES (?,?,?,?,?,1)
     ON CONFLICT(school_id,subject_key,operation,window_start)
     DO UPDATE SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP`,
    crypto.randomUUID(), actor.schoolId, subject, operation, windowStart,
  )));
  const rows = await stmt(db,
    "SELECT request_count FROM rate_limits WHERE school_id=? AND subject_key IN (?,?) AND operation=? AND window_start=?",
    actor.schoolId, subjects[0], subjects[1], operation, windowStart,
  ).all<{ request_count: number }>();
  if (rows.results.some((row) => row.request_count > limit)) {
    const error = new Error("Muitas solicitações. Aguarde um minuto e tente novamente.") as Error & { status: number };
    error.status = 429;
    throw error;
  }
}

export { AuthenticationError };
