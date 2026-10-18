import { api } from "../api/client";
import type { Summary } from "../api/types";
import { categoryColor, h, render, toast } from "../dom";
import { nice, thisMonth } from "../format";
import { currentSpace } from "../state";
import { view } from "./shared";

export async function budgetsView(): Promise<void> {
  const space = currentSpace();
  const [cats, s] = await Promise.all([
    api<string[]>("/v1/categories"),
    api<Summary>(`/v1/spaces/${space.id}/summary?month=${thisMonth()}`),
  ]);
  const current = Object.fromEntries(s.categories.filter((c) => c.budget).map((c) => [c.category, c.budget]));
  const inputs = cats.map((c) => {
    const el = h("input", {
      type: "number",
      min: "0",
      step: "100",
      inputmode: "numeric",
      id: `b_${c}`,
      placeholder: "No limit",
    });
    if (current[c]) el.value = String(current[c]);
    return [c, el] as const;
  });
  render(
    view(),
    h("h1", {}, "Monthly budgets"),
    h(
      "p",
      { class: "quiet" },
      `Set a limit for any category in ${space.name}. You'll see a warning at 80% and when you go over.`,
    ),
    h(
      "form",
      {
        onsubmit: async (e: Event) => {
          e.preventDefault();
          const budgets = Object.fromEntries(inputs.map(([c, el]) => [c, Number(el.value) || 0]));
          try {
            await api(`/v1/spaces/${space.id}/budgets`, { method: "PUT", body: { budgets } });
            toast("Budgets saved");
          } catch (x) {
            toast((x as Error).message);
          }
        },
      },
      inputs.map(([c, el]) =>
        h(
          "div",
          { class: "budget-row" },
          h(
            "label",
            { for: el.id },
            h("span", { class: "dot", style: { background: categoryColor(c) } }),
            nice(c),
          ),
          el,
        ),
      ),
      h("div", { class: "actions" }, h("button", { class: "primary", type: "submit" }, "Save budgets")),
    ),
  );
}
