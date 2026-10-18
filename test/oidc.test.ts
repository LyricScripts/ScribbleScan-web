import { afterEach, describe, expect, it, vi } from "vitest";
import { b64url, finish, pkceChallenge } from "../src/oidc";

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
    sessionStorage.clear();
    history.replaceState(null, "", "/");
  });

  it("does nothing on a normal page load", async () => {
    expect(await finish(cfg)).toBeNull();
  });

  it("rejects a return whose state doesn't match (a forged or stale sign-in)", async () => {
    sessionStorage.setItem("ss.oidc.pending", JSON.stringify({ verifier: "v", state: "expected" }));
    history.replaceState(null, "", "/?code=abc&state=attacker");
    await expect(finish(cfg)).rejects.toThrow("sign-in expired");
    expect(location.search).toBe(""); // the code is removed from the address bar either way
  });

  it("swaps the code for tokens, sending the PKCE verifier", async () => {
    sessionStorage.setItem("ss.oidc.pending", JSON.stringify({ verifier: "the-verifier", state: "s1" }));
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
