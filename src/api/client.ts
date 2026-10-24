// Talking to the /v1 API: bearer tokens, silent renewal, error messages, and uploads
// that survive a flaky connection.

import * as oidc from "../oidc";
import { store } from "../store";
import type { ClientConfig, DocumentOut } from "./types";

export class SignedOut extends Error {
  constructor() {
    super("signed out");
  }
}

interface Session {
  config: ClientConfig | null;
  token: string | null;
  /** Called when the API rejects the session for good, so the app can show sign-in. */
  onSignedOut: (note: string) => void;
}

export const session: Session = { config: null, token: store.get("ss.token"), onSignedOut: () => {} };

export const DEMO_ACCOUNT_EMAIL = "test@email.com";
const DEMO_SESSION_KEY = "ss.preview-email";
const TOKEN_KEYS = ["ss.token", "ss.refresh", "ss.expires", "ss.idtoken"];

export function isDemoSession(): boolean {
  return store.get(DEMO_SESSION_KEY) === DEMO_ACCOUNT_EMAIL;
}

export function startDemoSession(email: string): boolean {
  if (email.trim().toLowerCase() !== DEMO_ACCOUNT_EMAIL) return false;
  clearTokens();
  store.set(DEMO_SESSION_KEY, DEMO_ACCOUNT_EMAIL);
  return true;
}

export function oidcConfig(): oidc.OidcConfig | null {
  const c = session.config;
  return c?.auth === "oidc" && c.issuer && c.client_id
    ? { issuer: c.issuer, client_id: c.client_id, scopes: c.scopes ?? "openid" }
    : null;
}

// Access tokens are short-lived; the refresh token renews them.
export function saveTokens(t: oidc.Tokens): void {
  session.token = t.access_token;
  store.set("ss.token", t.access_token);
  store.set("ss.expires", String(Date.now() + (t.expires_in ?? 3600) * 1000));
  if (t.refresh_token) store.set("ss.refresh", t.refresh_token);
  if (t.id_token) store.set("ss.idtoken", t.id_token);
}

export function clearTokens(): void {
  session.token = null;
  for (const k of TOKEN_KEYS) store.set(k, null);
  store.set(DEMO_SESSION_KEY, null);
}

let refreshing: Promise<boolean> | null = null;
async function renew({ force = false } = {}): Promise<boolean> {
  const cfg = oidcConfig();
  const rt = store.get("ss.refresh");
  if (!cfg || !rt) return false;
  if (!force && Number(store.get("ss.expires") ?? 0) - Date.now() > 60_000) return true;
  refreshing ??= oidc
    .refresh(cfg, rt)
    .then(
      (t) => {
        saveTokens(t);
        return true;
      },
      () => false,
    )
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
}

/** The raw response; 401 is handled (one renewal attempt, then sign-out). */
export async function request(path: string, opts: RequestOptions = {}, retried = false): Promise<Response> {
  await renew();
  const headers: Record<string, string> = { ...opts.headers };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(path, { method: opts.method ?? "GET", headers, body });
  if (r.status === 401 && session.token) {
    if (!retried && (await renew({ force: true }))) return request(path, opts, true);
    clearTokens();
    session.onSignedOut("You were signed out. Sign in again.");
    throw new SignedOut();
  }
  return r;
}

/** JSON from the API, or an Error carrying its message. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const r = await request(path, opts);
  if (!r.ok) throw new Error(await errorText(r));
  return (r.status === 204 ? null : await r.json()) as T;
}

export async function errorText(r: Response): Promise<string> {
  const fallback = `Something went wrong (${r.status})`;
  try {
    const j = (await r.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    const message = (j.detail as { message?: unknown } | undefined)?.message;
    return typeof message === "string" ? message : fallback;
  } catch {
    return fallback;
  }
}

export const RETRY_WAITS_MS = [0, 2000, 5000, 10000, 20000];
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Upload a photo or PDF. Retries for about half a minute on a dropped connection or a
 * server error, always with the same Idempotency-Key, so a flaky network never loses a
 * photo or stores it twice.
 */
export async function uploadFile(spaceId: string, file: File, waits = RETRY_WAITS_MS): Promise<DocumentOut> {
  const key = crypto.randomUUID();
  for (const wait of waits) {
    if (wait) await sleep(wait);
    const form = new FormData();
    form.append("file", file);
    let r: Response;
    try {
      r = await request(`/v1/spaces/${spaceId}/documents`, {
        method: "POST",
        form,
        headers: { "Idempotency-Key": key },
      });
    } catch (e) {
      if (e instanceof SignedOut) throw e;
      continue; // network error: try again
    }
    if (r.ok) return (await r.json()) as DocumentOut;
    if (r.status < 500) throw new Error(await errorText(r));
  }
  throw new Error("Couldn't upload. Check your connection and try again.");
}
