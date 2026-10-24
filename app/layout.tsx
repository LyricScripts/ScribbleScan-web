import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/src/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScribbleScan — Spending",
  description: "A Bangladesh-first budget and receipt tracking app.",
  applicationName: "ScribbleScan",
};

// Caddy sends a per-request CSP nonce; pages must render on each request so Next.js
// can apply it to every inline bootstrap script instead of serving cached HTML.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
