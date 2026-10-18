// The page a phone opens after scanning a pairing QR code. The pairing secret arrives in
// the URL fragment (never sent to any server log); the phone trades it for an upload-only
// token once the computer's user approves, then sends photos straight to that space.

import "./styles/scan.css";
import { RETRY_WAITS_MS } from "./api/client";
import type { PairClaim, PairGrant } from "./api/types";
import { $ } from "./dom";

const msg = $("#msg");
const snap = $("#snap");
const cam = $<HTMLInputElement>("#cam");
const sent = $("#sent");
let grant: PairGrant | null = null;

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android phone" : "Phone";
  const br = /CriOS|Chrome/.test(ua)
    ? "Chrome"
    : /Safari/.test(ua)
      ? "Safari"
      : /Firefox/.test(ua)
        ? "Firefox"
        : "browser";
  return `${br} on ${os}`;
}

async function connect(): Promise<void> {
  const secret = location.hash.slice(1);
  history.replaceState(null, "", location.pathname); // keep the secret out of history
  if (!secret) {
    msg.textContent = "Scan the QR code shown in ScribbleScan.";
    return;
  }
  const r = await fetch("/v1/pair/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, device_label: deviceLabel() }),
  });
  if (!r.ok) {
    msg.textContent = "This code is no longer valid. Show a new one and scan again.";
    return;
  }
  const claim = (await r.json()) as PairClaim;
  msg.textContent = `Allow this phone on "${claim.shower || "your computer"}"…`;
  const events = new EventSource(
    `/v1/pair/offers/${claim.offer_id}/events?key=${encodeURIComponent(claim.claimer_key)}`,
  );
  events.addEventListener("approved", async () => {
    events.close();
    const g = await fetch(`/v1/pair/offers/${claim.offer_id}/collect`, {
      method: "POST",
      headers: { "X-Pairkit-Key": claim.claimer_key },
    });
    if (!g.ok) {
      msg.textContent = "Couldn't connect. Scan a new code.";
      return;
    }
    grant = (await g.json()) as PairGrant;
    msg.textContent = "Connected. Photos go straight to ScribbleScan.";
    snap.hidden = false;
  });
  events.addEventListener("denied", () => {
    msg.textContent = "Not allowed.";
    events.close();
  });
  events.addEventListener("expired", () => {
    msg.textContent = "Timed out. Scan again.";
    events.close();
  });
}

/** Same retry rule as the web app: the same Idempotency-Key on every try, so no duplicates. */
async function send(file: File, status: HTMLElement): Promise<void> {
  if (!grant) return;
  const key = crypto.randomUUID();
  let code = 0;
  for (const wait of RETRY_WAITS_MS) {
    if (wait) {
      status.textContent = "Retrying…";
      await new Promise((ok) => setTimeout(ok, wait));
    }
    const body = new FormData();
    body.append("file", file);
    try {
      code = (
        await fetch(`/v1/spaces/${grant.space_id}/documents`, {
          method: "POST",
          body,
          headers: { Authorization: `Bearer ${grant.token}`, "Idempotency-Key": key },
        })
      ).status;
    } catch {
      code = 0;
      continue;
    }
    if (code < 500) break;
  }
  const ok = code >= 200 && code < 300;
  status.textContent = ok ? "Sent ✓" : code === 401 ? "Disconnected" : "Failed";
  if (!ok) status.className = "bad";
}

cam.addEventListener("change", () => {
  const file = cam.files?.[0];
  if (!file) return;
  const status = document.createElement("span");
  status.textContent = "Sending…";
  const name = document.createElement("span");
  name.textContent = `Photo ${sent.children.length + 1}`;
  const li = document.createElement("li");
  li.append(name, status);
  sent.prepend(li);
  cam.value = "";
  void send(file, status);
});

void connect();
