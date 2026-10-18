// ScribbleScan web app: a hash router over a handful of views, talking only to /v1.

import "@fontsource/hind-siliguri/400.css";
import "@fontsource/hind-siliguri/500.css";
import "@fontsource/hind-siliguri/600.css";
import "@fontsource/hind-siliguri/700.css";
import "./styles/app.css";
import { api, clearTokens, oidcConfig, SignedOut, saveTokens, session } from "./api/client";
import type { ClientConfig, SpaceOut } from "./api/types";
import { $, h, render } from "./dom";
import * as oidc from "./oidc";
import { state } from "./state";
import { store } from "./store";
import { addView, leaveAdd } from "./views/add";
import { budgetsView } from "./views/budgets";
import { homeView } from "./views/home";
import { receiptsView } from "./views/receipts";
import { docView } from "./views/review";
import { view } from "./views/shared";
import { showSignIn } from "./views/signin";
import { newSpaceView } from "./views/spaces";

type Route = [RegExp, string | null, (match: RegExpMatchArray, query: URLSearchParams) => unknown];

const routes: Route[] = [
  [/^#\/home$/, "home", () => homeView(route)],
  [/^#\/receipts$/, "receipts", (_, q) => receiptsView(q, route)],
  [/^#\/doc\/([\w-]+)$/, "receipts", (m) => docView(m[1] ?? "")],
  [/^#\/add$/, "add", () => addView()],
  [/^#\/budgets$/, "budgets", () => budgetsView()],
  [/^#\/spaces\/new$/, null, () => newSpaceView(loadSpaces)],
];

async function route(): Promise<void> {
  const [path = "#/home", query = ""] = (location.hash || "#/home").split("?");
  if (path !== "#/add") leaveAdd();
  const hit = routes.find(([re]) => re.test(path));
  if (!hit) {
    location.hash = "#/home";
    return;
  }
  const [re, tab, show] = hit;
  for (const a of document.querySelectorAll<HTMLElement>(".rail a[data-tab]")) {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  try {
    await show(path.match(re) as RegExpMatchArray, new URLSearchParams(query));
    view().focus({ preventScroll: true });
  } catch (e) {
    if (e instanceof SignedOut) return;
    render(
      view(),
      h(
        "div",
        { class: "empty" },
        h("p", {}, (e as Error).message),
        h("button", { class: "secondary", type: "button", onclick: route }, "Try again"),
      ),
    );
  }
}

async function loadSpaces(selectId?: string): Promise<void> {
  state.spaces = await api<SpaceOut[]>("/v1/spaces");
  const want = selectId ?? store.get("ss.space");
  const space = state.spaces.find((s) => s.id === want) ?? state.spaces[0] ?? null;
  state.space = space;
  if (!space) throw new Error("no spaces");
  store.set("ss.space", space.id);
  const select = $<HTMLSelectElement>("#space");
  render(
    select,
    state.spaces.map((s) =>
      h("option", { value: s.id }, s.kind === "business" ? `${s.name} · business` : s.name),
    ),
    h("option", { value: "__new" }, "New space…"),
  );
  select.value = space.id;
}

async function signOut(): Promise<void> {
  const idToken = store.get("ss.idtoken");
  clearTokens();
  const cfg = oidcConfig();
  if (cfg) {
    // End the sign-in server's session too, or "Sign in" would let the same person straight back in.
    const url = await oidc.logoutUrl(cfg, idToken).catch(() => null);
    if (url) {
      location.assign(url);
      return;
    }
  }
  showSignIn(start);
}

async function start(): Promise<void> {
  if (!session.config) {
    try {
      session.config = await api<ClientConfig>("/v1/config");
    } catch {
      showSignIn(start, "Couldn't reach the server. Check your connection and reload.");
      return;
    }
  }
  const cfg = oidcConfig();
  if (cfg) {
    try {
      const tokens = await oidc.finish(cfg);
      if (tokens) saveTokens(tokens);
    } catch (e) {
      showSignIn(start, `Couldn't sign in: ${(e as Error).message}`);
      return;
    }
  }
  if (!session.token) {
    showSignIn(start);
    return;
  }
  try {
    await loadSpaces();
  } catch (e) {
    if (!(e instanceof SignedOut))
      showSignIn(start, "Couldn't reach the server. Check that it's running, then sign in again.");
    return;
  }
  $("#signin").hidden = true;
  $("#app").hidden = false;
  if (!location.hash) location.hash = "#/home";
  else void route();
}

session.onSignedOut = (note) => showSignIn(start, note);

$<HTMLSelectElement>("#space").addEventListener("change", (e) => {
  const select = e.target as HTMLSelectElement;
  if (select.value === "__new") {
    select.value = state.space?.id ?? "";
    location.hash = "#/spaces/new";
    return;
  }
  state.space = state.spaces.find((s) => s.id === select.value) ?? state.space;
  if (state.space) store.set("ss.space", state.space.id);
  void route();
});
$("#signout").addEventListener("click", () => void signOut());
window.addEventListener("hashchange", () => void route());
void start();
