"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CalendarPlus, CheckCircle2, ClipboardCheck, CreditCard, Megaphone, Plus, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Lesson, Mutation, PortalData, Task } from "@/app/portal-types";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function FormSelect({ name, label, value, children }: { name: string; label: string; value?: string; children: ReactNode }) {
  return <Select name={name} defaultValue={value}><SelectTrigger id={name} className="h-11 w-full bg-white"><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{children}</SelectContent></Select>;
}

function useActionDialog(mutate: Mutation) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const submit = async (action: string, payload: unknown) => {
    setPending(true);
    try { const ok = await mutate(action, payload); if (ok) setOpen(false); return ok; }
    finally { setPending(false); }
  };
  return { open, setOpen, pending, submit };
}

function localInput(days: number, hour: number, minute = 0) {
  const date = new Date(Date.now() + days * 86_400_000);
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${parts.slice(0,10)}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
}

function schoolIso(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  return new Date(`${raw}:00-03:00`).toISOString();
}

function audiencePayload(value: FormDataEntryValue | null) {
  const [audienceType, audienceId] = String(value ?? "ALL").split(":", 2);
  return { audienceType, audienceId: audienceId || null };
}

function AudienceSelect({ data }: { data: PortalData }) {
  return <FormSelect name="audience" label="Público" value="ALL">
    <SelectItem value="ALL">Toda a escola</SelectItem>
    <SelectItem value="ROLE:ALUNO">Perfil · Alunos</SelectItem>
    <SelectItem value="ROLE:RESPONSAVEL">Perfil · Responsáveis</SelectItem>
    <SelectItem value="ROLE:PROFESSOR">Perfil · Professores</SelectItem>
    <SelectItem value="ROLE:SECRETARIA">Perfil · Secretaria</SelectItem>
    <SelectItem value={`UNIT:${data.session.unit.id}`}>Unidade · {data.session.unit.name}</SelectItem>
    {data.courses.map((course) => <SelectItem key={course.id} value={`COURSE:${course.id}`}>Curso · {course.name}</SelectItem>)}
    {data.classes.map((item) => <SelectItem key={item.id} value={`CLASS:${item.id}`}>Turma · {item.name}</SelectItem>)}
  </FormSelect>;
}

export function NewLessonDialog({ data, mutate, compact = false }: { data: PortalData; mutate: Mutation; compact?: boolean }) {
  const dialog = useActionDialog(mutate);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const start = schoolIso(fd.get("startsAt"));
    const duration = Number(fd.get("duration"));
    await dialog.submit("create_lesson", {
      title: String(fd.get("title")), teacherId: String(fd.get("teacherId")), studentIds: [String(fd.get("studentId"))],
      roomId: String(fd.get("roomId") || "") || null, instrumentId: String(fd.get("instrumentId") || "") || null,
      startsAt: start, endsAt: new Date(Date.parse(start) + duration * 60_000).toISOString(), bufferMinutes: 10,
      modality: String(fd.get("modality")), meetingUrl: String(fd.get("meetingUrl") || "") || null,
      recurring: fd.get("recurring") === "on", occurrences: Number(fd.get("occurrences") || 1), useMakeupCredit: false,
    });
  }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
    <DialogTrigger asChild><Button className="h-11 bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]"><CalendarPlus />{compact ? "Agendar" : "Agendar aula"}</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Agendar aula</DialogTitle><DialogDescription>O servidor verifica professor, aluno, sala, intervalo, bloqueios e capacidade antes de confirmar.</DialogDescription></DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Título da aula" htmlFor="lesson-title"><Input id="lesson-title" name="title" required maxLength={120} defaultValue="Aula individual" className="h-11" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Professor" htmlFor="teacherId"><FormSelect name="teacherId" label="Selecione" value={data.teachers[0]?.id}>{data.teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</FormSelect></Field>
          <Field label="Aluno" htmlFor="studentId"><FormSelect name="studentId" label="Selecione" value={data.students[0]?.id}>{data.students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</FormSelect></Field>
          <Field label="Data e horário" htmlFor="startsAt"><Input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={localInput(2, 15)} className="h-11" /></Field>
          <Field label="Duração" htmlFor="duration"><FormSelect name="duration" label="Duração" value="60"><SelectItem value="30">30 minutos</SelectItem><SelectItem value="45">45 minutos</SelectItem><SelectItem value="60">60 minutos</SelectItem><SelectItem value="90">90 minutos</SelectItem></FormSelect></Field>
          <Field label="Modalidade" htmlFor="modality"><FormSelect name="modality" label="Modalidade" value="IN_PERSON"><SelectItem value="IN_PERSON">Presencial</SelectItem><SelectItem value="ONLINE">Online</SelectItem><SelectItem value="HYBRID">Híbrida</SelectItem></FormSelect></Field>
          <Field label="Sala" htmlFor="roomId"><FormSelect name="roomId" label="Selecione" value={data.rooms[0]?.id}>{data.rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · {r.capacity} lugares</SelectItem>)}</FormSelect></Field>
          <Field label="Instrumento" htmlFor="instrumentId"><FormSelect name="instrumentId" label="Selecione" value={data.instruments[0]?.id}>{data.instruments.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</FormSelect></Field>
          <Field label="Link da aula online" htmlFor="meetingUrl"><Input id="meetingUrl" name="meetingUrl" type="url" placeholder="https://…" className="h-11" /></Field>
        </div>
        <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 sm:grid-cols-[1fr_160px]">
          <div><div className="flex items-center gap-2"><Switch id="recurring" name="recurring" /><Label htmlFor="recurring">Repetir semanalmente</Label></div><p className="mt-1 text-xs text-muted-foreground">Cada ocorrência passa pela mesma verificação transacional.</p></div>
          <Field label="Ocorrências" htmlFor="occurrences"><Input id="occurrences" name="occurrences" type="number" min={1} max={12} defaultValue={4} className="h-10" /></Field>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit" className="bg-[var(--ink)] text-white">{dialog.pending ? "Verificando…" : "Verificar e confirmar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function AttendanceDialog({ lesson, mutate }: { lesson: Lesson; mutate: Mutation }) {
  const dialog = useActionDialog(mutate);
  const studentId = lesson.studentIds[0];
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    await dialog.submit("record_attendance", { lessonId: lesson.id, studentId, status: String(fd.get("status")), actualStartAt: new Date().toISOString(), actualEndAt: new Date(Date.now()+55*60_000).toISOString(), content: String(fd.get("content") || ""), repertoire: String(fd.get("repertoire") || ""), exercises: String(fd.get("exercises") || ""), privateNotes: String(fd.get("privateNotes") || ""), nextGoal: String(fd.get("nextGoal") || ""), replacementNeeded: fd.get("replacementNeeded") === "on" });
  }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><ClipboardCheck />Registrar aula</Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Registro de aula</DialogTitle><DialogDescription>{lesson.title} · {lesson.studentNames.join(", ")}. Observações privadas permanecem individuais.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4">
    <Field label="Presença" htmlFor="status"><FormSelect name="status" label="Status" value="PRESENT"><SelectItem value="PRESENT">Presente</SelectItem><SelectItem value="LATE">Atraso</SelectItem><SelectItem value="EXCUSED_ABSENCE">Falta justificada</SelectItem><SelectItem value="UNEXCUSED_ABSENCE">Falta sem justificativa</SelectItem></FormSelect></Field>
    <Field label="Conteúdo trabalhado" htmlFor="content"><Textarea id="content" name="content" required maxLength={4000} placeholder="Técnica, leitura, percepção…" /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Repertório" htmlFor="repertoire"><Input id="repertoire" name="repertoire" /></Field><Field label="Exercícios" htmlFor="exercises"><Input id="exercises" name="exercises" /></Field></div>
    <Field label="Meta para a próxima aula" htmlFor="nextGoal"><Input id="nextGoal" name="nextGoal" /></Field>
    <Field label="Observação pedagógica privada" htmlFor="privateNotes" hint="Nunca é copiada para outro aluno."><Textarea id="privateNotes" name="privateNotes" maxLength={4000} /></Field>
    <div className="flex items-center gap-2"><Switch id="replacementNeeded" name="replacementNeeded" /><Label htmlFor="replacementNeeded">Gerar reposição quando aplicável</Label></div>
    <DialogFooter><Button type="button" variant="outline" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Salvar registro</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

export function NewTaskDialog({ data, mutate }: { data: PortalData; mutate: Mutation }) {
  const dialog = useActionDialog(mutate);
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("create_task", { title: String(fd.get("title")), instructions: String(fd.get("instructions")), studentIds: [String(fd.get("studentId"))], dueAt: schoolIso(fd.get("dueAt")), priority: String(fd.get("priority")), evaluationMode: String(fd.get("evaluationMode")), maxAttempts: Number(fd.get("maxAttempts")), publish: fd.get("publish") === "on" }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button className="h-11"><Plus />Nova tarefa</Button></DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Nova tarefa</DialogTitle><DialogDescription>Publique instruções, prazo, critério e limite de tentativas.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4">
    <Field label="Título" htmlFor="task-title"><Input id="task-title" name="title" required maxLength={140} /></Field><Field label="Instruções" htmlFor="instructions"><Textarea id="instructions" name="instructions" required maxLength={8000} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Aluno" htmlFor="task-student"><FormSelect name="studentId" label="Aluno" value={data.students[0]?.id}>{data.students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</FormSelect></Field><Field label="Prazo" htmlFor="dueAt"><Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={localInput(7,20)} required /></Field><Field label="Prioridade" htmlFor="priority"><FormSelect name="priority" label="Prioridade" value="MEDIUM"><SelectItem value="LOW">Baixa</SelectItem><SelectItem value="MEDIUM">Média</SelectItem><SelectItem value="HIGH">Alta</SelectItem></FormSelect></Field><Field label="Avaliação" htmlFor="evaluationMode"><FormSelect name="evaluationMode" label="Avaliação" value="CONCEPT"><SelectItem value="GRADE">Nota</SelectItem><SelectItem value="CONCEPT">Conceito</SelectItem><SelectItem value="RUBRIC">Rubrica</SelectItem></FormSelect></Field><Field label="Máximo de tentativas" htmlFor="maxAttempts"><Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={10} defaultValue={2} /></Field></div>
    <div className="flex items-center gap-2"><Switch id="publish" name="publish" defaultChecked /><Label htmlFor="publish">Publicar agora</Label></div><DialogFooter><Button variant="outline" type="button" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Salvar tarefa</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

export function SubmissionDialog({ task, data, mutate }: { task: Task; data: PortalData; mutate: Mutation }) {
  const dialog = useActionDialog(mutate);
  const recipientIds = task.recipientIds.split(",").filter(Boolean);
  const studentId = data.session.studentId ?? data.students.find((student) => recipientIds.includes(student.id))?.id;
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("submit_task", { taskId: task.id, studentId, textContent: String(fd.get("textContent") || ""), linkUrl: String(fd.get("linkUrl") || ""), fileIds: [] }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button size="sm"><Send />{task.submissionStatus === "REVISION_REQUESTED" ? "Enviar nova versão" : "Entregar"}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Entregar tarefa</DialogTitle><DialogDescription>{task.title}. O professor verá apenas a entrega deste aluno.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4"><Field label="Comentário ou resposta" htmlFor="textContent"><Textarea id="textContent" name="textContent" placeholder="Conte como foi o estudo…" /></Field><Field label="Link privado ou compartilhável" htmlFor="linkUrl"><Input id="linkUrl" name="linkUrl" type="url" placeholder="https://…" /></Field><div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">PDF, imagem, áudio e vídeo podem ser enviados pelo armazenamento privado; arquivos permanecem em quarentena até verificação.</div><DialogFooter><Button variant="outline" type="button" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Enviar versão</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function FeedbackDialog({ task, mutate }: { task: Task; mutate: Mutation }) {
  const dialog = useActionDialog(mutate);
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("review_submission", { submissionId: task.submissionId, message: String(fd.get("message")), strengths: String(fd.get("strengths") || "").split(";").filter(Boolean), improvements: String(fd.get("improvements") || "").split(";").filter(Boolean), gradeValue: String(fd.get("gradeValue") || ""), requestsRevision: fd.get("requestsRevision") === "on" }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button size="sm"><CheckCircle2 />Corrigir</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Feedback privado</DialogTitle><DialogDescription>{task.title} · versão {task.currentVersion ?? 1}</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4"><Field label="Orientação" htmlFor="message"><Textarea id="message" name="message" required /></Field><Field label="Pontos positivos" htmlFor="strengths" hint="Separe itens com ponto e vírgula."><Input id="strengths" name="strengths" /></Field><Field label="Pontos a melhorar" htmlFor="improvements"><Input id="improvements" name="improvements" /></Field><Field label="Nota ou conceito" htmlFor="gradeValue"><Input id="gradeValue" name="gradeValue" /></Field><div className="flex items-center gap-2"><Switch id="requestsRevision" name="requestsRevision" /><Label htmlFor="requestsRevision">Solicitar nova versão</Label></div><DialogFooter><Button variant="outline" type="button" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Enviar feedback</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function NewEventDialog({ data, mutate }: { data: PortalData; mutate: Mutation }) {
  const dialog = useActionDialog(mutate);
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("create_event", { type: String(fd.get("type")), title: String(fd.get("title")), description: String(fd.get("description")), startsAt: schoolIso(fd.get("startsAt")), endsAt: schoolIso(fd.get("endsAt")), location: String(fd.get("location")), capacity: Number(fd.get("capacity")), ...audiencePayload(fd.get("audience")) }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button><CalendarPlus />Novo evento</Button></DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Novo evento</DialogTitle><DialogDescription>Capacidade, público e inscrições serão controlados no servidor.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4"><Field label="Título" htmlFor="event-title"><Input id="event-title" name="title" required /></Field><Field label="Descrição" htmlFor="event-description"><Textarea id="event-description" name="description" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo" htmlFor="type"><FormSelect name="type" label="Tipo" value="RECITAL"><SelectItem value="RECITAL">Recital</SelectItem><SelectItem value="AUDITION">Audição</SelectItem><SelectItem value="EXAM">Prova</SelectItem><SelectItem value="REHEARSAL">Ensaio</SelectItem><SelectItem value="WORKSHOP">Workshop</SelectItem><SelectItem value="MASTERCLASS">Masterclass</SelectItem><SelectItem value="MEETING">Reunião</SelectItem><SelectItem value="HOLIDAY">Feriado</SelectItem></FormSelect></Field><Field label="Público" htmlFor="audience"><AudienceSelect data={data}/></Field><Field label="Início" htmlFor="event-start"><Input id="event-start" name="startsAt" type="datetime-local" defaultValue={localInput(10,18)} required /></Field><Field label="Fim" htmlFor="event-end"><Input id="event-end" name="endsAt" type="datetime-local" defaultValue={localInput(10,20)} required /></Field><Field label="Local" htmlFor="location"><Input id="location" name="location" required /></Field><Field label="Capacidade" htmlFor="capacity"><Input id="capacity" name="capacity" type="number" min={1} max={5000} defaultValue={80} required /></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Publicar evento</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function NewAnnouncementDialog({ data, mutate }: { data: PortalData; mutate: Mutation }) {
  const dialog = useActionDialog(mutate);
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("create_announcement", { title: String(fd.get("title")), body: String(fd.get("body")), priority: String(fd.get("priority")), ...audiencePayload(fd.get("audience")), requiresAcknowledgement: fd.get("requiresAcknowledgement") === "on" }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button variant="outline"><Megaphone />Novo aviso</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Publicar aviso</DialogTitle><DialogDescription>Escolha o público e, se necessário, exija confirmação de leitura.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4"><Field label="Título" htmlFor="notice-title"><Input id="notice-title" name="title" required /></Field><Field label="Mensagem" htmlFor="notice-body"><Textarea id="notice-body" name="body" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Prioridade" htmlFor="priority"><FormSelect name="priority" label="Prioridade" value="NORMAL"><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="IMPORTANT">Importante</SelectItem><SelectItem value="URGENT">Urgente</SelectItem></FormSelect></Field><Field label="Público" htmlFor="audience"><AudienceSelect data={data}/></Field></div><div className="flex items-center gap-2"><Switch id="requiresAcknowledgement" name="requiresAcknowledgement" /><Label htmlFor="requiresAcknowledgement">Exigir confirmação de leitura</Label></div><DialogFooter><Button type="button" variant="outline" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Publicar aviso</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function PracticeDialog({ data, mutate }: { data: PortalData; mutate: Mutation }) {
  const dialog = useActionDialog(mutate); const studentId = data.session.studentId ?? data.students[0]?.id;
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("add_practice", { studentId, practicedOn: String(fd.get("practicedOn")), minutes: Number(fd.get("minutes")), repertoire: String(fd.get("repertoire") || ""), difficulty: String(fd.get("difficulty") || ""), observations: String(fd.get("observations") || ""), shareWithTeacher: fd.get("shareWithTeacher") === "on" }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button><Plus />Registrar prática</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Diário de prática</DialogTitle><DialogDescription>Registre o que ajuda no seu aprendizado. Você escolhe se compartilha com o professor.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4"><div className="grid grid-cols-2 gap-4"><Field label="Data" htmlFor="practicedOn"><Input id="practicedOn" name="practicedOn" type="date" defaultValue={localInput(0,10).slice(0,10)} required /></Field><Field label="Minutos" htmlFor="minutes"><Input id="minutes" name="minutes" type="number" min={1} max={720} defaultValue={30} required /></Field></div><Field label="Repertório" htmlFor="practice-repertoire"><Input id="practice-repertoire" name="repertoire" /></Field><Field label="Maior dificuldade" htmlFor="difficulty"><Input id="difficulty" name="difficulty" /></Field><Field label="Observações" htmlFor="observations"><Textarea id="observations" name="observations" /></Field><div className="flex items-center gap-2"><Switch id="shareWithTeacher" name="shareWithTeacher" defaultChecked /><Label htmlFor="shareWithTeacher">Compartilhar este registro com o professor</Label></div><DialogFooter><Button type="button" variant="outline" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Salvar registro</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function PaymentDialog({ data, mutate }: { data: PortalData; mutate: Mutation }) {
  const dialog = useActionDialog(mutate); const openCharges = data.charges.filter((c) => c.status !== "PAID");
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("record_payment", { chargeId: String(fd.get("chargeId")), amountCents: Math.round(Number(fd.get("amount"))*100), method: String(fd.get("method")) }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button><CreditCard />Registrar pagamento</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Registrar pagamento</DialogTitle><DialogDescription>A operação é idempotente e deixa trilha de auditoria.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4"><Field label="Cobrança" htmlFor="chargeId"><FormSelect name="chargeId" label="Cobrança" value={openCharges[0]?.id}>{openCharges.map((c) => <SelectItem key={c.id} value={c.id}>{c.studentName} · R$ {(c.finalAmountCents/100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</SelectItem>)}</FormSelect></Field><Field label="Valor" htmlFor="amount"><Input id="amount" name="amount" type="number" min="0.01" step="0.01" required /></Field><Field label="Forma" htmlFor="method"><FormSelect name="method" label="Forma" value="PIX"><SelectItem value="PIX">Pix</SelectItem><SelectItem value="CARD">Cartão</SelectItem><SelectItem value="CASH">Dinheiro</SelectItem><SelectItem value="TRANSFER">Transferência</SelectItem><SelectItem value="OTHER">Outra</SelectItem></FormSelect></Field><DialogFooter><Button type="button" variant="outline" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Confirmar pagamento</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function NewStudentDialog({ mutate }: { mutate: Mutation }) {
  const dialog = useActionDialog(mutate);
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fd = new FormData(event.currentTarget); await dialog.submit("create_student", { name: String(fd.get("name")), email: String(fd.get("email")), birthDate: String(fd.get("birthDate") || "") || null }); }
  return <Dialog open={dialog.open} onOpenChange={dialog.setOpen}><DialogTrigger asChild><Button><UserPlus />Novo aluno</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Cadastrar aluno</DialogTitle><DialogDescription>Somente os dados necessários são solicitados. O acesso fica pendente até o convite do provedor de identidade.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="grid gap-4"><Field label="Nome" htmlFor="student-name"><Input id="student-name" name="name" required /></Field><Field label="E-mail" htmlFor="student-email"><Input id="student-email" name="email" type="email" required /></Field><Field label="Data de nascimento" htmlFor="birthDate"><Input id="birthDate" name="birthDate" type="date" /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => dialog.setOpen(false)}>Cancelar</Button><Button disabled={dialog.pending} type="submit">Cadastrar</Button></DialogFooter></form></DialogContent></Dialog>;
}
