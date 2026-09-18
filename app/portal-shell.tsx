"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell, BookOpenCheck, CalendarDays, ChevronDown, CircleDollarSign, ClipboardList, Command,
  FileText, Gauge, GraduationCap, Headphones, History, LockKeyhole, LogOut, Menu, Music2, Search,
  Settings, ShieldCheck, Users, Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { AuditScreen, DashboardScreen, EventsScreen, FinanceScreen, MetricsScreen, PeopleScreen, PracticeScreen, ReportsScreen, ResourcesScreen, ScheduleScreen, SecurityScreen, SettingsScreen, TasksScreen } from "@/app/screens";
import type { PortalData } from "@/app/portal-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { InstallAppButton } from "@/app/pwa-register";
import type { RoleCode } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/access";

type Section = "inicio" | "agenda" | "alunos" | "tarefas" | "relatorios" | "indicadores" | "eventos" | "pratica" | "financeiro" | "recursos" | "seguranca" | "auditoria" | "configuracoes";
type NavItem = { id: Section; label: string; icon: typeof Gauge; roles?: RoleCode[] };
const TZ = "America/Sao_Paulo";

const navigation: NavItem[] = [
  { id: "inicio", label: "Visão geral", icon: Gauge },
  { id: "agenda", label: "Agenda", icon: CalendarDays, roles: ["ADMIN","DIRECAO","SECRETARIA","COORDENACAO","PROFESSOR","ALUNO","RESPONSAVEL"] },
  { id: "alunos", label: "Alunos", icon: Users, roles: ["ADMIN","DIRECAO","SECRETARIA","COORDENACAO","PROFESSOR","RESPONSAVEL"] },
  { id: "tarefas", label: "Tarefas", icon: BookOpenCheck, roles: ["ADMIN","DIRECAO","COORDENACAO","PROFESSOR","ALUNO","RESPONSAVEL"] },
  { id: "relatorios", label: "Relatórios", icon: FileText, roles: ["ADMIN","DIRECAO","COORDENACAO","PROFESSOR","ALUNO","RESPONSAVEL"] },
  { id: "indicadores", label: "Indicadores", icon: ClipboardList, roles: ["ADMIN","DIRECAO","COORDENACAO","PROFESSOR"] },
  { id: "eventos", label: "Eventos e avisos", icon: Music2, roles: ["ADMIN","DIRECAO","SECRETARIA","COORDENACAO","PROFESSOR","ALUNO","RESPONSAVEL"] },
  { id: "pratica", label: "Prática e evolução", icon: Headphones, roles: ["PROFESSOR","ALUNO","COORDENACAO"] },
  { id: "financeiro", label: "Financeiro", icon: CircleDollarSign, roles: ["ADMIN","DIRECAO","SECRETARIA","FINANCEIRO","ALUNO","RESPONSAVEL"] },
  { id: "recursos", label: "Salas e instrumentos", icon: Warehouse, roles: ["ADMIN","DIRECAO","SECRETARIA"] },
];
const governance: NavItem[] = [
  { id: "seguranca", label: "Segurança e LGPD", icon: ShieldCheck, roles: ["ADMIN","DIRECAO"] },
  { id: "auditoria", label: "Auditoria", icon: History, roles: ["ADMIN","DIRECAO"] },
  { id: "configuracoes", label: "Configurações", icon: Settings, roles: ["ADMIN","DIRECAO"] },
];

function available(item: NavItem, role: RoleCode) { return !item.roles || item.roles.includes(role); }

function usePortal(role: RoleCode) {
  const [data,setData]=useState<PortalData|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const load=useCallback(async(silent=false)=>{ if(!silent)setLoading(true); setError(null); try{const response=await fetch(`/api/app?role=${role}`,{headers:{"x-harmonia-role":role},cache:"no-store"});const body=await response.json() as PortalData&{error?:string};if(!response.ok)throw new Error(body.error||"Não foi possível carregar os dados.");setData(body);}catch(err){setError(err instanceof Error?err.message:"Não foi possível carregar os dados.");}finally{setLoading(false);}},[role]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);
  const mutate=useCallback(async(action:string,payload:unknown)=>{const id=toast.loading("Salvando com segurança…");try{const response=await fetch("/api/app",{method:"POST",headers:{"Content-Type":"application/json","x-harmonia-role":role,"Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({action,payload})});const body=await response.json() as {message?:string;error?:string};if(!response.ok)throw new Error(body.error||"Não foi possível salvar.");toast.success(body.message||"Alteração salva.",{id});await load(true);return true;}catch(err){toast.error(err instanceof Error?err.message:"Não foi possível salvar.",{id});return false;}},[load,role]);
  return {data,loading,error,load,mutate};
}

function initials(name:string){return name.split(" ").map(part=>part[0]).filter(Boolean).slice(0,2).join("").toUpperCase();}

function LoadingPortal(){return <div className="min-h-svh bg-[var(--paper)] p-5 md:p-8"><div className="mx-auto max-w-6xl"><div className="mb-8 flex items-center justify-between"><Skeleton className="h-10 w-40"/><Skeleton className="h-10 w-52"/></div><Skeleton className="mb-8 h-16 w-96 max-w-full"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4},(_,i)=><Skeleton key={i} className="h-36 rounded-2xl"/>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-[1.65fr_1fr]"><Skeleton className="h-96 rounded-2xl"/><Skeleton className="h-96 rounded-2xl"/></div></div></div>;}

function SearchDialog({open,onOpenChange,data,onNavigate}:{open:boolean;onOpenChange:(open:boolean)=>void;data:PortalData;onNavigate:(section:Section)=>void}){
  const [query,setQuery]=useState(""); const q=query.toLocaleLowerCase("pt-BR");
  const results=useMemo(()=>q.length<2?[]:[
    ...data.students.filter(x=>x.name.toLowerCase().includes(q)).map(x=>({type:"Aluno",title:x.name,detail:x.email||"Dados restritos",section:"alunos" as Section})),
    ...data.lessons.filter(x=>(x.title+x.teacherName+x.studentNames.join(" ")).toLowerCase().includes(q)).map(x=>({type:"Aula",title:x.title,detail:x.teacherName,section:"agenda" as Section})),
    ...data.tasks.filter(x=>(x.title+x.instructions).toLowerCase().includes(q)).map(x=>({type:"Tarefa",title:x.title,detail:x.teacherName,section:"tarefas" as Section})),
    ...data.events.filter(x=>(x.title+x.description).toLowerCase().includes(q)).map(x=>({type:"Evento",title:x.title,detail:x.location,section:"eventos" as Section})),
  ].slice(0,12),[data,q]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();onOpenChange(true);}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[onOpenChange]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="top-[18%] translate-y-0 p-0 sm:max-w-xl"><DialogHeader className="sr-only"><DialogTitle>Busca global</DialogTitle><DialogDescription>Busca limitada aos dados autorizados no contexto atual.</DialogDescription></DialogHeader><div className="search-box"><Search/><Input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar aluno, aula, tarefa ou evento…" aria-label="Busca global"/><span>esc</span></div><div className="max-h-96 overflow-y-auto border-t p-2">{q.length<2?<p className="p-8 text-center text-sm text-muted-foreground">Digite ao menos 2 caracteres. Os resultados respeitam suas permissões.</p>:results.length?results.map((result,i)=><button key={`${result.type}-${i}`} className="search-result" onClick={()=>{onNavigate(result.section);onOpenChange(false);}}><span>{result.type}</span><div><strong>{result.title}</strong><p>{result.detail}</p></div><ChevronDown className="-rotate-90"/></button>):<p className="p-8 text-center text-sm text-muted-foreground">Nenhum resultado autorizado.</p>}</div></DialogContent></Dialog>;
}

function Notifications({data}:{data:PortalData}){const unread=data.notifications.filter(n=>!n.readAt).length;return <Sheet><SheetTrigger asChild><Button aria-label={`Notificações${unread?`, ${unread} não lidas`:""}`} variant="ghost" size="icon" className="relative"><Bell/>{unread>0&&<span className="notification-count">{unread}</span>}</Button></SheetTrigger><SheetContent className="w-[min(420px,100vw)] p-0"><SheetHeader className="border-b p-6 text-left"><SheetTitle>Notificações</SheetTitle><SheetDescription>Atualizações do seu contexto atual.</SheetDescription></SheetHeader><div className="divide-y">{data.notifications.map(n=><article key={n.id} className="p-5"><div className="flex gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${n.readAt?"bg-slate-300":"bg-[var(--amber)]"}`}/><div><h3 className="font-semibold">{n.title}</h3><p className="mt-1 text-sm text-muted-foreground">{n.body}</p></div></div></article>)}</div></SheetContent></Sheet>}

function registerWebMcp(data:PortalData,mutate:(action:string,payload:unknown)=>Promise<boolean>){
  const doc=document as Document&{modelContext?:{registerTool:(tool:Record<string,unknown>,options?:{signal?:AbortSignal})=>void|Promise<void>}};if(!doc.modelContext?.registerTool)return()=>{};const lifecycle=new AbortController();
  const register=(tool:Record<string,unknown>)=>{try{void Promise.resolve(doc.modelContext?.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* navegador sem suporte completo */}};
  register({name:"list_today_lessons",title:"Listar aulas de hoje",description:"Lista as aulas de hoje já visíveis no contexto atual do usuário.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({timezone:TZ,lessons:data.lessons.filter(l=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ}).format(new Date(l.startsAt))===new Intl.DateTimeFormat("en-CA",{timeZone:TZ}).format(new Date())).map(l=>({id:l.id,title:l.title,startsAt:l.startsAt,status:l.status}))})});
  if(["ADMIN","DIRECAO","SECRETARIA"].includes(data.session.activeRole))register({name:"create_lesson",title:"Agendar aula",description:"Agenda uma aula após validação transacional de professor, aluno, sala e intervalos.",inputSchema:{type:"object",properties:{title:{type:"string"},teacherId:{type:"string"},studentId:{type:"string"},roomId:{type:"string"},startsAt:{type:"string",description:"ISO 8601 com fuso"},endsAt:{type:"string",description:"ISO 8601 com fuso"}},required:["title","teacherId","studentId","startsAt","endsAt"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{const value=input as Record<string,string>;const ok=await mutate("create_lesson",{title:value.title,teacherId:value.teacherId,studentIds:[value.studentId],roomId:value.roomId||null,instrumentId:null,startsAt:value.startsAt,endsAt:value.endsAt,bufferMinutes:10,modality:value.roomId?"IN_PERSON":"ONLINE",meetingUrl:value.roomId?null:"https://example.invalid/reuniao",recurring:false,occurrences:1,useMakeupCredit:false});return{ok};}});
  return()=>lifecycle.abort();
}

function RenderSection({section,data,mutate}:{section:Section;data:PortalData;mutate:(action:string,payload:unknown)=>Promise<boolean>}){
  switch(section){case"agenda":return<ScheduleScreen data={data} mutate={mutate}/>;case"alunos":return<PeopleScreen data={data} mutate={mutate}/>;case"tarefas":return<TasksScreen data={data} mutate={mutate}/>;case"relatorios":return<ReportsScreen data={data} mutate={mutate}/>;case"indicadores":return<MetricsScreen data={data}/>;case"eventos":return<EventsScreen data={data} mutate={mutate}/>;case"pratica":return<PracticeScreen data={data} mutate={mutate}/>;case"financeiro":return<FinanceScreen data={data} mutate={mutate}/>;case"recursos":return<ResourcesScreen data={data}/>;case"seguranca":return<SecurityScreen data={data}/>;case"auditoria":return<AuditScreen data={data}/>;case"configuracoes":return<SettingsScreen data={data}/>;default:return<DashboardScreen data={data} mutate={mutate}/>;}
}

export function PortalShell({initialSection="inicio"}:{initialSection?:string}){
  const parsed=(navigation.concat(governance).some(i=>i.id===initialSection)?initialSection:"inicio") as Section;
  const [role,setRole]=useState<RoleCode>("DIRECAO"); const [section,setSection]=useState<Section>(parsed); const [searchOpen,setSearchOpen]=useState(false); const portal=usePortal(role);
  const navigate=useCallback((next:Section)=>{setSection(next);window.history.pushState({},"",next==="inicio"?"/":`/${next}`);window.scrollTo({top:0,behavior:"smooth"});},[]);
  useEffect(()=>{const pop=()=>{const path=window.location.pathname.split("/")[1]||"inicio";setSection((navigation.concat(governance).some(i=>i.id===path)?path:"inicio") as Section);};window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);},[]);
  useEffect(()=>portal.data?registerWebMcp(portal.data,portal.mutate):undefined,[portal.data,portal.mutate]);
  if(portal.loading&&!portal.data)return<LoadingPortal/>;
  if(portal.error&&!portal.data)return <main className="error-page"><div><LockKeyhole/><h1>Não foi possível abrir a Harmonia</h1><p>{portal.error}</p><Button onClick={()=>portal.load()}>Tentar novamente</Button></div></main>;
  if(!portal.data)return null;
  const data=portal.data; const actingRole=data.session.roles.includes(role)?role:data.session.activeRole;
  const mainNav=navigation.filter(i=>available(i,actingRole)); const govNav=governance.filter(i=>available(i,actingRole));
  const visibleSection=navigation.concat(governance).some(i=>i.id===section&&available(i,actingRole))?section:"inicio";
  return <SidebarProvider><Sidebar variant="sidebar" collapsible="icon" className="harmonia-sidebar"><SidebarHeader className="p-4"><button className="brand" onClick={()=>navigate("inicio")} aria-label="Ir para visão geral"><span className="brand-symbol"><Music2/></span><span><strong>{data.session.school.name}</strong><small>{data.session.unit.name}</small></span></button></SidebarHeader><SidebarContent className="px-2"><SidebarGroup><SidebarGroupLabel>Operação</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{mainNav.map(item=><SidebarMenuItem key={item.id}><SidebarMenuButton tooltip={item.label} isActive={visibleSection===item.id} onClick={()=>navigate(item.id)}><item.icon/><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>{govNav.length>0&&<SidebarGroup><SidebarGroupLabel>Governança</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{govNav.map(item=><SidebarMenuItem key={item.id}><SidebarMenuButton tooltip={item.label} isActive={visibleSection===item.id} onClick={()=>navigate(item.id)}><item.icon/><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>}</SidebarContent><SidebarFooter className="p-3"><InstallAppButton/><div className="sidebar-user"><Avatar><AvatarFallback>{initials(data.session.user.displayName)}</AvatarFallback></Avatar><div><strong>{data.session.user.displayName}</strong><span>{ROLE_LABELS[actingRole]}</span></div><Button variant="ghost" size="icon" aria-label="Sair" title="Sair" className="ml-auto text-[#9fb2c6] hover:text-white" onClick={()=>{fetch("/api/auth/logout",{method:"POST"}).finally(()=>{window.location.href="/login";});}}><LogOut/></Button></div></SidebarFooter><SidebarRail/></Sidebar><SidebarInset className="min-w-0 bg-[var(--paper)]"><header className="topbar"><div className="flex items-center gap-2"><SidebarTrigger aria-label="Abrir ou recolher navegação"/><div className="mobile-brand"><span className="brand-symbol"><Music2/></span><strong>{data.session.school.name}</strong></div></div><button className="global-search" onClick={()=>setSearchOpen(true)}><Search/><span>Buscar em tudo…</span><kbd><Command/>K</kbd></button><div className="topbar-actions"><span className="privacy-chip"><ShieldCheck/>Dados protegidos</span><Notifications data={data}/><Select value={actingRole} onValueChange={(value)=>setRole(value as RoleCode)}><SelectTrigger className="role-switch" aria-label="Contexto de atuação"><GraduationCap/><SelectValue/></SelectTrigger><SelectContent align="end"><div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Atuar como</div>{data.session.roles.map(r=><SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select></div></header>{portal.loading&&<div className="route-progress"/>}<main className="portal-main" id="conteudo"><RenderSection section={visibleSection} data={data} mutate={portal.mutate}/></main><nav className="mobile-nav" aria-label="Navegação principal">{mainNav.slice(0,4).map(item=><button key={item.id} onClick={()=>navigate(item.id)} className={visibleSection===item.id?"active":""}><item.icon/><span>{item.label.split(" ")[0]}</span></button>)}<button onClick={()=>document.querySelector<HTMLButtonElement>("[data-sidebar=trigger]")?.click()}><Menu/><span>Menu</span></button></nav></SidebarInset><SearchDialog open={searchOpen} onOpenChange={setSearchOpen} data={data} onNavigate={navigate}/><Toaster richColors position="top-right" closeButton/></SidebarProvider>;
}
