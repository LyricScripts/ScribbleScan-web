import { api } from "../api/client";
import type { Summary } from "../api/types";
import { categoryColor, h } from "../dom";
import { currencySymbol, money, monthLabel, nice } from "../format";
import { currentSpace, state } from "../state";
import { download, monthNav, type Page } from "./shared";

export async function homeView(page: Page, refresh: () => void): Promise<void> {
  const s = await api<Summary>(`/v1/spaces/${currentSpace().id}/summary?month=${state.month}`);
  const cur = s.currency;
  const spent = s.categories.filter((c) => c.spent > 0);
  const budgetTotal = s.categories.reduce((a, c) => a + (c.budget ?? 0), 0);
  const scaleMax = Math.max(s.total, budgetTotal);

  const change =
    s.change_pct == null
      ? null
      : h(
          "p",
          { class: "change" },
          h(
            "b",
            { class: s.change_pct > 0 ? "up" : "down" },
            `${s.change_pct > 0 ? "+" : ""}${s.change_pct}%`,
          ),
          ` compared with ${monthLabel(s.last_month.month)} (${money(s.last_month.total, cur)})`,
        );

  const strip = spent.length
    ? h(
        "div",
        { class: "strip" },
        h(
          "div",
          {
            class: "strip-bar",
            role: "img",
            "aria-label": spent.map((c) => `${c.category} ${money(c.spent, cur)}`).join(", "),
          },
          spent.map((c) =>
            h("span", {
              title: `${nice(c.category)}: ${money(c.spent, cur)}`,
              style: {
                background: categoryColor(c.category),
                flexGrow: String(c.spent / scaleMax),
                flexBasis: "0",
              },
            }),
          ),
          scaleMax > s.total
            ? h("span", {
                style: {
                  flexGrow: String((scaleMax - s.total) / scaleMax),
                  flexBasis: "0",
                  background: "transparent",
                },
              })
            : null,
        ),
        h(
          "div",
          { class: "strip-scale" },
          h("span", {}, `${s.documents} receipt${s.documents === 1 ? "" : "s"}`),
          budgetTotal ? h("span", { class: "num" }, `Budgets ${money(budgetTotal, cur)}`) : h("span"),
        ),
      )
    : null;

  const cats = h(
    "ul",
    { class: "cats" },
    s.categories.map((c) => {
      const used = c.budget_used ?? 0;
      return h(
        "li",
        {},
        h("span", { class: "dot", style: { background: categoryColor(c.category) } }),
        h("span", { class: "name" }, nice(c.category)),
        h("span", { class: "amt num" }, money(c.spent, cur)),
        c.budget
          ? h(
              "div",
              { class: `meter ${c.alert ?? ""}` },
              h("i", { style: { width: `${Math.min(100, used * 100)}%` } }),
            )
          : null,
        h(
          "div",
          { class: "meta" },
          h(
            "span",
            { class: "num" },
            c.budget
              ? `${Math.round(used * 100)}% of ${money(c.budget, cur)}`
              : `Last month ${money(c.last_month, cur)}`,
          ),
          c.alert
            ? h("span", { class: `flag ${c.alert}` }, c.alert === "over" ? "Over budget" : "Close to budget")
            : null,
        ),
      );
    }),
  );

  const content =
    s.documents === 0
      ? h(
          "div",
          { class: "empty" },
          h("h2", {}, "No receipts this month"),
          h("p", {}, "Add a photo of a receipt and it shows up here, sorted by category."),
          h("a", { class: "primary", href: "#/add" }, "Add a receipt"),
        )
      : [
          h(
            "div",
            { class: "total num" },
            h("small", {}, currencySymbol(cur)),
            money(s.total, cur, { sign: false }),
          ),
          change,
          strip,
          s.needs_review
            ? h(
                "div",
                { class: "notice" },
                h(
                  "span",
                  {},
                  `${s.needs_review} receipt${s.needs_review === 1 ? " needs" : "s need"} a quick check`,
                ),
                h("a", { class: "secondary", href: "#/receipts?status=needs_review" }, "Check now"),
              )
            : null,
          h("h2", {}, "By category"),
          cats,
          h(
            "div",
            { class: "actions" },
            h(
              "button",
              { class: "secondary", type: "button", onclick: () => download("xlsx") },
              "Download Excel",
            ),
            h(
              "button",
              { class: "secondary", type: "button", onclick: () => download("csv") },
              "Download CSV",
            ),
          ),
        ];
  page.render(monthNav(refresh), content);
}
