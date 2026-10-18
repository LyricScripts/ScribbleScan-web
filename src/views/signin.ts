import { oidcConfig, saveTokens } from "../api/client";
import type { DevToken } from "../api/generated";
import { $, categoryColor, h, render } from "../dom";
import * as oidc from "../oidc";

const TAGLINE = "Snap your receipts. See where your money goes, every month.";

function strip(): HTMLElement {
  const parts: [string, number][] = [
    ["groceries", 5],
    ["food", 3],
    ["medicine", 2],
    ["transport", 2],
    ["utilities", 1.5],
    ["other", 1],
  ];
  return h(
    "div",
    { class: "demo-strip", "aria-hidden": "true" },
    parts.map(([c, flex]) => h("span", { style: { background: categoryColor(c), flex: String(flex) } })),
  );
}

export function showSignIn(onSignedIn: () => void, note = ""): void {
  $("#app").hidden = true;
  const box = $("#signin");
  box.hidden = false;
  const err = h("p", { role: "alert" }, note);
  const cfg = oidcConfig();

  if (cfg) {
    // Production: the buttons go to the sign-in server (Zitadel), which sends the browser back here.
    const go = (prompt?: string) =>
      oidc.login(cfg, { prompt }).catch(() => {
        err.textContent = "Couldn't reach the sign-in page. Check your connection and try again.";
      });
    render(
      box,
      h(
        "div",
        { class: "signin-box" },
        h("h1", {}, "ScribbleScan"),
        h("p", {}, TAGLINE),
        strip(),
        h("button", { class: "primary", type: "button", onclick: () => go() }, "Sign in"),
        h("button", { class: "secondary", type: "button", onclick: () => go("create") }, "Create an account"),
        err,
      ),
    );
    return;
  }

  // Development: sign in as any email (the API offers this only on a private address).
  const email = h("input", {
    type: "email",
    id: "email",
    required: true,
    autocomplete: "email",
    placeholder: "you@example.com",
  });
  render(
    box,
    h(
      "form",
      {
        onsubmit: async (e: Event) => {
          e.preventDefault();
          try {
            const r = await fetch("/v1/dev/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email.value.trim() }),
            });
            if (!r.ok) throw new Error();
            saveTokens({ access_token: ((await r.json()) as DevToken).access_token, expires_in: 12 * 3600 });
            onSignedIn();
          } catch {
            err.textContent = "Couldn't sign in. Check the address and try again.";
          }
        },
      },
      h("h1", {}, "ScribbleScan"),
      h("p", {}, TAGLINE),
      strip(),
      h("label", { for: "email" }, "Email"),
      email,
      h("button", { class: "primary", type: "submit" }, "Sign in"),
      err,
    ),
  );
  email.focus();
}
