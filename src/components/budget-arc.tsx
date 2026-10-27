import type { Category } from "@/src/lib/demo-data";
import { money } from "@/src/lib/demo-data";

export function BudgetArc({ categories, currency }: { categories: Category[]; currency: string }) {
  const featured = [...categories].sort((a, b) => b.amount - a.amount).slice(0, 4);
  const totalBudget = categories.reduce((sum, category) => sum + category.budget, 0);
  const totalSpent = categories.reduce((sum, category) => sum + category.amount, 0);
  const overall = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-quiet">Category budget use</h2>
        <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink">
          {featured.length} categories
        </span>
      </div>
      <svg
        className="mx-auto mt-3 block w-full max-w-[350px] overflow-visible"
        viewBox="0 0 320 178"
        role="img"
        aria-label={featured
          .map(
            (category) =>
              `${category.name}: ${category.budget ? Math.round((category.amount / category.budget) * 100) : 0}% of budget`,
          )
          .join(", ")}
      >
        {featured.map((category, index) => {
          const radius = 135 - index * 23;
          const progress = category.budget
            ? Math.min(100, Math.max(0, (category.amount / category.budget) * 100))
            : 0;
          const arc = `M ${160 - radius} 160 A ${radius} ${radius} 0 0 1 ${160 + radius} 160`;
          return (
            <g key={category.key}>
              <path
                d={arc}
                pathLength="100"
                fill="none"
                stroke="var(--chart-track)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d={arc}
                pathLength="100"
                fill="none"
                stroke={category.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${progress} 100`}
              />
            </g>
          );
        })}
        <text
          x="160"
          y="137"
          fill="var(--ink)"
          textAnchor="middle"
          className="fill-ink text-[25px] font-bold"
        >
          {overall}%
        </text>
        <text
          x="160"
          y="155"
          fill="var(--quiet)"
          textAnchor="middle"
          className="fill-quiet text-[9px] font-semibold uppercase tracking-[0.18em]"
        >
          overall
        </text>
      </svg>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
        {featured.map((category) => {
          const percent = category.budget ? Math.round((category.amount / category.budget) * 100) : 0;
          return (
            <div key={category.key} className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-quiet">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate">{category.name}</span>
              </div>
              <p className="mt-1 truncate text-sm font-semibold tabular-nums text-ink">
                {money(category.amount, currency)}{" "}
                <span className="font-normal text-quiet">· {percent}%</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
