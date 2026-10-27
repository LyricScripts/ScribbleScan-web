import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/src/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScribbleScan — Spending",
  description: "A Bangladesh-first budget and receipt tracking app.",
  applicationName: "ScribbleScan",
};

// Every page fetches its data in the browser, so rendering them ahead of time
// buys nothing. Rendering them per request is what lets the server add a
// fresh nonce to its scripts: Next.js only does that when it renders the page,
// so a page served from the build cache would come without a nonce and the
// browser would refuse to run it.
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
