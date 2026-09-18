import { redirect } from "next/navigation";
import { Music2 } from "lucide-react";
import { getAppUser } from "@/app/auth";
import { getD1 } from "@/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; error?: string }>;
}) {
  const existing = await getAppUser();
  const { return_to, error } = await searchParams;
  const returnTo = safeReturnTo(return_to);
  if (existing) redirect(returnTo);

  const school = await getD1().prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!school) redirect("/setup");

  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--ink)] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="brand-symbol"><Music2 /></span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Harmonia</h1>
            <p className="text-sm text-[#9fb2c6]">Sistema da escola de música</p>
          </div>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use o e-mail e a senha da sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" action={`/api/auth/login?return_to=${encodeURIComponent(returnTo)}`} className="grid gap-4">
              {error && (
                <p role="alert" className="rounded-lg bg-[color-mix(in_srgb,var(--destructive),transparent_88%)] px-3 py-2 text-sm text-[var(--destructive)]">
                  E-mail ou senha inválidos.
                </p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <Button type="submit" className="mt-2 w-full">Entrar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
