"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiError, request } from "@/src/api/client";
import { useDemo } from "@/src/components/demo-context";
import { MonthNav } from "@/src/components/month-nav";
import { monthLabel } from "@/src/format";
import { dateLabel, money } from "@/src/lib/demo-data";

export default function ReceiptsPage() {
  const { activeSpace, activeSpaceId, receipts, categories, currency, month, source, downloadCsv } =
    useDemo();
  const [filter, setFilter] = useState("All receipts");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const shown = useMemo(
    () =>
      receipts.filter((receipt) => {
        const matchesFilter =
          filter === "All receipts" ||
          (filter === "Needs review" ? receipt.status === filter : receipt.category === filter);
        const searchText = `${receipt.merchant} ${receipt.category}`.toLowerCase();
        return matchesFilter && searchText.includes(query.trim().toLowerCase());
      }),
    [receipts, filter, query],
  );
  const filters = ["All receipts", "Needs review", ...new Set(categories.map((category) => category.name))];
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status === "needs_review" || status === "Needs review") setFilter("Needs review");
  }, []);

  const exportExcel = async () => {
    setExporting(true);
    setExportError("");
    try {
      const response = await request(`/v1/spaces/${activeSpaceId}/export?month=${month}&format=xlsx`);
      if (!response.ok)
        throw response.status === 402 ? await apiError(response) : new Error("Export failed. Try again.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activeSpace.replaceAll(/[^\p{L}\p{N}-]+/gu, "-")}-${month}.xlsx`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-quiet">
            {activeSpace} · {monthLabel(month)}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Receipts</h1>
          <p className="mt-1 text-quiet">Browse and review your purchases.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <MonthNav />
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search receipts</span>
            <svg
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-quiet"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search merchant or category"
              className="w-full rounded-xl border border-line bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-ledger"
            />
          </label>
        </div>
      </div>

      <fieldset className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Filter receipts">
        {filters.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={filter === name}
            onClick={() => setFilter(name)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${filter === name ? "border-ink bg-ink font-semibold text-white" : "border-line bg-card text-quiet hover:text-ink"}`}
          >
            {name}
          </button>
        ))}
      </fieldset>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <h2 className="font-bold text-ink">
            {shown.length} {shown.length === 1 ? "receipt" : "receipts"}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 hidden text-sm text-quiet sm:inline">Newest first</span>
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-lg border border-line bg-[var(--raised)] px-3 py-2 text-xs font-semibold text-ink transition hover:bg-[var(--raised-hover)] sm:text-sm"
            >
              Download CSV
            </button>
            {source === "connected" ? (
              <button
                type="button"
                disabled={exporting}
                onClick={() => void exportExcel()}
                className="rounded-lg border border-line bg-[var(--raised)] px-3 py-2 text-xs font-semibold text-ink transition hover:bg-[var(--raised-hover)] disabled:opacity-60 sm:text-sm"
              >
                {exporting ? "Preparing…" : "Download Excel"}
              </button>
            ) : null}
          </div>
        </div>
        {exportError ? (
          <p role="alert" className="border-b border-line px-5 py-2 text-sm text-stamp sm:px-6">
            {exportError}
          </p>
        ) : null}
        {shown.length ? (
          <div className="divide-y divide-line">
            {shown.map((receipt) => (
              <Link
                key={receipt.id}
                href={`/receipts/${receipt.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-paper/70 sm:grid-cols-[minmax(0,1fr)_150px_130px] sm:px-6"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{receipt.merchant}</span>
                  <span className="mt-0.5 block text-sm text-quiet">
                    {receipt.category} · {dateLabel(receipt.date)}
                  </span>
                </span>
                <span className="hidden text-sm text-quiet sm:block">{dateLabel(receipt.date)}</span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums text-ink">
                    {money(receipt.amount, currency)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${receipt.status === "Needs review" ? "text-amber" : "text-ledger"}`}
                  >
                    {receipt.status}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="font-semibold text-ink">No receipts found</p>
            <p className="mt-1 text-sm text-quiet">Try another search or filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}
