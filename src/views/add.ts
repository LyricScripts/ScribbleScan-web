import { api, request, uploadFile } from "../api/client";
import type { DocumentOut, Expenses, PairOffer } from "../api/types";
import { h, render, toast } from "../dom";
import { money, thisMonth } from "../format";
import { currentSpace } from "../state";
import { STATUS_LABEL, view } from "./shared";

/** Stops the pairing event stream and polling when the user leaves the Add page. */
let cleanup: (() => void) | null = null;
export const leaveAdd = () => cleanup?.();

export function addView(): void {
  const space = currentSpace();
  const list = h("ul", { class: "uploads" });
  const input = h("input", {
    type: "file",
    accept: "image/*,application/pdf",
    multiple: true,
    hidden: true,
    id: "files",
  });
  const drop = h(
    "label",
    { class: "drop", for: "files" },
    h("strong", {}, "Choose photos or PDFs"),
    h(
      "span",
      { class: "quiet" },
      "On a phone this opens your camera. On a computer you can also drop files here.",
    ),
    input,
  );

  const send = async (files: File[]) => {
    for (const f of files) {
      const status = h("span", { class: "status processing" }, "Uploading…");
      const li = h("li", {}, h("span", {}, f.name), status);
      list.prepend(li);
      try {
        watchDoc((await uploadFile(space.id, f)).id, li);
      } catch (e) {
        status.textContent = (e as Error).message;
        status.className = "status failed";
      }
    }
  };
  input.addEventListener("change", () => {
    void send([...(input.files ?? [])]);
    input.value = "";
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    void send([...(e.dataTransfer?.files ?? [])]);
  });

  const pairBox: HTMLElement = h("div");
  pairBox.append(
    h(
      "p",
      { class: "quiet" },
      "Scan a code with your phone and every photo you take goes straight here. Nothing to install.",
    ),
    h(
      "button",
      { class: "secondary", type: "button", onclick: () => pair(pairBox, list) },
      "Show a code to scan",
    ),
  );

  render(
    view(),
    h("h1", {}, `Add to ${space.name}`),
    drop,
    h("h2", {}, "Use your phone as the camera"),
    pairBox,
    list,
  );
}

/** Shows a document's progress until it has been read. */
function watchDoc(id: string, li: HTMLElement): void {
  const currency = currentSpace().currency;
  let tries = 0;
  const tick = async () => {
    const d = await api<DocumentOut>(`/v1/documents/${id}`).catch(() => null);
    if (!d) return;
    const label = STATUS_LABEL[d.status] ?? d.status;
    render(
      li,
      h("a", { href: `#/doc/${id}` }, d.merchant ?? d.filename),
      h(
        "span",
        { class: `status ${d.status}` },
        d.total != null ? `${money(d.total, currency)} · ${label}` : label,
      ),
    );
    if (d.status === "processing" && tries++ < 30) setTimeout(tick, 1500);
  };
  void tick();
}

async function pair(box: HTMLElement, list: HTMLElement): Promise<void> {
  cleanup?.();
  const space = currentSpace();
  let offer: PairOffer;
  try {
    offer = await api<PairOffer>(`/v1/spaces/${space.id}/pair`, {
      method: "POST",
      headers: { "X-Device-Label": browserLabel() },
    });
  } catch (e) {
    toast((e as Error).message);
    return;
  }
  // The QR image comes from our own server, made from our own URL; the secret never lands in a URL.
  const svg = await (await request("/v1/qr", { method: "POST", body: { data: offer.qr_url } })).text();
  const qr = h("div", { class: "qr", role: "img", "aria-label": "Pairing code" });
  qr.innerHTML = svg;
  const msg = h("p", {}, "Point your phone's camera at the code. It expires in 2 minutes.");
  const actions = h("div", { class: "actions" });
  render(box, h("div", { class: "pair" }, qr, h("div", {}, msg, actions)));

  const seen = new Set<string>();
  let poll: ReturnType<typeof setInterval> | undefined;
  const events = new EventSource(
    `/v1/pair/offers/${offer.offer_id}/events?key=${encodeURIComponent(offer.shower_key)}`,
  );
  cleanup = () => {
    events.close();
    clearInterval(poll);
    cleanup = null;
  };
  const decide = (what: "approve" | "deny") => () =>
    api(`/v1/pair/offers/${offer.offer_id}/${what}`, { method: "POST" }).catch((x: Error) =>
      toast(x.message),
    );

  events.addEventListener("claimed", (e) => {
    const who = (JSON.parse((e as MessageEvent<string>).data) as { scanner?: string }).scanner || "A phone";
    msg.textContent = `${who} wants to add receipts to ${space.name}.`;
    render(
      actions,
      h("button", { class: "primary", type: "button", onclick: decide("approve") }, "Allow"),
      h("button", { class: "secondary", type: "button", onclick: decide("deny") }, "Don't allow"),
    );
  });
  events.addEventListener("collected", async () => {
    events.close();
    qr.remove();
    msg.textContent = "Phone connected. Photos you take appear below.";
    render(actions);
    const month = () => `/v1/spaces/${space.id}/expenses?month=${thisMonth()}`;
    const first = await api<Expenses>(month()).catch(() => null);
    for (const d of first?.items ?? []) seen.add(d.id);
    poll = setInterval(async () => {
      const r = await api<Expenses>(month()).catch(() => null);
      for (const d of r?.items ?? []) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        const li = h("li");
        list.prepend(li);
        watchDoc(d.id, li);
        toast("New photo from your phone");
      }
    }, 3000);
  });
  events.addEventListener("denied", () => {
    events.close();
    msg.textContent = "Not allowed. Show a new code to try again.";
    render(actions);
  });
  events.addEventListener("expired", () => {
    events.close();
    qr.remove();
    msg.textContent = "The code expired.";
    render(
      actions,
      h("button", { class: "secondary", type: "button", onclick: () => pair(box, list) }, "Show a new code"),
    );
  });
}

function browserLabel(): string {
  const ua = navigator.userAgent;
  const br = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS/.test(ua)
      ? "Mac"
      : /Android/.test(ua)
        ? "Android"
        : /Linux/.test(ua)
          ? "Linux"
          : "computer";
  return `${br} on ${os}`;
}
