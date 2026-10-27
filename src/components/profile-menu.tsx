"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { store } from "@/src/store";
import { PlanSummary } from "@/src/components/plan-summary";

type Theme = "dark" | "light";
type Panel = "menu" | "settings" | "appearance" | "subscription";

type ProfileMenuProps = {
  email: string | null;
  preview: boolean;
  space: string;
  currency: string;
  notifications: AccountNotification[];
  onNotificationsOpened?: () => void;
  onDownloadCsv: () => void;
  onSignOut: () => void;
};

export type AccountNotification = { id: string; title: string; detail: string; href: string; unread?: boolean };

function Icon({ name }: { name: "user" | "settings" | "theme" | "subscription" | "notification" | "csv" | "back" | "logout" }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.7Z" transform="translate(-1 -1) scale(1.08)" /></>,
    theme: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18a9 9 0 0 0 0-18Z" /></>,
    subscription: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-14 5h4" /></>,
    notification: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    csv: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6m-12 5h8m-8 4h8" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };

  return <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function ProfileMenu({ email, preview, space, currency, notifications, onNotificationsOpened, onDownloadCsv, onSignOut }: ProfileMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("menu");
  const [theme, setTheme] = useState<Theme>("dark");
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[] | null>(null);

  const hasServerReadState = notifications.some((notification) => typeof notification.unread === "boolean");
  const unseenCount = hasServerReadState
    ? notifications.filter((notification) => notification.unread).length
    : seenNotificationIds === null
      ? 0
      : notifications.filter((notification) => !seenNotificationIds.includes(notification.id)).length;

  useEffect(() => {
    const storedTheme = store.get("ss.theme");
    const initialTheme: Theme = storedTheme === "light" ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(store.get("ss.seen-notifications") ?? "[]") as unknown;
      setSeenNotificationIds(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setSeenNotificationIds([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setPanel("menu");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPanel("menu");
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const chooseTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    store.set("ss.theme", nextTheme);
  };

  const markNotificationsSeen = () => {
    const currentIds = notifications.map((notification) => notification.id);
    setSeenNotificationIds((current) => {
      const next = [...new Set([...(current ?? []), ...currentIds])].slice(-200);
      store.set("ss.seen-notifications", JSON.stringify(next));
      return next;
    });
  };

  const toggleMenu = () => {
    if (!open) {
      if (onNotificationsOpened) onNotificationsOpened();
      else markNotificationsSeen();
    }
    setOpen((current) => !current);
    setPanel("menu");
  };

  const showPanel = (nextPanel: Panel) => setPanel(nextPanel);
  const heading = panel === "settings" ? "Settings" : panel === "appearance" ? "Change theme" : "Subscription";

  return (
    <div ref={root} className="relative shrink-0">
      <span className="relative grid h-10 w-10 rounded-full p-[2px]" style={{ background: "conic-gradient(from 220deg, #ff5964, #ffc044, #70dfbd, #68b4ff, #a78bfa, #f079ae, #ff5964)" }}>
        <button
          ref={trigger}
          type="button"
          aria-label={`Open profile menu${unseenCount ? `, ${unseenCount} new notifications` : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="profile-popover"
          onClick={toggleMenu}
          className="grid h-full w-full place-items-center rounded-full border border-line bg-card text-ink transition hover:bg-[var(--raised)]"
        >
          <Icon name="user" />
        </button>
        {unseenCount > 0 ? <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-card bg-stamp px-0.5 text-[9px] font-bold leading-none text-white">{unseenCount > 9 ? "9+" : unseenCount}</span> : null}
      </span>

      {open ? (
        <div id="profile-popover" role="dialog" aria-label={panel === "menu" ? "Account menu" : heading} className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-card shadow-[0_18px_55px_rgba(0,0,0,0.42)]">
          {panel === "menu" ? <>
            <div className="flex items-center gap-3 border-b border-line px-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ledger-soft text-ledger"><Icon name="user" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{preview ? "Sample account" : "Your account"}</span>
                <span className="block truncate text-xs text-quiet">{email ?? "Connected account"}</span>
              </span>
            </div>
            <section className="border-b border-line px-3 py-3" aria-label="Notifications">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-quiet"><Icon name="notification" />Notifications</div>
                {unseenCount > 0 ? <span className="rounded-full bg-stamp/10 px-2 py-0.5 text-[10px] font-semibold text-stamp">{unseenCount} new</span> : null}
              </div>
              {notifications.length ? <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {notifications.map((notification) => {
                  const unread = typeof notification.unread === "boolean"
                    ? notification.unread
                    : seenNotificationIds !== null && !seenNotificationIds.includes(notification.id);
                  return <Link key={notification.id} href={notification.href} onClick={() => setOpen(false)} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-[var(--raised)]">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-stamp" : "bg-line"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{notification.title}</span>
                      <span className="block truncate text-xs text-quiet">{notification.detail}</span>
                    </span>
                  </Link>;
                })}
              </div> : <p className="mt-2 px-1 text-sm text-quiet">You’re all caught up.</p>}
            </section>
            <div className="space-y-1 p-2">
              <button type="button" onClick={() => showPanel("settings")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-[var(--raised)]"><Icon name="settings" />Settings</button>
              <button type="button" onClick={() => showPanel("appearance")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-[var(--raised)]"><Icon name="theme" />Change theme<span className="ml-auto text-xs capitalize text-quiet">{theme}</span></button>
              <button type="button" onClick={() => showPanel("subscription")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-[var(--raised)]"><Icon name="subscription" />Subscription</button>
              <button type="button" onClick={() => { onDownloadCsv(); setOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-[var(--raised)]"><Icon name="csv" />Download CSV</button>
            </div>
            <div className="border-t border-line p-2">
              <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stamp transition hover:bg-stamp/10"><Icon name="logout" />{preview ? "Exit preview" : "Sign out"}</button>
            </div>
          </> : (
            <>
              <div className="flex items-center gap-2 border-b border-line px-3 py-3">
                <button type="button" aria-label="Back to account menu" onClick={() => setPanel("menu")} className="grid h-8 w-8 place-items-center rounded-lg text-quiet hover:bg-[var(--raised)] hover:text-ink"><Icon name="back" /></button>
                <h2 className="text-sm font-semibold text-ink">{heading}</h2>
              </div>
              <div className="p-4">
                {panel === "settings" ? <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-quiet">Account</p>
                    <p className="mt-1 text-sm font-medium text-ink">{email ?? "Connected account"}</p>
                    <p className="mt-1 text-xs text-quiet">{preview ? "Sample data preview" : "Account connected to ScribbleScan"}</p>
                  </div>
                  <div className="border-t border-line pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-quiet">Current space</p>
                    <p className="mt-1 text-sm font-medium text-ink">{space}</p>
                    <p className="mt-1 text-xs text-quiet">Currency: {currency}</p>
                  </div>
                </div> : null}
                {panel === "appearance" ? <div>
                  <p className="text-sm text-quiet">Choose how ScribbleScan looks on this device.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Choose theme">
                    {(["dark", "light"] as const).map((option) => <button key={option} type="button" aria-pressed={theme === option} onClick={() => chooseTheme(option)} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold capitalize transition ${theme === option ? "border-ledger bg-ledger-soft text-ledger" : "border-line text-quiet hover:bg-[var(--raised)] hover:text-ink"}`}>{option}</button>)}
                  </div>
                </div> : null}
                {panel === "subscription" ? <PlanSummary preview={preview} /> : null}
              </div>
              {panel === "subscription" ? <div className="border-t border-line px-4 py-3"><button type="button" onClick={onSignOut} className="text-sm font-semibold text-quiet hover:text-ink">{preview ? "Exit preview" : "Sign out"}</button></div> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
