import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/app/pwa-register";

export const metadata: Metadata = {
  title: { default: "Harmonia", template: "%s · Harmonia" },
  description: "Gestão segura e integrada para escolas de música.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Harmonia" },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102746",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased"><PwaRegister />{children}</body>
    </html>
  );
}
