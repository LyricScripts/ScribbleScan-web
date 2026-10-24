"use client";

import { monthLabel, shiftMonth, thisMonth } from "@/src/format";
import { useDemo } from "@/src/components/demo-context";

export function MonthNav() {
  const { month, source, setMonth } = useDemo();
  const move = (amount: number) => setMonth(shiftMonth(month, amount));
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-1">
      <button type="button" aria-label="Previous month" disabled={source === "sample"} onClick={() => move(-1)} className="grid h-8 w-8 place-items-center rounded-full text-quiet hover:bg-paper disabled:opacity-40">
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span className="px-1 text-sm font-semibold">{monthLabel(month)}</span>
      <button type="button" aria-label="Next month" disabled={source === "sample" || month >= thisMonth()} onClick={() => move(1)} className="grid h-8 w-8 place-items-center rounded-full text-quiet hover:bg-paper disabled:opacity-40">
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}
