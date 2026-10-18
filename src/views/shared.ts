import { request } from "../api/client";
import { type Child, h, render, toast } from "../dom";
import { monthLabel, shiftMonth, thisMonth } from "../format";
import { currentSpace, state } from "../state";

export const view = () => document.getElementById("view") as HTMLElement;

/**
 * One navigation's claim on the screen. Views load data, then render through their page;
 * once the user has moved on (another page, month or space), a late response is dropped
 * instead of overwriting what they are looking at now.
 */
export interface Page {
  render(...kids: Child[]): void;
  readonly current: boolean;
}

let latest = 0;
export function newPage(): Page {
  const id = ++latest;
  return {
    render: (...kids) => {
      if (id === latest) render(view(), ...kids);
    },
    get current() {
      return id === latest;
    },
  };
}

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
