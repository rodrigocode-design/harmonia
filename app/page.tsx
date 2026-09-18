import { PortalShell } from "@/app/portal-shell";
import { requireUser } from "@/app/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser("/");
  return <PortalShell initialSection="inicio" />;
}
