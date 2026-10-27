import { afterEach, describe, expect, it, vi } from "vitest";
import { b64url, begin, finish, login, pkceChallenge } from "../src/oidc";

describe("PKCE", () => {
  it("matches the RFC 7636 example", async () => {
    // RFC 7636, Appendix B
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
  it("base64url has no padding or +/", () => {
    expect(b64url(new Uint8Array([251, 255, 191]))).toBe("-_-_");
  });
});

describe("finish", () => {
  const cfg = { issuer: "https://auth.example.com", client_id: "web", scopes: "openid" };
  afterEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/");
  });

  it("does nothing on a normal page load", async () => {
    expect(await finish(cfg)).toBeNull();
  });

  it("rejects a return whose state doesn't match (a forged or stale sign-in)", async () => {
    localStorage.setItem("ss.oidc.pending", JSON.stringify({ verifier: "v", state: "expected" }));
    history.replaceState(null, "", "/?code=abc&state=attacker");
    await expect(finish(cfg)).rejects.toThrow("sign-in expired");
    expect(location.search).toBe(""); // the code is removed from the address bar either way
  });

  it("swaps the code for tokens, sending the PKCE verifier", async () => {
    localStorage.setItem("ss.oidc.pending", JSON.stringify({ verifier: "the-verifier", state: "s1" }));
    history.replaceState(null, "", "/?code=abc&state=s1");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/.well-known/openid-configuration"))
        return Response.json({
          authorization_endpoint: "a",
          token_endpoint: "https://auth.example.com/token",
        });
      expect(String(init?.body)).toContain("code_verifier=the-verifier");
      return Response.json({ access_token: "at", expires_in: 300 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await finish(cfg)).toEqual({ access_token: "at", expires_in: 300 });
    vi.unstubAllGlobals();
  });
});

describe("begin", () => {
  afterEach(() => localStorage.clear());

  it("keeps the verifier and gives out only its challenge", async () => {
    const { code_challenge, state } = await begin();
    const pending = JSON.parse(localStorage.getItem("ss.oidc.pending") ?? "{}");
    expect(pending.state).toBe(state);
    expect(code_challenge).toBe(await pkceChallenge(pending.verifier));
    expect(code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("login", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("goes to the provider with a PKCE challenge", async () => {
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ authorization_endpoint: "https://auth.example.com/authorize" })),
    );
    const cfg = { issuer: "https://auth.example.com", client_id: "web", scopes: "openid" };

    await login(cfg);

    expect(assign).toHaveBeenCalledOnce();
    expect(assign.mock.calls[0][0]).toContain("code_challenge_method=S256");
    expect(assign.mock.calls[0][0]).not.toContain("login_hint");
  });
});
