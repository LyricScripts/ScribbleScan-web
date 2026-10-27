"use client";

import Link from "next/link";
import { BudgetArc } from "@/src/components/budget-arc";
import { DailySpendHeatmap } from "@/src/components/daily-spend-heatmap";
import { useDemo } from "@/src/components/demo-context";
import { MonthNav } from "@/src/components/month-nav";
import { dateLabel, money } from "@/src/lib/demo-data";

function Metric({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-[var(--raised)] p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-quiet">{label}</p>
      <p
        className={`mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px] ${accent ? "text-amber" : "text-ink"}`}
      >
        {value}
      </p>
      <p className="mt-1.5 min-h-5 text-xs leading-5 text-quiet">{note}</p>
    </div>
  );
}

export function Dashboard() {
  const {
    activeSpace,
    categories,
    receipts,
    spentTotal,
    budgetTotal,
    documentCount,
    lastMonthTotal,
    changePct,
    currency,
    month,
  } = useDemo();
  const percent = budgetTotal ? Math.round((spentTotal / budgetTotal) * 100) : 0;
  const remaining = Math.max(0, budgetTotal - spentTotal);
  const comparison =
    changePct == null
      ? `${documentCount} receipts recorded this month`
      : `${Math.abs(changePct)}% ${changePct > 0 ? "more" : "less"} than last month (${money(lastMonthTotal, currency)})`;

  return (
    <div className="space-y-5 sm:space-y-7">
      <div className="flex justify-end">
        <MonthNav />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_20px_55px_rgba(0,0,0,0.24)]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center">
          <BudgetArc categories={categories} currency={currency} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <Metric label="Spent" value={money(spentTotal, currency)} note={comparison} />
            <Metric
              label="Monthly budget"
              value={budgetTotal ? money(budgetTotal, currency) : "No limit"}
              note={budgetTotal ? `${percent}% used` : "Set a category limit"}
            />
            <Metric
              label="Remaining"
              value={money(remaining, currency)}
              note={budgetTotal ? "Available this month" : "No monthly budget set"}
              accent
            />
          </div>
          <div className="lg:col-span-2">
            <DailySpendHeatmap
              receipts={receipts}
              categories={categories}
              currency={currency}
              month={month}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Recent receipts</h2>
            <p className="mt-1 text-sm text-quiet">Latest additions to {activeSpace}.</p>
          </div>
          <Link href="/receipts" className="text-sm font-semibold text-ledger hover:underline">
            See all
          </Link>
        </div>
        <div className="mt-4 grid gap-x-8 lg:grid-cols-2">
          {receipts.slice(0, 8).map((receipt) => (
            <Link
              key={receipt.id}
              href={`/receipts/${receipt.id}`}
              className="flex items-center justify-between gap-4 border-b border-line py-3 transition hover:bg-[var(--raised-hover)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{receipt.merchant}</span>
                <span className="mt-0.5 block text-xs text-quiet">
                  {receipt.category} · {dateLabel(receipt.date)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums text-ink">
                  {money(receipt.amount, currency)}
                </span>
                <span
                  className={`text-xs font-medium ${receipt.status === "Needs review" ? "text-amber" : "text-ledger"}`}
                >
                  {receipt.status}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
