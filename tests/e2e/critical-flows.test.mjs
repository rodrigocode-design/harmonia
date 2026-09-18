import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.E2E_BASE_URL;
const headers = {
  "oai-authenticated-user-id": "e2e-owner",
  "oai-authenticated-user-email": "owner@example.invalid",
  "oai-authenticated-user-full-name": "Gestor%20E2E",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};
const professorHeaders = {
  "oai-authenticated-user-id": "demo:teacher:bruno",
  "oai-authenticated-user-email": "bruno.salles@example.invalid",
  "x-harmonia-role": "PROFESSOR",
};
const studentHeaders = {
  "oai-authenticated-user-id": "demo:student:lia",
  "oai-authenticated-user-email": "lia.martins@example.invalid",
  "x-harmonia-role": "ALUNO",
};
const guardianHeaders = {
  "oai-authenticated-user-id": "demo:guardian:elisa",
  "oai-authenticated-user-email": "elisa.azevedo@example.invalid",
  "x-harmonia-role": "RESPONSAVEL",
};

function schoolSlot(minimumDays, lessons = [], teacherId = "", hour = 18) {
  for (let offset = minimumDays; offset < minimumDays + 8; offset += 1) {
    const candidate = new Date(Date.now() + offset * 86_400_000);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(candidate);
    const weekday = new Date(`${day}T12:00:00-03:00`).getUTCDay();
    if (weekday >= 1 && weekday <= 6) {
      const startsAt = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00-03:00`).toISOString();
      const endsAt = new Date(Date.parse(startsAt) + 60 * 60_000).toISOString();
      const conflict = lessons.some((lesson) => lesson.teacherId === teacherId && !["CANCELLED_SCHOOL", "CANCELLED_STUDENT", "RESCHEDULED"].includes(lesson.status) && Date.parse(lesson.startsAt) < Date.parse(endsAt) && Date.parse(lesson.endsAt) > Date.parse(startsAt));
      if (!conflict) return { startsAt, endsAt };
    }
  }
  throw new Error("Não foi possível criar horário útil para o teste.");
}

async function postAction(role, action, payload) {
  return fetch(`${baseUrl}/api/app`, {
    method: "POST",
    headers: { ...headers, "x-harmonia-role": role, "Content-Type": "application/json", Origin: baseUrl, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ action, payload }),
  });
}

test("jornada crítica: sessão, agenda e escopo", { skip: !baseUrl }, async () => {
  const session = await fetch(`${baseUrl}/api/app?role=SECRETARIA`, { headers: { ...headers, "x-harmonia-role": "SECRETARIA" } });
  assert.equal(session.status, 200);
  const data = await session.json();
  assert.equal(data.session.activeRole, "SECRETARIA");
  assert.ok(Array.isArray(data.lessons));
  assert.ok(data.lessons.every((lesson) => typeof lesson.id === "string"));
});

test("interface, manifesto PWA e cabeçalhos de segurança são servidos", { skip: !baseUrl }, async () => {
  const page = await fetch(baseUrl, { headers });
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match(await page.text(), /Harmonia/);
  const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  const manifestBody = await manifest.json();
  assert.equal(manifestBody.display, "standalone");
  assert.equal(manifestBody.lang, "pt-BR");
  const serviceWorker = await fetch(`${baseUrl}/sw.js`);
  assert.equal(serviceWorker.status, 200);
  const serviceWorkerBody = await serviceWorker.text();
  assert.match(serviceWorkerBody, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("API rejeita ação sem idempotência", { skip: !baseUrl }, async () => {
  const response = await fetch(`${baseUrl}/api/app`, { method: "POST", headers: { ...headers, "x-harmonia-role": "SECRETARIA", "Content-Type": "application/json", Origin: baseUrl }, body: JSON.stringify({ action: "create_lesson", payload: {} }) });
  assert.equal(response.status, 400);
});

test("financeiro não recebe relatórios pedagógicos", { skip: !baseUrl }, async () => {
  const response = await fetch(`${baseUrl}/api/app?role=FINANCEIRO`, { headers: { ...headers, "x-harmonia-role": "FINANCEIRO" } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.reports, []);
});

test("responsável acompanha sem agir como aluno", { skip: !baseUrl }, async () => {
  const portal = await fetch(`${baseUrl}/api/app?role=RESPONSAVEL`, { headers: guardianHeaders });
  assert.equal(portal.status, 200);
  const data = await portal.json();
  assert.deepEqual(data.practice, []);
  assert.deepEqual(data.goals, []);
  const linkedStudents = new Set(data.students.map((student) => student.id));
  assert.ok(data.lessons.every((lesson) => lesson.studentIds.every((id) => linkedStudents.has(id))));
  assert.ok(data.tasks.every((task) => task.recipientIds.split(",").filter(Boolean).every((id) => linkedStudents.has(id))));

  const submit = await fetch(`${baseUrl}/api/app`, {
    method: "POST",
    headers: { ...guardianHeaders, "Content-Type": "application/json", Origin: baseUrl, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ action: "submit_task", payload: {} }),
  });
  assert.equal(submit.status, 403);
});

test("reserva concorrente e crédito de reposição são atômicos", { skip: !baseUrl }, async () => {
  const portalResponse = await fetch(`${baseUrl}/api/app?role=SECRETARIA`, { headers: { ...headers, "x-harmonia-role": "SECRETARIA" } });
  assert.equal(portalResponse.status, 200);
  const portal = await portalResponse.json();
  const firstSlot = schoolSlot(20, portal.lessons, portal.teachers[0].id, 18);
  const payload = {
    title: "E2E · concorrência",
    teacherId: portal.teachers[0].id,
    studentIds: [portal.students[0].id],
    roomId: portal.rooms[0].id,
    instrumentId: null,
    ...firstSlot,
    bufferMinutes: 10,
    modality: "IN_PERSON",
    meetingUrl: null,
    recurring: false,
    occurrences: 1,
    useMakeupCredit: false,
  };
  const competing = await Promise.all([
    postAction("SECRETARIA", "create_lesson", payload),
    postAction("SECRETARIA", "create_lesson", payload),
  ]);
  assert.deepEqual(competing.map((response) => response.status).sort(), [200, 409]);
  const winner = competing.find((response) => response.status === 200);
  const created = await winner.json();
  const lessonId = created.ids[0];

  const cancelled = await postAction("SECRETARIA", "cancel_lesson", { lessonId, reason: "Reposição gerada pelo teste E2E", cancelledBy: "SCHOOL", generateCredit: true });
  assert.equal(cancelled.status, 200);

  const refreshedPortal = await (await fetch(`${baseUrl}/api/app?role=SECRETARIA`, { headers: { ...headers, "x-harmonia-role": "SECRETARIA" } })).json();
  const secondSlot = schoolSlot(28, refreshedPortal.lessons, portal.teachers[0].id, 18);
  const replacement = await postAction("SECRETARIA", "create_lesson", { ...payload, title: "E2E · reposição", ...secondSlot, useMakeupCredit: true });
  assert.equal(replacement.status, 200, await replacement.clone().text());
  const replacementBody = await replacement.json();
  const cleanup = await postAction("SECRETARIA", "cancel_lesson", { lessonId: replacementBody.ids[0], reason: "Limpeza do teste E2E", cancelledBy: "SCHOOL", generateCredit: false });
  assert.equal(cleanup.status, 200);
});

test("pagamentos concorrentes não ultrapassam o saldo", { skip: !baseUrl }, async () => {
  const portal = await (await fetch(`${baseUrl}/api/app?role=FINANCEIRO`, { headers: { ...headers, "x-harmonia-role": "FINANCEIRO" } })).json();
  const charge = portal.charges.find((item) => item.finalAmountCents > item.paidCents);
  assert.ok(charge);
  const payload = { chargeId: charge.id, amountCents: charge.finalAmountCents - charge.paidCents, method: "PIX" };
  const competing = await Promise.all([
    postAction("FINANCEIRO", "record_payment", payload),
    postAction("FINANCEIRO", "record_payment", payload),
  ]);
  assert.equal(competing.filter((response) => response.status === 200).length, 1);
  assert.equal(competing.filter((response) => response.status !== 200).length, 1);
});

test("eventos e avisos respeitam segmentação por perfil", { skip: !baseUrl }, async () => {
  const noticeResponse = await postAction("SECRETARIA", "create_announcement", {
    title: "E2E · aviso de professores",
    body: "Conteúdo visível somente ao público autorizado.",
    priority: "NORMAL",
    audienceType: "ROLE",
    audienceId: "PROFESSOR",
    requiresAcknowledgement: true,
  });
  assert.equal(noticeResponse.status, 200, await noticeResponse.clone().text());
  const noticeId = (await noticeResponse.json()).id;

  const eventStart = schoolSlot(35).startsAt;
  const eventResponse = await postAction("SECRETARIA", "create_event", {
    type: "MEETING",
    title: "E2E · encontro de professores",
    description: "Evento segmentado usado pelo teste ponta a ponta.",
    startsAt: eventStart,
    endsAt: new Date(Date.parse(eventStart) + 60 * 60_000).toISOString(),
    location: "Sala virtual",
    capacity: 20,
    audienceType: "ROLE",
    audienceId: "PROFESSOR",
  });
  assert.equal(eventResponse.status, 200, await eventResponse.clone().text());
  const eventId = (await eventResponse.json()).id;

  const professorPortal = await (await fetch(`${baseUrl}/api/app?role=PROFESSOR`, { headers: professorHeaders })).json();
  const studentPortal = await (await fetch(`${baseUrl}/api/app?role=ALUNO`, { headers: studentHeaders })).json();
  assert.equal(professorPortal.announcements.some((item) => item.id === noticeId), true);
  assert.equal(studentPortal.announcements.some((item) => item.id === noticeId), false);
  assert.equal(professorPortal.events.some((item) => item.id === eventId), true);
  assert.equal(studentPortal.events.some((item) => item.id === eventId), false);
});
