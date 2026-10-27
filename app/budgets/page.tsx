"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/src/components/demo-context";
import { currencySymbol, monthLabel } from "@/src/format";
import { money } from "@/src/lib/demo-data";

export default function BudgetsPage() {
  const { activeSpace, categories, currency, source, month, saveBudgets } = useDemo();
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLimits(
      Object.fromEntries(
        categories.map((category) => [category.key, category.budget ? String(category.budget) : ""]),
      ),
    );
  }, [categories]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-quiet">
          {activeSpace} · {monthLabel(month)}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Monthly budgets</h1>
        <p className="mt-1 max-w-xl text-quiet">Set a spending limit for each category in {activeSpace}.</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const budgets = Object.fromEntries(
            Object.entries(limits).map(([key, value]) => [key, Number(value) || 0]),
          );
          void saveBudgets(budgets)
            .then(() => setSaved(true))
            .catch((cause: Error) => setError(cause.message));
        }}
        className="rounded-2xl border border-line bg-card p-5 sm:p-7"
      >
        <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="font-bold text-ink">Category limits</h2>
            <p className="mt-1 text-sm text-quiet">A warning appears when spending reaches 80%.</p>
          </div>
          <span className="text-sm text-quiet">{currency}</span>
        </div>
        <div className="divide-y divide-line">
          {categories.map((category) => {
            const limit = Number(limits[category.key] || 0);
            const spentPercent = limit ? Math.round((category.amount / limit) * 100) : 0;
            return (
              <div
                key={category.name}
                className="grid grid-cols-[minmax(0,1fr)_minmax(110px,150px)] items-center gap-3 py-3.5 sm:gap-5"
              >
                <label htmlFor={`budget-${category.key}`} className="flex min-w-0 items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: category.color }} />
                  <span className="truncate font-medium text-ink">{category.name}</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-quiet">
                    {currencySymbol(currency)}
                  </span>
                  <input
                    id={`budget-${category.key}`}
                    inputMode="numeric"
                    type="number"
                    min="0"
                    step="100"
                    value={limits[category.key] ?? ""}
                    onChange={(event) => {
                      setSaved(false);
                      setLimits({ ...limits, [category.key]: event.target.value });
                    }}
                    className="w-full rounded-lg border border-line bg-paper py-2 pl-8 pr-3 text-right tabular-nums outline-none focus:border-ledger"
                  />
                </div>
                <div className="col-span-2 -mt-1 sm:col-span-2 sm:pl-6">
                  <div className="flex justify-between text-xs text-quiet">
                    <span>Spent {money(category.amount, currency)}</span>
                    <span className={spentPercent >= 80 ? "font-semibold text-amber" : ""}>
                      {limit ? `${spentPercent}% used` : "No limit"}
                    </span>
                  </div>
                  {limit ? (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${spentPercent >= 100 ? "bg-stamp" : spentPercent >= 80 ? "bg-amber" : "bg-ledger"}`}
                        style={{ width: `${Math.min(spentPercent, 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p role="status" className={`text-sm ${error ? "text-stamp" : "text-ledger"}`}>
            {error ||
              (saved
                ? source === "connected"
                  ? "Budgets saved."
                  : "Budgets saved in this preview."
                : source === "connected"
                  ? "Changes will update this space."
                  : "Changes are local to this preview.")}
          </p>
          <button
            type="submit"
            className="rounded-lg bg-ledger-button px-5 py-2.5 font-semibold text-white transition hover:bg-[#0a5948]"
          >
            Save budgets
          </button>
        </div>
      </form>
    </div>
  );
}
