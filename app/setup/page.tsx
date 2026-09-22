import { redirect } from "next/navigation";
import { Music2 } from "lucide-react";
import { getD1 } from "@/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const school = await getD1().prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (school) redirect("/login");

  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--ink)] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="brand-symbol"><Music2 /></span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Harmonia</h1>
            <p className="text-sm text-[#9fb2c6]">Crie a conta de acesso</p>
          </div>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>Essa conta terá acesso completo (Direção) e vai gerar os dados de demonstração da escola.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" action="/api/auth/setup" className="grid gap-4">
              {error && (
                <p role="alert" className="rounded-lg bg-[color-mix(in_srgb,var(--destructive),transparent_88%)] px-3 py-2 text-sm text-[var(--destructive)]">
                  Não foi possível criar a conta. Verifique os dados e tente novamente.
                </p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input id="name" name="name" type="text" autoComplete="name" required autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
                <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
              </div>
              <Button type="submit" className="mt-2 w-full">Criar conta e entrar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
