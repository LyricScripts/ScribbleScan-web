"use client";

import { useMemo, useState } from "react";
import { type Category, money, type Receipt } from "@/src/lib/demo-data";

const intensityClasses = [
  "bg-[var(--track)] text-quiet",
  "bg-ledger/20 text-ink",
  "bg-ledger/40 text-ink",
  "bg-ledger/70 text-ink",
  "bg-ledger text-[#0a0b0e]",
];

type DailyCategory = { name: string; amount: number; color: string };

export function DailySpendHeatmap({
  receipts,
  categories,
  currency,
  month,
}: {
  receipts: Receipt[];
  categories: Category[];
  currency: string;
  month: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  const spendingByDay = useMemo(() => {
    const totals = new Map<string, { total: number; categories: Map<string, DailyCategory> }>();
    const colors = new Map(categories.map((category) => [category.name.toLowerCase(), category.color]));
    for (const receipt of receipts) {
      if (!receipt.date.startsWith(`${month}-`) || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.date)) continue;
      const day = totals.get(receipt.date) ?? { total: 0, categories: new Map<string, DailyCategory>() };
      const key = receipt.category.toLowerCase();
      const category = day.categories.get(key) ?? {
        name: receipt.category,
        amount: 0,
        color: colors.get(key) ?? "#969aa4",
      };
      category.amount += receipt.amount;
      day.total += receipt.amount;
      day.categories.set(key, category);
      totals.set(receipt.date, day);
    }
    return new Map(
      [...totals].map(([date, day]) => [
        date,
        {
          total: day.total,
          categories: [...day.categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
        },
      ]),
    );
  }, [categories, month, receipts]);

  const maxAmount = Math.max(0, ...[...spendingByDay.values()].map((day) => day.total));
  const monthCategories = new Map<string, DailyCategory>();
  for (const day of spendingByDay.values()) {
    for (const category of day.categories) monthCategories.set(category.name.toLowerCase(), category);
  }
  const latestSpendDate =
    [...spendingByDay.entries()]
      .filter(([, day]) => day.total > 0)
      .map(([date]) => date)
      .sort()
      .at(-1) ?? null;
  const activeDate = selectedDate && spendingByDay.has(selectedDate) ? selectedDate : latestSpendDate;
  const activeAmount = activeDate ? (spendingByDay.get(activeDate)?.total ?? 0) : 0;
  const activeLabel = activeDate
    ? new Date(year, monthIndex, Number(activeDate.slice(-2))).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : null;
  return (
    <section className="border-t border-line pt-5" aria-label="Daily spending tracker">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Daily spending</h2>
          <p className="mt-1 text-xs text-quiet">
            {activeLabel
              ? `${activeLabel} · ${money(activeAmount, currency)}`
              : "No receipt spending recorded"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-quiet" aria-hidden="true">
          <span>Less</span>
          {intensityClasses.map((level) => (
            <span key={level} aria-hidden="true" className={`h-3 w-3 rounded-[3px] ${level.split(" ")[0]}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <fieldset
        className="mx-auto mt-3 grid min-w-0 max-w-4xl grid-cols-11 gap-1.5 sm:gap-2"
        aria-label={`Daily receipt spending for ${month}`}
      >
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const isoDate = `${month}-${String(day).padStart(2, "0")}`;
          const dailySpend = spendingByDay.get(isoDate);
          const amount = dailySpend?.total ?? 0;
          const categoryDetails = dailySpend?.categories
            .map((category) => `${category.name}: ${money(category.amount, currency)}`)
            .join(", ");
          const level =
            amount > 0 && maxAmount > 0
              ? amount >= maxAmount * 0.75
                ? 4
                : amount >= maxAmount * 0.5
                  ? 3
                  : amount >= maxAmount * 0.25
                    ? 2
                    : 1
              : 0;
          const label = new Date(year, monthIndex, day).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          const spendDetail =
            amount > 0
              ? `${money(amount, currency)} spent${categoryDetails ? `. Categories: ${categoryDetails}` : ""}`
              : "no receipt spending";
          return (
            <button
              key={isoDate}
              type="button"
              aria-label={`${label}: ${spendDetail}`}
              aria-pressed={activeDate === isoDate}
              title={`${label}: ${spendDetail}`}
              onClick={() => setSelectedDate(isoDate)}
              className={`flex aspect-square w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 text-[10px] font-medium tabular-nums transition hover:ring-1 hover:ring-ledger ${intensityClasses[level]} ${activeDate === isoDate ? "ring-2 ring-ledger ring-offset-1 ring-offset-card" : ""}`}
              style={{ gridColumn: (index % 11) + 1, gridRow: Math.floor(index / 11) + 1 }}
            >
              <span>{day}</span>
              {dailySpend?.categories.length ? (
                <span className="grid max-w-8 grid-cols-4 justify-items-center gap-0.5" aria-hidden="true">
                  {dailySpend.categories.map((category) => (
                    <span
                      key={category.name}
                      className="h-1 w-1 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                  ))}
                </span>
              ) : null}
              <span className="hidden max-w-full truncate text-[9px] leading-3 sm:block">
                {amount > 0 ? money(amount, currency) : "—"}
              </span>
            </button>
          );
        })}
      </fieldset>
      {monthCategories.size ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {[...monthCategories.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((category) => (
              <span key={category.name} className="flex items-center gap-1.5 text-xs text-quiet">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                {category.name}
              </span>
            ))}
        </div>
      ) : null}
    </section>
  );
}
