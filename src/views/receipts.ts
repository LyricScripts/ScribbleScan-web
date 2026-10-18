import { api } from "../api/client";
import type { DocumentOut, Expenses } from "../api/types";
import { h } from "../dom";
import { dayLabel, money, nice, title } from "../format";
import { currentSpace, state } from "../state";
import { monthNav, type Page, STATUS_LABEL } from "./shared";

export async function receiptsView(page: Page, params: URLSearchParams, refresh: () => void): Promise<void> {
  const space = currentSpace();
  const filter = params.get("category") ?? params.get("status") ?? "";
  const data = await api<Expenses>(`/v1/spaces/${space.id}/expenses?month=${state.month}`);
  const cats = [...new Set(data.items.map((d) => d.category).filter((c): c is string => !!c))];
  const hasReview = data.items.some((d) => d.status === "needs_review");
  const shown = data.items.filter((d) => !filter || d.category === filter || d.status === filter);

  const chip = (value: string, label: string) =>
    h(
      "button",
      {
        class: "chip",
        type: "button",
        "aria-pressed": String(filter === value),
        onclick: () => {
          location.hash = value
            ? `#/receipts?${value === "needs_review" ? "status" : "category"}=${value}`
            : "#/receipts";
        },
      },
      label,
    );

  const byDay = new Map<string, DocumentOut[]>();
  for (const d of shown) {
    const k = d.date ?? "";
    byDay.set(k, [...(byDay.get(k) ?? []), d]);
  }
  const list = shown.length
    ? [...byDay].map(([day, docs]) => [
        h("div", { class: "day" }, dayLabel(day)),
        docs.map((d) =>
          h(
            "a",
            { class: "receipt", href: `#/doc/${d.id}` },
            h("span", { class: "who" }, d.merchant ?? d.filename),
            h("span", { class: "amt num" }, money(d.total, space.currency)),
            h(
              "span",
              { class: "sub" },
              d.category ? nice(d.category) : nice(d.doc_type),
              d.uploaded_via_phone ? " · from phone" : "",
            ),
            h("span", { class: `status ${d.status}` }, STATUS_LABEL[d.status] ?? d.status),
          ),
        ),
      ])
    : h(
        "div",
        { class: "empty" },
        h("p", {}, filter ? "Nothing matches this filter." : "No receipts this month yet."),
        filter ? null : h("a", { class: "primary", href: "#/add" }, "Add a receipt"),
      );

  page.render(
    monthNav(refresh),
    h("h1", {}, "Receipts"),
    h(
      "div",
      { class: "filters", role: "group", "aria-label": "Filter" },
      chip("", "All"),
      hasReview ? chip("needs_review", "Needs a check") : null,
      cats.map((c) => chip(c, title(c))),
    ),
    list,
  );
}
