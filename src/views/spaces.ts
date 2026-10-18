import { api } from "../api/client";
import type { SpaceOut } from "../api/types";
import { h, toast } from "../dom";
import type { Page } from "./shared";

export function newSpaceView(page: Page, onCreated: (id: string) => Promise<void>): void {
  const name = h("input", {
    type: "text",
    id: "sp_name",
    required: true,
    maxlength: "120",
    placeholder: "My shop",
  });
  const kind = h(
    "select",
    { class: "field", id: "sp_kind" },
    h("option", { value: "business" }, "Business: a shop, company or client"),
    h("option", { value: "personal" }, "Personal: home or family"),
  );
  page.render(
    h("h1", {}, "New space"),
    h(
      "p",
      { class: "quiet" },
      "Keep different money apart, like your home and your shop. Each space has its own receipts and budgets.",
    ),
    h(
      "form",
      {
        onsubmit: async (e: Event) => {
          e.preventDefault();
          try {
            const s = await api<SpaceOut>("/v1/spaces", {
              method: "POST",
              body: { name: name.value.trim(), kind: kind.value },
            });
            await onCreated(s.id);
            toast(`Created ${s.name}`);
            location.hash = "#/home";
          } catch (x) {
            toast((x as Error).message);
          }
        },
      },
      h("div", { class: "field-row form" }, h("label", { for: "sp_name" }, "Name"), name),
      h("div", { class: "field-row form" }, h("label", { for: "sp_kind" }, "Type"), kind),
      h(
        "div",
        { class: "actions" },
        h("button", { class: "primary", type: "submit" }, "Create space"),
        h("a", { class: "secondary", href: "#/home" }, "Cancel"),
      ),
    ),
  );
  name.focus();
}
