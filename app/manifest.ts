import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Harmonia · Escola de Música",
    short_name: "Harmonia",
    description: "Agenda, tarefas, relatórios e gestão segura da escola de música.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7f9",
    theme_color: "#102746",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda", short_name: "Agenda", url: "/agenda", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Tarefas", short_name: "Tarefas", url: "/tarefas", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
