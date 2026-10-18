import { api, request } from "../api/client";
import type { DocSchema, DocumentOut, FieldSpec, Issue } from "../api/types";
import { $, h, render, toast } from "../dom";
import { nice, parseAmount, title, toDMY, toISO } from "../format";
import { state } from "../state";
import { type Page, view } from "./shared";

type Kind = NonNullable<FieldSpec["x-kind"]>;

function fieldInput(kind: Kind, value: unknown): HTMLInputElement {
  const el = h("input", {
    type: "text",
    inputmode: kind === "amount" || kind === "number" ? "decimal" : null,
    placeholder: kind === "date" ? "DD/MM/YYYY" : null,
  });
  if (value != null) el.value = kind === "date" ? toDMY(String(value)) : String(value);
  el.dataset.kind = kind;
  return el;
}

function readValue(el: HTMLInputElement): unknown {
  const v = el.value.trim();
  if (!v) return null;
  if (el.dataset.kind === "date") return toISO(v);
  if (el.dataset.kind === "amount" || el.dataset.kind === "number") return parseAmount(v);
  return v;
}

/** Rule failures in words a shopkeeper understands. */
export function issueText(i: Issue): string {
  switch (i.rule) {
    case "empty":
      return "Nothing was read automatically. Type the main details.";
    case "missing":
      return `The ${nice(i.detail).replace(/\[\d+\]/, "")} is missing.`;
    case "date_parse":
      return "The date isn't readable. Use DD/MM/YYYY.";
    case "total_positive":
      return "The total should be more than zero.";
    case "items_sum":
      return `The items don't add up: ${i.detail.replace("!=", "but")}.`;
    case "total_math":
      return `Subtotal plus VAT doesn't match the total (${i.detail.replace("!=", "≠")}).`;
    case "line_math":
      return `A line's quantity × price doesn't match its amount (${i.detail}).`;
    default:
      return i.detail;
  }
}

export async function docView(page: Page, id: string): Promise<void> {
  const [doc, cats] = await Promise.all([
    api<DocumentOut>(`/v1/documents/${id}`),
    state.categories.length ? state.categories : api<string[]>("/v1/categories"),
  ]);
  state.categories = cats;
  const schema = await api<DocSchema>(`/v1/schemas/${doc.doc_type}`);
  const imgBox = h("div", { class: "photo" }, h("p", { class: "quiet" }, "Loading photo…"));
  request(`/v1/documents/${id}/file`).then(async (r) => {
    if (!r.ok) {
      render(imgBox, h("p", { class: "quiet" }, "Photo unavailable"));
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    render(
      imgBox,
      blob.type === "application/pdf" || doc.filename.toLowerCase().endsWith(".pdf")
        ? h("a", { href: url, target: "_blank", rel: "noopener" }, "Open the PDF")
        : h("img", { src: url, alt: "Uploaded document" }),
    );
  });

  const fields = h("div");
  const rowTables: [string, HTMLTableSectionElement][] = [];
  for (const [name, spec] of Object.entries(schema.properties)) {
    const kind: Kind = spec["x-kind"] ?? "text";
    if (kind === "rows") {
      const cols = Object.entries(spec.items?.properties ?? {});
      const tbody = h("tbody");
      const addRow = (row: Record<string, unknown> = {}) =>
        tbody.append(
          h(
            "tr",
            {},
            cols.map(([c, cs]) => {
              const el = fieldInput(cs["x-kind"] ?? "text", row[c]);
              el.dataset.col = c;
              el.setAttribute("aria-label", nice(c));
              return h("td", {}, el);
            }),
            h(
              "td",
              {},
              h(
                "button",
                {
                  class: "ghost",
                  type: "button",
                  "aria-label": "Remove row",
                  onclick: (e: Event) => (e.target as HTMLElement).closest("tr")?.remove(),
                },
                "×",
              ),
            ),
          ),
        );
      for (const row of (doc.data?.[name] as Record<string, unknown>[] | undefined) ?? []) addRow(row);
      rowTables.push([name, tbody]);
      fields.append(
        h("h2", {}, nice(name)),
        h(
          "table",
          { class: "items" },
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              cols.map(([c]) => h("th", {}, nice(c))),
              h("th"),
            ),
          ),
          tbody,
        ),
        h("button", { class: "secondary", type: "button", onclick: () => addRow() }, "Add row"),
      );
      continue;
    }
    const el = fieldInput(kind, doc.data?.[name]);
    el.id = `f_${name}`;
    el.name = name;
    fields.append(h("div", { class: "field-row" }, h("label", { for: el.id }, title(name)), el));
  }

  const category = h(
    "select",
    { class: "field", id: "f_category" },
    cats.map((c) => h("option", { value: c, selected: c === doc.category }, title(c))),
  );

  const collect = () => {
    const data: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(schema.properties)) {
      if ((spec["x-kind"] ?? "text") !== "rows")
        data[name] = readValue($<HTMLInputElement>(`#f_${name}`, view()));
    }
    for (const [name, tbody] of rowTables) {
      data[name] = [...tbody.rows]
        .map((tr) =>
          Object.fromEntries(
            [...tr.querySelectorAll<HTMLInputElement>("input")].map((el) => [el.dataset.col, readValue(el)]),
          ),
        )
        .filter((r) => Object.values(r).some((v) => v != null));
    }
    return data;
  };

  const save = async (confirmed: boolean) => {
    try {
      const out = await api<DocumentOut>(`/v1/documents/${id}`, {
        method: "PATCH",
        body: { data: collect(), category: category.value, confirmed },
      });
      toast(out.status === "ready" ? "Saved" : "Saved. Some numbers still don't add up.");
      if (out.status === "ready") history.back();
      else await docView(page, id);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const statusLine = {
    ready: "Checked and counted in your spending.",
    needs_review: "Please check these details.",
    processing: "Still reading this receipt…",
    failed: doc.error ?? "This file couldn't be read.",
  }[doc.status];

  page.render(
    h(
      "div",
      { class: "row spread" },
      h("h1", {}, doc.merchant ?? "Receipt"),
      h("span", { class: `status ${doc.status}` }, statusLine),
    ),
    doc.possible_duplicate_of
      ? h(
          "div",
          { class: "notice" },
          h("span", {}, "This looks like a receipt you already added."),
          h("a", { class: "secondary", href: `#/doc/${doc.possible_duplicate_of}` }, "View the other one"),
        )
      : null,
    h(
      "div",
      { class: "review" },
      imgBox,
      h(
        "form",
        {
          class: "form",
          onsubmit: (e: Event) => {
            e.preventDefault();
            void save(false);
          },
        },
        doc.issues.length && doc.status !== "ready"
          ? h(
              "div",
              { class: "issues" },
              h("strong", {}, "Doesn't add up yet"),
              h(
                "ul",
                {},
                doc.issues.map((i) => h("li", {}, issueText(i))),
              ),
            )
          : null,
        h("div", { class: "field-row" }, h("label", { for: "f_category" }, "Category"), category),
        fields,
        h(
          "div",
          { class: "actions" },
          h("button", { class: "primary", type: "submit" }, "Save"),
          doc.status === "needs_review"
            ? h(
                "button",
                { class: "secondary", type: "button", onclick: () => save(true) },
                "Save as correct anyway",
              )
            : null,
          h(
            "button",
            {
              class: "ghost",
              type: "button",
              onclick: async () => {
                if (!confirm("Delete this receipt?")) return;
                await api(`/v1/documents/${id}`, { method: "DELETE" });
                toast("Deleted");
                location.hash = "#/receipts";
              },
            },
            "Delete",
          ),
        ),
      ),
    ),
  );
}
