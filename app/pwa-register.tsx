"use client";

import { useEffect, useState } from "react";
import { Download, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    updateInstalled();
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", updateInstalled);
    standalone.addEventListener("change", updateInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", updateInstalled);
      standalone.removeEventListener("change", updateInstalled);
    };
  }, []);
  if (installed) return null;
  async function install() {
    if (!prompt) { setHelpOpen(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") { setPrompt(null); setInstalled(true); }
  }
  return <>
    <Button variant="outline" size="sm" onClick={install}><Download />Instalar app</Button>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Instalar a Harmonia</DialogTitle><DialogDescription>Use a plataforma como um app, com ícone e janela própria. Seus dados privados não ficam salvos para uso offline.</DialogDescription></DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="flex gap-3 rounded-xl border p-4"><Smartphone className="mt-0.5 size-5 shrink-0"/><p><strong>iPhone ou iPad:</strong> no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p></div>
          <div className="flex gap-3 rounded-xl border p-4"><Monitor className="mt-0.5 size-5 shrink-0"/><p><strong>Android ou computador:</strong> abra o menu do Chrome/Edge e escolha “Instalar Harmonia” ou “Adicionar à tela inicial”.</p></div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
