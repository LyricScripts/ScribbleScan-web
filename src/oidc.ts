// Sign-in with an OIDC provider (Zitadel in production): Authorization Code flow with
// PKCE, so the browser needs no client secret. The provider redirects back to this page
// with ?code=...; finish() swaps it for tokens.
//
// The sign-in page can also run the sign-in itself (email code, Google, Apple): begin()
// gives the API the PKCE challenge, and the API hands back the same ?code= redirect.

import { store } from "./store";

export interface OidcConfig {
  issuer: string;
  client_id: string;
  scopes: string;
}

export interface Tokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

const PENDING = "ss.oidc.pending";

export const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomString = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const redirectUri = () => `${location.origin}/`;

/** RFC 7636 S256: base64url(sha256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

const discovered = new Map<string, Promise<Discovery>>();
function discover(issuer: string): Promise<Discovery> {
  let d = discovered.get(issuer);
  if (!d) {
    d = fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`).then((r) => {
      if (!r.ok) throw new Error("sign-in server unreachable");
      return r.json() as Promise<Discovery>;
    });
    d.catch(() => discovered.delete(issuer)); // try again next time
    discovered.set(issuer, d);
  }
  return d;
}

async function tokenRequest(cfg: OidcConfig, params: Record<string, string>): Promise<Tokens> {
  const { token_endpoint } = await discover(cfg.issuer);
  const r = await fetch(token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.client_id, ...params }),
  });
  if (!r.ok) throw new Error("sign-in failed");
  return r.json() as Promise<Tokens>;
}

export interface Pkce {
  code_challenge: string;
  state: string;
}

/**
 * Start a sign-in: a new verifier and state, kept until the browser comes back. Kept in
 * localStorage, not sessionStorage, so the link in a sign-in email works in a new tab.
 */
export async function begin(): Promise<Pkce> {
  const verifier = randomString(32);
  const state = randomString(16);
  store.set(PENDING, JSON.stringify({ verifier, state }));
  return { code_challenge: await pkceChallenge(verifier), state };
}

/** Go to the provider's sign-in page. `prompt: "create"` opens registration instead. */
export async function login(cfg: OidcConfig, { prompt }: { prompt?: string } = {}): Promise<void> {
  const { authorization_endpoint } = await discover(cfg.issuer);
  const { code_challenge, state } = await begin();
  const q = new URLSearchParams({
    response_type: "code",
    client_id: cfg.client_id,
    redirect_uri: redirectUri(),
    scope: cfg.scopes,
    state,
    code_challenge,
    code_challenge_method: "S256",
  });
  if (prompt) q.set("prompt", prompt);
  location.assign(`${authorization_endpoint}?${q}`);
}

/** On return from the provider: tokens, or null when this page load isn't a sign-in return. */
export async function finish(cfg: OidcConfig): Promise<Tokens | null> {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return null;
  history.replaceState(null, "", location.pathname + location.hash); // keep the code out of history
  const pending = JSON.parse(store.get(PENDING) ?? "null") as {
    verifier: string;
    state: string;
  } | null;
  store.set(PENDING, null);
  if (q.has("error")) throw new Error(q.get("error_description") || "sign-in was cancelled");
  const code = q.get("code");
  if (!pending || !code || pending.state !== q.get("state")) throw new Error("sign-in expired; try again");
  return tokenRequest(cfg, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: pending.verifier,
  });
}

export const refresh = (cfg: OidcConfig, refreshToken: string) =>
  tokenRequest(cfg, { grant_type: "refresh_token", refresh_token: refreshToken });

/** Where to send the browser so the provider's session ends too. */
export async function logoutUrl(cfg: OidcConfig, idToken: string | null): Promise<string | null> {
  const { end_session_endpoint } = await discover(cfg.issuer);
  if (!end_session_endpoint) return null;
  const q = new URLSearchParams({ client_id: cfg.client_id, post_logout_redirect_uri: redirectUri() });
  if (idToken) q.set("id_token_hint", idToken);
  return `${end_session_endpoint}?${q}`;
}
