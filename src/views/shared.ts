import { request } from "../api/client";
import { h, toast } from "../dom";
import { monthLabel, shiftMonth, thisMonth } from "../format";
import { currentSpace, state } from "../state";

export const view = () => document.getElementById("view") as HTMLElement;

export const STATUS_LABEL: Record<string, string> = {
  ready: "Done",
  needs_review: "Check",
  processing: "Reading…",
  failed: "Unreadable",
};

export function monthNav(onChange: () => void): HTMLElement {
  const go = (by: number) => () => {
    state.month = shiftMonth(state.month, by);
    onChange();
  };
  return h(
    "div",
    { class: "month-nav" },
    h("button", { type: "button", "aria-label": "Previous month", onclick: go(-1) }, "‹"),
    h("strong", {}, monthLabel(state.month)),
    h(
      "button",
      { type: "button", "aria-label": "Next month", disabled: state.month >= thisMonth(), onclick: go(1) },
      "›",
    ),
  );
}

export async function download(format: "csv" | "xlsx"): Promise<void> {
  const space = currentSpace();
  const r = await request(`/v1/spaces/${space.id}/export?month=${state.month}&format=${format}`);
  if (!r.ok) {
    toast("Export failed");
    return;
  }
  const a = h("a", {
    href: URL.createObjectURL(await r.blob()),
    download: `${space.name}-${state.month}.${format}`,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
