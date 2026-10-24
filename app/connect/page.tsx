"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, DEMO_ACCOUNT_EMAIL, isDemoSession, oidcConfig, saveTokens, session, startDemoSession } from "@/src/api/client";
import type { ClientConfig } from "@/src/api/types";
import type { DevToken } from "@/src/api/generated";
import * as oidc from "@/src/oidc";

export default function ConnectPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const destination = () => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  };

  useEffect(() => {
    void api<ClientConfig>("/v1/config").then(async (clientConfig) => {
      session.config = clientConfig;
      setConfig(clientConfig);
      const oidcSettings = oidcConfig();
      if (oidcSettings) {
        const tokens = await oidc.finish(oidcSettings);
        if (tokens) saveTokens(tokens);
      }
      if (session.token || isDemoSession()) window.location.assign(destination());
      setReady(true);
    }).catch(() => {
      setError(`Couldn't reach the API. You can still preview the app with ${DEMO_ACCOUNT_EMAIL}.`);
      setReady(true);
    });
  }, []);

  const signInDev = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (startDemoSession(email)) {
      window.location.assign(destination());
      return;
    }
    if (config?.auth !== "dev") {
      setError(`Live sign-in needs the API. Use ${DEMO_ACCOUNT_EMAIL} to preview the app.`);
      return;
    }
    try {
      const response = await fetch("/v1/dev/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw new Error("Couldn't sign in. Check the email address.");
      const token = await response.json() as DevToken;
      saveTokens({ access_token: token.access_token, expires_in: 12 * 3600 });
      window.location.assign(destination());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't sign in. Try again.");
    }
  };

  const login = (prompt?: string) => {
    const settings = oidcConfig();
    if (settings) void oidc.login(settings, { prompt }).catch(() => setError("Couldn't reach the sign-in page. Try again."));
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -top-36 left-1/2 h-80 w-[34rem] -translate-x-1/2 rounded-full bg-ledger/10 blur-3xl" />
      <section className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-[0_28px_90px_rgba(0,0,0,0.4)] sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand-tile)] text-lg font-bold text-[var(--brand-ink)]">S</span>
          <div>
            <p className="font-semibold tracking-tight text-ink">ScribbleScan</p>
            <p className="text-xs text-quiet">Personal finance, in focus</p>
          </div>
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-ledger">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Sign in to continue</h1>
        <p className="mt-2 leading-6 text-quiet">Your budgets, receipts, and spaces are waiting.</p>

        {!ready ? <p className="mt-6 text-sm text-quiet">Checking the connection…</p> : null}
        {ready && (config?.auth === "dev" || config === null) ? (
          <form onSubmit={(event) => void signInDev(event)} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-ink">Email</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={DEMO_ACCOUNT_EMAIL} className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2.5 outline-none focus:border-ledger" />
              <p className="mt-1.5 text-xs text-quiet">Sample account: {DEMO_ACCOUNT_EMAIL}</p>
            </div>
            <button type="submit" className="w-full rounded-lg bg-ledger-button px-5 py-2.5 font-semibold text-white transition hover:bg-[#0a5948]">Sign in</button>
          </form>
        ) : null}
        {ready && config?.auth === "oidc" ? (
          <div className="mt-6 space-y-3">
            <button type="button" onClick={() => login()} className="w-full rounded-lg bg-ledger-button px-5 py-2.5 font-semibold text-white transition hover:bg-[#0a5948]">Sign in</button>
            <button type="button" onClick={() => login("create")} className="w-full rounded-lg border border-line px-5 py-2.5 font-semibold text-ink hover:bg-paper">Create an account</button>
          </div>
        ) : null}
        <div className="mt-6 rounded-xl border border-line bg-paper/60 p-3">
          <p className="text-xs text-quiet">Want to explore the app first?</p>
          <button type="button" onClick={() => { startDemoSession(DEMO_ACCOUNT_EMAIL); window.location.assign(destination()); }} className="mt-2 w-full rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper">Preview sample account · {DEMO_ACCOUNT_EMAIL}</button>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-lg bg-amber-soft px-3 py-2.5 text-sm text-amber">{error}</p> : null}
        {ready && !config && !error ? <p role="alert" className="mt-4 text-sm text-quiet">Sign in is unavailable while the API is offline.</p> : null}
        <p className="mt-6 border-t border-line pt-4 text-xs leading-5 text-quiet">Development sign-in is for local use only. Production sign-in uses your configured identity provider.</p>
      </section>
    </main>
  );
}
