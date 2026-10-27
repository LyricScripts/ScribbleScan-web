"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DemoProvider, useDemo } from "@/src/components/demo-context";
import { api, clearTokens, DEMO_ACCOUNT_EMAIL, isDemoSession, oidcConfig, session } from "@/src/api/client";
import type { NotificationsOut } from "@/src/api/types";
import * as oidc from "@/src/oidc";
import { store } from "@/src/store";
import { ProfileMenu, type AccountNotification } from "@/src/components/profile-menu";
import { ReceiptUploadDialog } from "@/src/components/receipt-upload-dialog";
import { UpgradeDialog } from "@/src/components/upgrade-dialog";

type NavItem = { href?: string; label: string; icon: "spending" | "receipts" | "add" | "budgets" | "spaces" };

const navItems: NavItem[] = [
  { href: "/", label: "Spending", icon: "spending" },
  { href: "/receipts", label: "Receipts", icon: "receipts" },
  { label: "Add", icon: "add" },
  { href: "/budgets", label: "Budgets", icon: "budgets" },
  { href: "/spaces", label: "Spaces", icon: "spaces" },
];

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const paths: Record<NavItem["icon"], ReactNode> = {
    spending: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
    receipts: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6" />,
    add: <path d="M12 5v14m-7-7h14" />,
    budgets: <path d="M12 3a9 9 0 1 0 9 9h-9V3Zm3-1v6h6" />,
    spaces: <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Zm0 0V17l9 4 9-4V7.5M12 12v9" />,
  };

  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ mobile = false, onAddReceipt }: { mobile?: boolean; onAddReceipt: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className={mobile ? "grid grid-cols-5 gap-1" : "flex flex-col gap-1"}>
      {navItems.map((item) => {
        const active = item.href ? isActive(pathname, item.href) : false;
        const className = `flex items-center border-0 bg-transparent text-left ${mobile ? "flex-col gap-1 px-1 py-2 text-xs" : "gap-3 rounded-lg px-3 py-2.5 text-sm"} ${active ? "bg-ledger-soft font-semibold text-ledger" : "text-quiet hover:bg-paper hover:text-ink"} transition-colors`;
        const content = <><NavIcon name={item.icon} /><span>{item.label}</span></>;
        return (
          item.href
            ? <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={className}>{content}</Link>
            : <button key={item.label} type="button" aria-haspopup="dialog" onClick={onAddReceipt} className={className}>{content}</button>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const isPublicRoute = pathname === "/connect" || pathname === "/scan";

  useEffect(() => {
    document.documentElement.dataset.theme = store.get("ss.theme") === "light" ? "light" : "dark";
  }, []);

  useEffect(() => {
    if (isPublicRoute) {
      setChecked(true);
      setAuthorized(false);
      return;
    }
    const token = session.token ?? store.get("ss.token");
    if (token || isDemoSession()) {
      setAuthorized(true);
      setChecked(true);
      return;
    }
    setAuthorized(false);
    setChecked(true);
    const returnTo = pathname.startsWith("/") ? pathname : "/";
    router.replace(`/connect?returnTo=${encodeURIComponent(returnTo)}`);
  }, [isPublicRoute, pathname, router]);

  useEffect(() => {
    const onSignedOut = () => {
      setAuthorized(false);
      router.replace("/connect?reason=expired");
    };
    session.onSignedOut = onSignedOut;
    return () => {
      if (session.onSignedOut === onSignedOut) session.onSignedOut = () => {};
    };
  }, [router]);

  if (isPublicRoute) return <DemoProvider><AppFrame>{children}</AppFrame></DemoProvider>;
  if (!checked || !authorized) return <main className="grid min-h-screen place-items-center px-4 text-sm text-quiet" role="status">Taking you to sign in…</main>;
  return <DemoProvider><AppFrame>{children}</AppFrame></DemoProvider>;
}

function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeSpace, spaces, selectSpace, source, loading, currency, downloadCsv } = useDemo();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [serverNotifications, setServerNotifications] = useState<AccountNotification[]>([]);
  const openUpload = useCallback(() => setUploadOpen(true), []);
  const closeUpload = useCallback(() => setUploadOpen(false), []);

  useEffect(() => {
    if (source !== "connected") {
      setServerNotifications([]);
      return;
    }

    let active = true;
    const refresh = async () => {
      try {
        const result = await api<NotificationsOut>("/v1/notifications");
        if (active) setServerNotifications(result.items);
      } catch {
        // Keep the last server result; the next poll or focus event can retry.
      }
    };

    setServerNotifications([]);
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [source, pathname]);

  const markServerNotificationsRead = useCallback(async () => {
    if (source !== "connected") return;
    try {
      const result = await api<NotificationsOut>("/v1/notifications/read", { method: "POST" });
      setServerNotifications(result.items);
    } catch {
      // The badge remains until the server confirms the read state.
    }
  }, [source]);

  if (pathname === "/connect" || pathname === "/scan") return <>{children}</>;

  const signOut = async () => {
    const preview = isDemoSession();
    const idToken = store.get("ss.idtoken");
    clearTokens();
    if (preview) {
      window.location.assign("/connect");
      return;
    }
    const config = oidcConfig();
    const url = config ? await oidc.logoutUrl(config, idToken).catch(() => null) : null;
    if (url) window.location.assign(url);
    else window.location.assign("/");
  };
  if (loading && pathname !== "/connect" && pathname !== "/scan") {
    return <main className="grid min-h-screen place-items-center px-4 text-sm text-quiet" role="status">Loading your account…</main>;
  }
  const notifications: AccountNotification[] = source === "connected" ? serverNotifications : [];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-[var(--sidebar)] px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Link href="/" className="mb-8 flex items-center gap-3 px-3 text-lg font-semibold tracking-tight text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-tile)] text-base font-bold text-[var(--brand-ink)]">S</span>
          <span>ScribbleScan</span>
        </Link>
        <Navigation onAddReceipt={openUpload} />
        <div className="mt-auto rounded-xl border border-line bg-paper p-3 text-sm">
          <div className="font-semibold text-ink">{source === "connected" ? "Connected account" : "Preview data"}</div>
          <p className="mt-1 text-xs leading-5 text-quiet">{source === "connected" ? "Changes sync with the API." : "Live account data is unavailable."}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/" aria-label="ScribbleScan home" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-tile)] font-bold text-[var(--brand-ink)] lg:hidden">S</Link>
            <label className="sr-only" htmlFor="space-select">Choose a space</label>
            <select id="space-select" value={activeSpace} onChange={(event) => selectSpace(event.target.value)} className="max-w-[44vw] appearance-none rounded-full border border-line bg-card px-3 py-2 pr-8 text-sm font-semibold text-ink outline-none focus:border-ledger sm:max-w-[58vw] sm:px-4">
              {spaces.map((space) => <option key={space.id} value={space.name}>{space.name}</option>)}
            </select>
            <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${source === "connected" ? "bg-ledger-soft text-ledger" : "bg-amber-soft text-amber"}`}>{source === "connected" ? "Connected" : "Sample data"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" aria-haspopup="dialog" aria-expanded={uploadOpen} onClick={openUpload} className="inline-flex items-center gap-2 rounded-lg border-0 bg-ledger-button px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0a5948] sm:px-4">
              <NavIcon name="add" />
              <span className="hidden sm:inline">Add receipt</span>
            </button>
            <ProfileMenu email={isDemoSession() ? DEMO_ACCOUNT_EMAIL : null} preview={isDemoSession()} space={activeSpace} currency={currency} notifications={notifications} onNotificationsOpened={source === "connected" ? () => void markServerNotificationsRead() : undefined} onDownloadCsv={downloadCsv} onSignOut={() => void signOut()} />
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-68px)] max-w-7xl px-4 pb-28 pt-6 sm:px-7 sm:pt-8 lg:pb-10">
          {source === "sample" ? <div className="mb-5 rounded-xl border border-amber/20 bg-amber-soft px-4 py-2.5 text-sm text-ink sm:hidden"><span className="font-semibold text-amber">Preview data.</span> Live account data is unavailable.</div> : null}
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 lg:hidden">
        <Navigation mobile onAddReceipt={openUpload} />
      </div>
      {uploadOpen ? <ReceiptUploadDialog open={uploadOpen} onClose={closeUpload} /> : null}
      {source === "connected" ? <UpgradeDialog /> : null}
    </div>
  );
}
