"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  api,
  DEMO_ACCOUNT_EMAIL,
  isDemoSession,
  oidcConfig,
  saveTokens,
  session,
  startDemoSession,
} from "@/src/api/client";
import type { DevToken } from "@/src/api/generated";
import type { ClientConfig } from "@/src/api/types";
import * as oidc from "@/src/oidc";

export default function ConnectPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneFormOpen, setPhoneFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const destination = useCallback(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  }, []);

  useEffect(() => {
    void api<ClientConfig>("/v1/config")
      .then(async (clientConfig) => {
        session.config = clientConfig;
        setConfig(clientConfig);
        const oidcSettings = oidcConfig();
        if (oidcSettings) {
          const tokens = await oidc.finish(oidcSettings);
          if (tokens) saveTokens(tokens);
        }
        if (session.token || isDemoSession()) window.location.assign(destination());
        setReady(true);
      })
      .catch(() => {
        setError(`Couldn't reach the API. You can still preview the app with ${DEMO_ACCOUNT_EMAIL}.`);
        setReady(true);
      });
  }, [destination]);

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
      const token = (await response.json()) as DevToken;
      saveTokens({ access_token: token.access_token, expires_in: 12 * 3600 });
      window.location.assign(destination());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't sign in. Try again.");
    }
  };

  const login = (prompt?: string, loginHint?: string) => {
    const settings = oidcConfig();
    if (settings)
      void oidc
        .login(settings, { prompt, loginHint })
        .catch(() => setError("Couldn't reach the sign-in page. Try again."));
  };

  const loginWithProvider = (provider: "Google" | "Microsoft") => {
    if (!oidcConfig()) {
      setError(`${provider} sign-in will be available when an identity provider is configured.`);
      return;
    }
    setError("");
    login();
  };

  const signInWithPhone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!oidcConfig()) {
      setError("Phone sign-in will be available when an identity provider is configured.");
      return;
    }
    setError("");
    login(undefined, phoneNumber.trim());
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-12 h-72 w-[42rem] max-w-[90vw] -translate-x-1/2 rounded-full bg-ledger/[0.07] blur-3xl"
      />
      <header className="relative flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-tile)] text-base font-bold text-[var(--brand-ink)]">
          S
        </span>
        <span className="text-base font-semibold tracking-tight text-ink">ScribbleScan</span>
      </header>

      <section className="relative mx-auto flex w-full max-w-[27.5rem] flex-1 flex-col justify-center py-14 text-center">
        <p className="text-sm font-medium text-ledger">Receipts and spending, together</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Sign in to ScribbleScan
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-quiet">
          Keep your purchases, budgets, and spaces in one clear view.
        </p>
        <div aria-hidden="true" className="mx-auto mt-7 flex h-px w-28 overflow-hidden bg-line">
          <span className="w-9 bg-ledger" />
        </div>

        {!ready ? (
          <p role="status" className="mt-8 text-sm text-quiet">
            Checking the connection…
          </p>
        ) : null}
        {ready && (config?.auth === "dev" || config === null) ? (
          <form onSubmit={(event) => void signInDev(event)} className="mt-8 space-y-3 text-left">
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              className="w-full rounded-full border border-line bg-card px-5 py-3 text-base text-ink outline-none transition placeholder:text-quiet focus:border-ledger"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-ledger-button px-5 py-3 font-semibold text-white transition hover:bg-[#0a5948]"
            >
              Continue
            </button>
            <p className="px-1 text-center text-sm text-quiet">
              For the sample account, use {DEMO_ACCOUNT_EMAIL}.
            </p>
          </form>
        ) : null}
        {ready && config?.auth === "oidc" ? (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => login()}
              className="w-full rounded-full bg-ledger-button px-5 py-3 font-semibold text-white transition hover:bg-[#0a5948]"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => login("create")}
              className="w-full rounded-full border border-line bg-card px-5 py-3 font-semibold text-ink transition hover:border-ledger hover:bg-raised"
            >
              Create an account
            </button>
          </div>
        ) : null}

        {ready ? (
          <>
            <div className="my-6 flex items-center gap-4 text-xs font-medium uppercase tracking-[0.14em] text-quiet">
              <span className="h-px flex-1 bg-line" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => loginWithProvider("Google")}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-card px-5 py-3 font-medium text-ink transition hover:border-ledger hover:bg-raised"
              >
                <GoogleMark />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => loginWithProvider("Microsoft")}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-card px-5 py-3 font-medium text-ink transition hover:border-ledger hover:bg-raised"
              >
                <MicrosoftMark />
                Continue with Microsoft
              </button>
              <button
                type="button"
                aria-expanded={phoneFormOpen}
                aria-controls="phone-sign-in-form"
                onClick={() => {
                  setPhoneFormOpen((open) => !open);
                  setError("");
                }}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-card px-5 py-3 font-medium text-ink transition hover:border-ledger hover:bg-raised"
              >
                <PhoneMark />
                Continue with phone
              </button>
              {phoneFormOpen ? (
                <form id="phone-sign-in-form" onSubmit={signInWithPhone} className="space-y-3 pt-1 text-left">
                  <label htmlFor="phone-number" className="sr-only">
                    Phone number
                  </label>
                  <input
                    id="phone-number"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="Phone number, including country code"
                    className="w-full rounded-full border border-line bg-card px-5 py-3 text-base text-ink outline-none transition placeholder:text-quiet focus:border-ledger"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-full bg-ledger-button px-5 py-3 font-semibold text-white transition hover:bg-[#0a5948]"
                  >
                    Continue with phone
                  </button>
                </form>
              ) : null}
            </div>
            {config?.auth === "oidc" ? (
              <p className="mt-3 text-xs leading-5 text-quiet">
                Google and Microsoft use your configured identity provider. Phone sign-in passes your number
                as a sign-in hint.
              </p>
            ) : null}
          </>
        ) : null}

        <div className="my-6 flex items-center gap-4 text-xs font-medium uppercase tracking-[0.14em] text-quiet">
          <span className="h-px flex-1 bg-line" />
          <span>or</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <button
          type="button"
          onClick={() => {
            startDemoSession(DEMO_ACCOUNT_EMAIL);
            window.location.assign(destination());
          }}
          className="w-full rounded-full border border-line bg-transparent px-5 py-3 font-medium text-ink transition hover:border-ledger hover:bg-card"
        >
          Preview the sample account
        </button>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-amber/20 bg-amber-soft px-4 py-3 text-left text-sm text-amber"
          >
            {error}
          </p>
        ) : null}
        {ready && !config && !error ? (
          <p role="alert" className="mt-4 text-sm text-quiet">
            Sign in is unavailable while the API is offline.
          </p>
        ) : null}
        <p className="mt-5 text-xs leading-5 text-quiet">
          Development sign-in is for local use. Production sign-in uses your configured identity provider.
        </p>
      </section>

      <section
        aria-label="ScribbleScan features"
        className="relative mx-auto grid w-full max-w-5xl gap-3 sm:grid-cols-3"
      >
        <article className="rounded-xl border border-line bg-card/70 p-4 sm:p-5">
          <p className="text-sm font-semibold text-ink">Receipts</p>
          <p className="mt-1 text-sm leading-5 text-quiet">
            Capture purchases and review the details read from each receipt.
          </p>
        </article>
        <article className="rounded-xl border border-line bg-card/70 p-4 sm:p-5">
          <p className="text-sm font-semibold text-ink">Budgets</p>
          <p className="mt-1 text-sm leading-5 text-quiet">
            Set monthly limits and follow spending by category.
          </p>
        </article>
        <article className="rounded-xl border border-line bg-card/70 p-4 sm:p-5">
          <p className="text-sm font-semibold text-ink">Spaces</p>
          <p className="mt-1 text-sm leading-5 text-quiet">
            Keep personal and business records in separate spaces.
          </p>
        </article>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.63-.06-1.24-.16-1.82H9v3.44h4.84a4.14 4.14 0 0 1-1.8 2.72v2.23h2.92c1.7-1.57 2.68-3.88 2.68-6.57Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.92-2.23c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.3A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.7a5.4 5.4 0 0 1 0-3.4V5H.95a9 9 0 0 0 0 8l3.02-2.3Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.58-2.58A8.63 8.63 0 0 0 9 0a9 9 0 0 0-8.05 5l3.02 2.3C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
      <path fill="#F25022" d="M1 1h7.2v7.2H1z" />
      <path fill="#7FBA00" d="M9.8 1H17v7.2H9.8z" />
      <path fill="#00A4EF" d="M1 9.8h7.2V17H1z" />
      <path fill="#FFB900" d="M9.8 9.8H17V17H9.8z" />
    </svg>
  );
}

function PhoneMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path
        d="M6.2 2.5H4.1c-.9 0-1.6.7-1.5 1.6.7 7.1 6.2 12.6 13.3 13.3.9.1 1.6-.6 1.6-1.5v-2.1c0-.7-.5-1.3-1.2-1.5l-2.1-.5c-.6-.1-1.2.1-1.6.5l-.9.9a13.7 13.7 0 0 1-4.8-4.8l.9-.9c.4-.4.6-1 .5-1.6l-.5-2.1c-.2-.7-.8-1.2-1.5-1.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
