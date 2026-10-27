"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  DEMO_ACCOUNT_EMAIL,
  isDemoSession,
  oidcConfig,
  saveTokens,
  session,
  startDemoSession,
} from "@/src/api/client";
import type { DevToken, EmailCodeSent, Redirect } from "@/src/api/generated";
import type { ClientConfig } from "@/src/api/types";
import * as oidc from "@/src/oidc";
import { store } from "@/src/store";

// Passwordless sign-in: a code by email, Google, or Apple. The API runs the sign-in with
// Zitadel and answers with the usual ?code= redirect, which oidc.finish() completes here.
// Without a login client on the server it falls back to Zitadel's hosted pages; in dev
// mode the email step signs in directly.

type Provider = "google" | "apple";
type Step =
  | { name: "choose" }
  | { name: "email" }
  | { name: "code"; flow: string; email: string; resendAt: number }
  | { name: "busy"; note: string };

const RETURN_TO = "ss.returnTo";
const PROVIDER_NAMES: Record<Provider, string> = { google: "Google", apple: "Apple" };

export default function ConnectPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [step, setStep] = useState<Step>({ name: "busy", note: "Checking the connection…" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const heading = useRef<HTMLHeadingElement>(null);

  const destination = useCallback(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo") ?? store.get(RETURN_TO);
    store.set(RETURN_TO, null);
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  }, []);

  useEffect(() => {
    const go = (url: string) => {
      setStep({ name: "busy", note: "Signing you in…" });
      window.location.assign(url);
    };
    const failed = (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Couldn't sign in. Try again.");
      setStep({ name: "choose" });
    };
    void api<ClientConfig>("/v1/config")
      .then(async (clientConfig) => {
        session.config = clientConfig;
        setConfig(clientConfig);
        const q = new URLSearchParams(window.location.search);
        const flow = q.get("flow");
        if (flow) {
          // The link in a sign-in email, or the way back from Google or Apple.
          history.replaceState(null, "", window.location.pathname);
          if (q.get("code")) {
            setStep({ name: "busy", note: "Checking your code…" });
            const next = await api<Redirect>("/v1/auth/email/verify", {
              method: "POST",
              body: { flow, code: q.get("code") },
            });
            return go(next.url);
          }
          if (q.get("id") && q.get("token")) {
            setStep({ name: "busy", note: "Signing you in…" });
            const next = await api<Redirect>("/v1/auth/provider/finish", {
              method: "POST",
              body: { flow, intent_id: q.get("id"), intent_token: q.get("token") },
            });
            return go(next.url);
          }
          throw new Error("Sign-in was cancelled. Try again.");
        }
        const oidcSettings = oidcConfig();
        if (oidcSettings) {
          const tokens = await oidc.finish(oidcSettings);
          if (tokens) saveTokens(tokens);
        }
        if (session.token || isDemoSession()) return window.location.assign(destination());
        setStep({ name: "choose" });
      })
      .catch((cause) => {
        if (session.config) return failed(cause);
        setError(`Couldn't reach the API. You can still preview the app with ${DEMO_ACCOUNT_EMAIL}.`);
        setStep({ name: "choose" });
      });
  }, [destination]);

  // Move focus to each step's heading, so keyboard and screen reader users follow along.
  useEffect(() => {
    if (step.name !== "busy") heading.current?.focus();
  }, [step.name]);

  useEffect(() => {
    if (step.name !== "code") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step.name]);

  const methods = config?.login_methods ?? [];
  const passwordless = config?.auth === "oidc" && methods.length > 0;
  const hosted = config?.auth === "oidc" && methods.length === 0;
  const available = (provider: Provider) => passwordless && methods.includes(provider);
  // Dev mode, the hosted fallback and an offline API each handle the email step their own way.
  const emailAvailable = !passwordless || methods.includes("email");

  const leaving = () => store.set(RETURN_TO, destination());

  const goHosted = () => {
    const settings = oidcConfig();
    if (!settings) return;
    leaving();
    setStep({ name: "busy", note: "Taking you to sign in…" });
    void oidc.login(settings).catch(() => {
      setError("Couldn't reach the sign-in page. Try again.");
      setStep({ name: "choose" });
    });
  };

  const chooseProvider = async (provider: Provider) => {
    setError("");
    if (hosted) return goHosted();
    if (!available(provider)) {
      const instead = emailAvailable ? " Continue with email." : "";
      setError(`${PROVIDER_NAMES[provider]} sign-in isn't set up on this server yet.${instead}`);
      return;
    }
    try {
      setStep({ name: "busy", note: `Opening ${PROVIDER_NAMES[provider]}…` });
      leaving();
      const next = await api<Redirect>("/v1/auth/provider", {
        method: "POST",
        body: { provider, ...(await oidc.begin()) },
      });
      window.location.assign(next.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't start the sign-in. Try again.");
      setStep({ name: "choose" });
    }
  };

  const chooseEmail = () => {
    setError("");
    if (hosted) return goHosted();
    if (!emailAvailable) {
      setError("Email sign-in isn't set up on this server yet.");
      return;
    }
    setStep({ name: "email" });
  };

  const sendCode = async (address: string) => {
    setError("");
    if (startDemoSession(address)) {
      window.location.assign(destination());
      return;
    }
    if (config === null) {
      setError(`Live sign-in needs the API. Use ${DEMO_ACCOUNT_EMAIL} to preview the app.`);
      return;
    }
    try {
      if (config.auth === "dev") {
        const token = await api<DevToken>("/v1/dev/token", {
          method: "POST",
          body: { email: address.trim() },
        });
        saveTokens({ access_token: token.access_token, expires_in: 12 * 3600 });
        window.location.assign(destination());
        return;
      }
      leaving();
      const sent = await api<EmailCodeSent>("/v1/auth/email", {
        method: "POST",
        body: { email: address, ...(await oidc.begin()) },
      });
      setCode("");
      setStep({
        name: "code",
        flow: sent.flow,
        email: sent.email,
        resendAt: Date.now() + sent.resend_after * 1000,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't send a code. Try again.");
    }
  };

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendCode(email);
  };

  const submitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.name !== "code") return;
    setError("");
    const current = step;
    try {
      setStep({ name: "busy", note: "Checking your code…" });
      const next = await api<Redirect>("/v1/auth/email/verify", {
        method: "POST",
        body: { flow: current.flow, code: code.trim() },
      });
      window.location.assign(next.url);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't check the code. Try again.";
      setError(message.charAt(0).toUpperCase() + message.slice(1));
      setStep(/start again/.test(message) ? { name: "email" } : current);
    }
  };

  const resendIn = step.name === "code" ? Math.max(0, Math.ceil((step.resendAt - now) / 1000)) : 0;

  return (
    <main className="flex min-h-screen flex-col px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-tile)] text-base font-bold text-[var(--brand-ink)]">
          S
        </span>
        <span className="text-base font-semibold tracking-tight text-ink">ScribbleScan</span>
      </header>

      <section className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-12">
        {step.name === "busy" ? (
          <p role="status" className="text-center text-base text-quiet">
            {step.note}
          </p>
        ) : null}

        {step.name === "choose" ? (
          <>
            <Title headingRef={heading} title="Log in or sign up">
              Keep your receipts, budgets and spaces in one clear view.
            </Title>
            <div className="mt-8 space-y-3">
              <ChoiceButton onClick={chooseEmail} icon={<MailMark />} unavailable={!emailAvailable}>
                Continue with email
              </ChoiceButton>
              <ChoiceButton
                onClick={() => void chooseProvider("google")}
                icon={<GoogleMark />}
                unavailable={!hosted && !available("google")}
              >
                Continue with Google
              </ChoiceButton>
              <ChoiceButton
                onClick={() => void chooseProvider("apple")}
                icon={<AppleMark />}
                unavailable={!hosted && !available("apple")}
              >
                Continue with Apple
              </ChoiceButton>
            </div>
          </>
        ) : null}

        {step.name === "email" ? (
          <>
            <Title headingRef={heading} title="Continue with email">
              We'll send you a code to sign in. No password needed.
            </Title>
            <form onSubmit={submitEmail} className="mt-8 space-y-3">
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
                className={FIELD}
              />
              <button type="submit" className={PRIMARY}>
                Continue
              </button>
              <button type="button" onClick={() => setStep({ name: "choose" })} className={LINK}>
                Back
              </button>
            </form>
            {config?.auth === "dev" ? (
              <p className="mt-4 text-center text-xs leading-5 text-quiet">
                Development sign-in: any email signs in at once, no code. For the sample account, use{" "}
                {DEMO_ACCOUNT_EMAIL}.
              </p>
            ) : null}
          </>
        ) : null}

        {step.name === "code" ? (
          <>
            <Title headingRef={heading} title="Check your inbox">
              Enter the code we sent to <span className="font-medium text-ink">{step.email}</span>, or open
              the link in that email.
            </Title>
            <form onSubmit={(event) => void submitCode(event)} className="mt-8 space-y-3">
              <label htmlFor="code" className="sr-only">
                Code
              </label>
              <input
                id="code"
                required
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                minLength={4}
                maxLength={12}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Code"
                className={`${FIELD} text-center font-semibold tracking-[0.3em] placeholder:font-normal placeholder:tracking-normal`}
              />
              <button type="submit" className={PRIMARY}>
                Continue
              </button>
            </form>
            <div className="mt-4 flex flex-col items-center gap-1 text-sm">
              <button
                type="button"
                disabled={resendIn > 0}
                onClick={() => void sendCode(step.email)}
                className="rounded-full px-3 py-1.5 font-medium text-ledger transition hover:underline disabled:cursor-default disabled:text-quiet disabled:no-underline"
              >
                {resendIn > 0 ? `Resend email in ${resendIn}s` : "Resend email"}
              </button>
              <button type="button" onClick={() => setStep({ name: "email" })} className={LINK}>
                Use a different email
              </button>
            </div>
          </>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-amber/20 bg-amber-soft px-4 py-3 text-left text-sm text-amber"
          >
            {error}
          </p>
        ) : null}

        {step.name === "choose" ? (
          <p className="mt-8 text-center text-sm text-quiet">
            Just looking?{" "}
            <button
              type="button"
              onClick={() => {
                startDemoSession(DEMO_ACCOUNT_EMAIL);
                window.location.assign(destination());
              }}
              className="rounded font-medium text-ink underline-offset-4 hover:underline"
            >
              Preview the sample account
            </button>
          </p>
        ) : null}
      </section>
    </main>
  );
}

const FIELD =
  "w-full rounded-full border border-line bg-transparent px-5 py-3.5 text-base text-ink outline-none transition placeholder:text-quiet focus:border-ledger";
const PRIMARY =
  "w-full rounded-full bg-[var(--brand-tile)] px-5 py-3.5 text-base font-semibold text-[var(--brand-ink)] transition hover:opacity-90";
const LINK = "w-full rounded-full px-5 py-2 text-sm font-medium text-quiet transition hover:text-ink";

function Title({
  title,
  children,
  headingRef,
}: {
  title: string;
  children: ReactNode;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="text-center">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-semibold tracking-tight text-ink outline-none"
      >
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-quiet">{children}</p>
    </div>
  );
}

function ChoiceButton({
  onClick,
  icon,
  unavailable = false,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  unavailable?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={unavailable || undefined}
      className={`flex w-full items-center justify-center gap-3 rounded-full border border-line bg-transparent px-5 py-3.5 text-base font-medium text-ink transition hover:bg-raised ${unavailable ? "opacity-50" : ""}`}
    >
      {icon}
      {children}
    </button>
  );
}

function MailMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-quiet">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m3 5.5 7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
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

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" fill="currentColor" className="h-[18px] w-[18px] text-quiet">
      <path d="M14.94 9.56c-.02-2.02 1.65-3 1.73-3.04-.94-1.38-2.41-1.57-2.93-1.59-1.25-.13-2.44.73-3.07.73-.64 0-1.61-.71-2.65-.69-1.36.02-2.62.79-3.32 2.01-1.42 2.46-.36 6.1 1.02 8.1.68.98 1.48 2.07 2.53 2.04 1.02-.04 1.4-.66 2.63-.66 1.22 0 1.57.66 2.64.64 1.09-.02 1.78-.99 2.45-1.98.77-1.13 1.09-2.23 1.11-2.29-.03-.01-2.12-.81-2.14-3.23ZM12.92 3.62c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.56-.85 2.48.9.07 1.82-.46 2.39-1.14Z" />
    </svg>
  );
}
