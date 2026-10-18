import { afterEach, describe, expect, it, vi } from "vitest";
import { errorText, session, uploadFile } from "../src/api/client";

const file = new File(["receipt"], "r.png", { type: "image/png" });
const NO_WAIT = [0, 0, 0, 0, 0];

afterEach(() => vi.unstubAllGlobals());

describe("uploadFile", () => {
  it("retries network errors and 5xx with the same Idempotency-Key, then succeeds", async () => {
    session.token = "t";
    const keys: string[] = [];
    const replies = [
      () => Promise.reject(new TypeError("offline")),
      () => new Response(null, { status: 503 }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        keys.push((init.headers as Record<string, string>)["Idempotency-Key"] ?? "");
        const next = replies.shift();
        return next ? next() : Response.json({ id: "d1" }, { status: 202 });
      }),
    );
    expect((await uploadFile("s1", file, NO_WAIT)).id).toBe("d1");
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
  });

  it("does not retry a request the API refused (4xx)", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ detail: "upload a JPEG, PNG, WebP, HEIC image or a PDF" }, { status: 415 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadFile("s1", file, NO_WAIT)).rejects.toThrow("upload a JPEG");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last try", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(uploadFile("s1", file, NO_WAIT)).rejects.toThrow("Couldn't upload");
  });
});

describe("errorText", () => {
  it("uses the API's message, or a plain fallback", async () => {
    expect(await errorText(Response.json({ detail: "no such space" }, { status: 404 }))).toBe(
      "no such space",
    );
    expect(await errorText(new Response("<html>", { status: 502 }))).toBe("Something went wrong (502)");
  });
});
