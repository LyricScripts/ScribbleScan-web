"use client";

import { useEffect, useRef, useState } from "react";
import { RETRY_WAITS_MS } from "@/src/api/client";
import type { PairClaim, PairGrant } from "@/src/api/types";

type UploadStatus = { id: number; name: string; status: string; failed?: boolean };

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android phone" : "Phone";
  const browser = /CriOS|Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : /Firefox/.test(ua) ? "Firefox" : "browser";
  return `${browser} on ${os}`;
}

export default function ScanPage() {
  const [message, setMessage] = useState("Connecting…");
  const [grant, setGrant] = useState<PairGrant | null>(null);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    let events: EventSource | null = null;
    let cancelled = false;
    const connect = async () => {
      const secret = window.location.hash.slice(1);
      history.replaceState(null, "", location.pathname);
      if (!secret) {
        setMessage("Scan the QR code shown in ScribbleScan.");
        return;
      }
      try {
        const response = await fetch("/v1/pair/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret, device_label: deviceLabel() }),
        });
        if (!response.ok) {
          setMessage("This code is no longer valid. Show a new one and scan again.");
          return;
        }
        const claim = await response.json() as PairClaim;
        if (cancelled) return;
        setMessage(`Allow this phone on “${claim.shower || "your computer"}”…`);
        events = new EventSource(`/v1/pair/offers/${claim.offer_id}/events?key=${encodeURIComponent(claim.claimer_key)}`);
        events.addEventListener("approved", async () => {
          events?.close();
          const collected = await fetch(`/v1/pair/offers/${claim.offer_id}/collect`, {
            method: "POST",
            headers: { "X-Pairkit-Key": claim.claimer_key },
          });
          if (!collected.ok) {
            setMessage("Couldn't connect. Scan a new code.");
            return;
          }
          setGrant(await collected.json() as PairGrant);
          setMessage("Connected. Photos go straight to ScribbleScan.");
        });
        events.addEventListener("denied", () => { setMessage("Not allowed."); events?.close(); });
        events.addEventListener("expired", () => { setMessage("Timed out. Scan again."); events?.close(); });
      } catch {
        if (!cancelled) setMessage("Couldn't connect. Check your connection and scan a new code.");
      }
    };
    void connect();
    return () => { cancelled = true; events?.close(); };
  }, []);

  const sendFile = async (file: File, id: number) => {
    if (!grant) return;
    const key = crypto.randomUUID();
    let status = 0;
    for (const wait of RETRY_WAITS_MS) {
      if (wait) {
        setUploads((current) => current.map((item) => item.id === id ? { ...item, status: "Retrying…" } : item));
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      const body = new FormData();
      body.append("file", file);
      try {
        status = (await fetch(`/v1/spaces/${grant.space_id}/documents`, {
          method: "POST",
          body,
          headers: { Authorization: `Bearer ${grant.token}`, "Idempotency-Key": key },
        })).status;
      } catch {
        status = 0;
        continue;
      }
      if (status < 500) break;
    }
    const ok = status >= 200 && status < 300;
    setUploads((current) => current.map((item) => item.id === id ? { ...item, status: ok ? "Sent" : status === 401 ? "Disconnected" : "Failed", failed: !ok } : item));
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of [...files]) {
      const id = ++nextId.current;
      setUploads((current) => [{ id, name: `Photo ${id}`, status: "Sending…" }, ...current]);
      void sendFile(file, id);
    }
    if (input.current) input.current.value = "";
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8 text-center">
      <h1 className="text-xl font-bold text-ink">ScribbleScan camera</h1>
      <p aria-live="polite" className="mt-2 min-h-7 text-quiet">{message}</p>
      {grant ? (
        <>
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(event) => onFiles(event.currentTarget.files)} />
          <button type="button" onClick={() => input.current?.click()} className="mt-7 w-full rounded-2xl bg-ledger-button px-5 py-8 text-xl font-semibold text-white hover:bg-[#0a5948]">Take photo</button>
          <ul className="mt-5 space-y-2 text-left">
            {uploads.map((upload) => <li key={upload.id} className="flex justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-sm"><span>{upload.name}</span><span className={upload.failed ? "text-stamp" : "text-ledger"}>{upload.status}</span></li>)}
          </ul>
        </>
      ) : null}
    </main>
  );
}
