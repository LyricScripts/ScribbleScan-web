"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, request } from "@/src/api/client";
import type { DocSchema, DocumentOut, FieldSpec, Issue } from "@/src/api/types";
import { useDemo } from "@/src/components/demo-context";
import { nice, parseAmount, title, toDMY, toISO } from "@/src/format";
import { dateLabel } from "@/src/lib/demo-data";

type FieldKind = NonNullable<FieldSpec["x-kind"]>;
type FormData = Record<string, unknown>;

function dateInput(value: unknown) {
  if (value == null) return "";
  return toDMY(String(value));
}

function readField(kind: FieldKind, value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (kind === "date") return toISO(trimmed);
  if (kind === "amount" || kind === "number") return parseAmount(trimmed);
  return trimmed;
}

function hasContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasContent);
  if (typeof value === "object") return Object.values(value).some(hasContent);
  return true;
}

function issueText(issue: Issue) {
  switch (issue.rule) {
    case "empty":
      return "Nothing was read automatically. Type the main details.";
    case "missing":
      return `The ${nice(issue.detail).replace(/\[\d+\]/, "")} is missing.`;
    case "date_parse":
      return "The date isn't readable. Use DD/MM/YYYY.";
    case "total_positive":
      return "The total should be more than zero.";
    case "items_sum":
      return `The items don't add up: ${issue.detail.replace("!=", "but")}.`;
    case "total_math":
      return `Subtotal plus VAT doesn't match the total (${issue.detail.replace("!=", "≠")}).`;
    case "line_math":
      return `A line's quantity × price doesn't match its amount (${issue.detail}).`;
    default:
      return issue.detail;
  }
}

function inputClass() {
  return "mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2.5 outline-none focus:border-ledger";
}

export default function ReviewReceiptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { receipts, categories, source, loading, refresh, updateReceipt } = useDemo();
  const receipt = receipts.find((item) => item.id === params.id);
  const [document, setDocument] = useState<DocumentOut | null>(null);
  const [schema, setSchema] = useState<DocSchema | null>(null);
  const [allCategories, setAllCategories] = useState(categories.map((item) => item.key));
  const [formData, setFormData] = useState<FormData>({});
  const [category, setCategory] = useState("");
  const [sampleMerchant, setSampleMerchant] = useState("");
  const [sampleAmount, setSampleAmount] = useState("");
  const [photo, setPhoto] = useState<{ url: string; pdf: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (source !== "connected") return;
    let cancelled = false;
    void Promise.all([api<DocumentOut>(`/v1/documents/${params.id}`), api<string[]>("/v1/categories")])
      .then(async ([loaded, availableCategories]) => {
        const loadedSchema = await api<DocSchema>(`/v1/schemas/${loaded.doc_type}`);
        if (cancelled) return;
        setDocument(loaded);
        setSchema(loadedSchema);
        setFormData(loaded.data ?? {});
        setCategory(loaded.category ?? availableCategories[0] ?? "");
        setAllCategories(availableCategories);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [source, params.id]);

  useEffect(() => {
    if (source !== "connected" || document?.status !== "processing") return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await api<DocumentOut>(`/v1/documents/${params.id}`);
        if (cancelled) return;
        if (next.status !== "processing") {
          setDocument(next);
          setFormData(next.data ?? {});
          setCategory(next.category ?? allCategories[0] ?? "");
          void refresh();
          return;
        }
      } catch {
        // A transient poll failure should not interrupt the receipt review screen.
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [source, params.id, document?.status, allCategories, refresh]);

  useEffect(() => {
    if (source !== "connected") return;
    let objectUrl: string | null = null;
    void request(`/v1/documents/${params.id}/file`)
      .then(async (response) => {
        if (!response.ok) return;
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPhoto({ url: objectUrl, pdf: blob.type === "application/pdf" });
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, params.id]);

  const fields = useMemo(() => Object.entries(schema?.properties ?? {}), [schema]);

  useEffect(() => {
    if (!receipt) return;
    setSampleMerchant(receipt.merchant);
    setSampleAmount(String(receipt.amount));
    setCategory(
      categories.find((item) => item.name === receipt.category)?.key ??
        receipt.category.toLowerCase().replaceAll(" ", "_"),
    );
  }, [receipt, categories]);

  const collectData = () =>
    Object.fromEntries(
      fields.map(([name, spec]) => {
        const kind = spec["x-kind"] ?? "text";
        if (kind !== "rows")
          return [name, readField(kind, formData[name] == null ? "" : String(formData[name]))];
        const columns = Object.entries(spec.items?.properties ?? {});
        const rows = Array.isArray(formData[name]) ? (formData[name] as FormData[]) : [];
        return [
          name,
          rows
            .map((row) =>
              Object.fromEntries(
                columns.map(([column, columnSpec]) => {
                  const columnKind = columnSpec["x-kind"] ?? "text";
                  return [column, readField(columnKind, row[column] == null ? "" : String(row[column]))];
                }),
              ),
            )
            .filter((row) => Object.values(row).some((value) => value != null)),
        ];
      }),
    );
  const canConfirm = hasContent(collectData());

  const save = async (confirmed = false) => {
    setError("");
    setSaving(true);
    try {
      if (source === "connected") {
        const result = await api<DocumentOut>(`/v1/documents/${params.id}`, {
          method: "PATCH",
          body: { data: collectData(), category, confirmed },
        });
        setDocument(result);
        await refresh();
        setSaved(true);
      } else {
        updateReceipt(params.id, {
          merchant: sampleMerchant.trim() || receipt?.merchant || "Receipt",
          amount: Number(sampleAmount) || 0,
          category: categories.find((item) => item.key === category)?.name ?? title(category),
        });
        setSaved(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save these changes.");
    } finally {
      setSaving(false);
    }
  };

  const removeReceipt = async () => {
    if (!confirm("Delete this receipt?")) return;
    try {
      await api(`/v1/documents/${params.id}`, { method: "DELETE" });
      await refresh();
      router.push("/receipts");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't delete this receipt.");
    }
  };

  if (!receipt && source === "sample" && loading)
    return (
      <p role="status" className="text-quiet">
        Loading receipt…
      </p>
    );
  if (!receipt && source === "sample") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Receipt not found</h1>
        <p className="mt-2 text-quiet">This receipt is not part of the sample set.</p>
        <Link
          href="/receipts"
          className="mt-5 inline-flex rounded-lg bg-ledger-button px-4 py-2 text-sm font-semibold text-white"
        >
          Back to receipts
        </Link>
      </div>
    );
  }
  if (source === "connected" && (!document || !schema))
    return (
      <p role={error ? "alert" : "status"} className={error ? "text-stamp" : "text-quiet"}>
        {error || "Loading receipt details…"}
      </p>
    );

  if (source === "connected" && document?.status === "processing") {
    return (
      <div className="mx-auto max-w-2xl">
        <section
          aria-live="polite"
          className="overflow-hidden rounded-lg border border-line bg-card p-6 font-mono sm:p-8"
        >
          <div className="flex items-start gap-4">
            <svg
              aria-hidden="true"
              className="mt-1 h-6 w-6 shrink-0 animate-spin text-ledger"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
              <path
                className="opacity-90"
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-ink">Reading receipt</h1>
              <p className="mt-2 break-all text-sm text-quiet">{document.filename}</p>
            </div>
          </div>

          <ol
            aria-label="Receipt processing steps"
            className="mt-8 divide-y divide-line border-y border-line"
          >
            <li className="flex items-center gap-4 py-4 text-ledger">
              <span className="text-xs tabular-nums">01</span>
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
              <span>Receipt uploaded</span>
            </li>
            <li aria-current="step" className="flex items-center gap-4 py-4 text-ink">
              <span className="text-xs tabular-nums text-ledger">02</span>
              <span className="h-2 w-2 animate-pulse rounded-full bg-ledger" />
              <span>Extracting details</span>
            </li>
            <li className="flex items-center gap-4 py-4 text-quiet">
              <span className="text-xs tabular-nums">03</span>
              <span className="h-2 w-2 rounded-full border border-line" />
              <span>Review and confirm</span>
            </li>
          </ol>

          <p className="mt-5 text-sm leading-6 text-quiet">
            This page will show the extracted fields when they are ready to review.
          </p>
          <Link
            href="/receipts"
            className="mt-5 inline-flex text-sm font-semibold text-ledger hover:underline"
          >
            Back to receipts
          </Link>
        </section>
      </div>
    );
  }

  const status =
    document?.status === "ready"
      ? "Ready"
      : document?.status === "needs_review"
        ? "Needs review"
        : document?.status === "processing"
          ? "Processing"
          : document?.status === "failed"
            ? "Unreadable"
            : (receipt?.status ?? "Processing");
  const statusNote =
    document?.status === "ready"
      ? "Checked and counted in your spending."
      : document?.status === "needs_review"
        ? (document.error ?? "Please check these details before confirming.")
        : document?.status === "processing"
          ? "Still reading this receipt…"
          : document?.status === "failed"
            ? (document.error ?? "This file couldn't be read.")
            : "Review and edit the receipt fields.";
  const merchantLabel =
    document?.doc_type === "invoice"
      ? "Supplier"
      : document?.doc_type === "bank_statement"
        ? "Bank"
        : "Merchant";
  const amountLabel = document?.doc_type === "bank_statement" ? "Closing balance" : "Total amount";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/receipts" className="text-sm font-semibold text-ledger hover:underline">
          Back to receipts
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-quiet">
              {dateLabel(document?.date ?? receipt?.date ?? document?.created_at.slice(0, 10) ?? "")} ·{" "}
              {params.id}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
              {document?.merchant || receipt?.merchant || document?.filename || "Receipt"}
            </h1>
            <p className="mt-1 text-sm text-quiet">{statusNote}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${status === "Needs review" ? "bg-amber-soft text-amber" : status === "Unreadable" ? "bg-stamp/10 text-stamp" : "bg-ledger-soft text-ledger"}`}
          >
            {status}
          </span>
        </div>
      </div>

      {document?.possible_duplicate_of ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/20 bg-amber-soft px-4 py-3">
          <p className="text-sm font-medium text-ink">This looks like a receipt you already added.</p>
          <Link
            href={`/receipts/${document.possible_duplicate_of}`}
            className="text-sm font-semibold text-ledger hover:underline"
          >
            View the other one
          </Link>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <section className="grid min-h-80 place-items-center overflow-hidden rounded-2xl border border-line bg-card p-5 text-center">
          {photo?.pdf ? (
            <a
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ledger hover:underline"
            >
              Open receipt PDF
            </a>
          ) : photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt="Uploaded receipt"
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
          ) : (
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-paper text-quiet">
                <svg
                  aria-hidden="true"
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
                  <path d="M9 8h6m-6 4h6m-6 4h3" />
                </svg>
              </div>
              <p className="mt-4 font-semibold text-ink">Receipt image preview</p>
              <p className="mt-1 max-w-xs text-sm leading-6 text-quiet">
                {source === "connected"
                  ? "The image is not available."
                  : "A real receipt image appears here when an account is connected."}
              </p>
            </div>
          )}
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="rounded-2xl border border-line bg-card p-5 sm:p-6"
        >
          <h2 className="text-lg font-bold text-ink">Purchase details</h2>
          <p className="mt-1 text-sm text-quiet">Review and edit the details read from your receipt.</p>
          {document?.issues.length && document.status !== "ready" ? (
            <div className="mt-5 rounded-xl border border-amber/20 bg-amber-soft p-4">
              <p className="font-semibold text-ink">Doesn’t add up yet</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-quiet">
                {document.issues.map((issue, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the server's list, shown as is and never reordered
                  <li key={`${issue.rule}-${index}`}>{issueText(issue)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <fieldset disabled={document?.status === "processing"} className="mt-5 space-y-4">
            <div>
              <label htmlFor="receipt-category" className="text-sm font-semibold text-ink">
                Category
              </label>
              <select
                id="receipt-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setSaved(false);
                }}
                className={inputClass()}
              >
                {allCategories.map((item) => (
                  <option key={item} value={item}>
                    {title(item)}
                  </option>
                ))}
              </select>
            </div>
            {fields.map(([name, spec]) => {
              const kind = spec["x-kind"] ?? "text";
              if (kind === "rows") {
                const columns = Object.entries(spec.items?.properties ?? {});
                const rows = Array.isArray(formData[name]) ? (formData[name] as FormData[]) : [];
                const updateRow = (rowIndex: number, column: string, value: string) => {
                  const nextRows = rows.map((row, index) =>
                    index === rowIndex ? { ...row, [column]: value } : row,
                  );
                  setFormData((current) => ({ ...current, [name]: nextRows }));
                  setSaved(false);
                };
                return (
                  <div key={name}>
                    <h3 className="mb-2 text-sm font-semibold text-ink">{title(name)}</h3>
                    {rows.length ? (
                      <div className="overflow-x-auto rounded-lg border border-line">
                        <table className="w-full min-w-[440px] text-left text-sm">
                          <thead className="bg-paper text-xs text-quiet">
                            <tr>
                              {columns.map(([column]) => (
                                <th key={column} className="px-3 py-2 font-semibold">
                                  {title(column)}
                                </th>
                              ))}
                              <th className="px-3 py-2">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {rows.map((row, rowIndex) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no ID; their inputs are controlled by the row data, so a removed row's DOM shows the right values
                              <tr key={`${name}-${rowIndex}`}>
                                {columns.map(([column, columnSpec]) => {
                                  const columnKind = columnSpec["x-kind"] ?? "text";
                                  return (
                                    <td key={column} className="p-2">
                                      <input
                                        aria-label={title(column)}
                                        value={dateInput(row[column])}
                                        inputMode={
                                          columnKind === "amount" || columnKind === "number"
                                            ? "decimal"
                                            : undefined
                                        }
                                        placeholder={columnKind === "date" ? "DD/MM/YYYY" : undefined}
                                        onChange={(event) => updateRow(rowIndex, column, event.target.value)}
                                        className="w-full min-w-24 rounded-md border border-line bg-paper px-2 py-1.5 outline-none focus:border-ledger"
                                      />
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1.5">
                                  <button
                                    type="button"
                                    aria-label="Remove row"
                                    onClick={() => {
                                      setFormData((current) => ({
                                        ...current,
                                        [name]: rows.filter((_, index) => index !== rowIndex),
                                      }));
                                      setSaved(false);
                                    }}
                                    className="rounded px-2 py-1 text-quiet hover:bg-paper hover:text-ink"
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-quiet">No {nice(name)} added.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const blank = Object.fromEntries(columns.map(([column]) => [column, ""]));
                        setFormData((current) => ({ ...current, [name]: [...rows, blank] }));
                        setSaved(false);
                      }}
                      className="mt-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-paper"
                    >
                      Add row
                    </button>
                  </div>
                );
              }
              const value = formData[name];
              return (
                <div key={name}>
                  <label htmlFor={`field-${name}`} className="text-sm font-semibold text-ink">
                    {title(name)}
                  </label>
                  <input
                    id={`field-${name}`}
                    type="text"
                    inputMode={kind === "amount" || kind === "number" ? "decimal" : undefined}
                    placeholder={kind === "date" ? "DD/MM/YYYY" : undefined}
                    value={kind === "date" ? dateInput(value) : value == null ? "" : String(value)}
                    onChange={(event) => {
                      setFormData((current) => ({ ...current, [name]: event.target.value }));
                      setSaved(false);
                    }}
                    className={inputClass()}
                  />
                </div>
              );
            })}
            {source === "sample" ? (
              <>
                <div>
                  <label htmlFor="sample-merchant" className="text-sm font-semibold text-ink">
                    {merchantLabel}
                  </label>
                  <input
                    id="sample-merchant"
                    value={sampleMerchant}
                    onChange={(event) => {
                      setSampleMerchant(event.target.value);
                      setSaved(false);
                    }}
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label htmlFor="sample-amount" className="text-sm font-semibold text-ink">
                    {amountLabel}
                  </label>
                  <input
                    id="sample-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={sampleAmount}
                    onChange={(event) => {
                      setSampleAmount(event.target.value);
                      setSaved(false);
                    }}
                    className={inputClass()}
                  />
                </div>
              </>
            ) : null}
          </fieldset>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p
              role={error ? "alert" : "status"}
              className={`text-sm ${error ? "text-stamp" : "text-ledger"}`}
            >
              {error ||
                (saved
                  ? source === "connected"
                    ? document?.status === "ready"
                      ? "Receipt confirmed and saved."
                      : document?.issues.length
                        ? "Saved. Some numbers still need a check."
                        : "Saved. Confirm the details when they look right."
                    : "Preview saved for this screen."
                  : source === "connected"
                    ? "Check the extracted details, then confirm them."
                    : "Sample mode: values are shown for preview.")}
            </p>
            <div className="flex flex-wrap gap-2">
              {source === "connected" ? (
                <button
                  type="button"
                  onClick={() => void removeReceipt()}
                  className="rounded-lg border border-line px-3.5 py-2.5 text-sm font-semibold text-stamp hover:bg-paper"
                >
                  Delete
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving || document?.status === "processing"}
                className="rounded-lg bg-ledger-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5948] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {document?.status === "needs_review" ? (
                <button
                  type="button"
                  disabled={saving || !canConfirm}
                  onClick={() => void save(true)}
                  className="rounded-lg border border-line px-3.5 py-2.5 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-60"
                >
                  {document.issues.length ? "Confirm anyway" : "Confirm details"}
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
