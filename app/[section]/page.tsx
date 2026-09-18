import { notFound } from "next/navigation";
import { PortalShell } from "@/app/portal-shell";
import { requireUser } from "@/app/auth";

export const dynamic = "force-dynamic";

const sections = new Set(["agenda","alunos","tarefas","relatorios","indicadores","eventos","pratica","financeiro","recursos","seguranca","auditoria","configuracoes"]);

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  await requireUser(`/${section}`);
  return <PortalShell initialSection={section} />;
}
