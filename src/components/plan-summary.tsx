"use client";

import { useEffect, useState } from "react";
import { api } from "@/src/api/client";
import type { PlanOut } from "@/src/api/types";
import { askToUpgrade, PLAN_LABELS, type PlanName } from "@/src/plan";

const NEXT: Record<PlanName, PlanName> = {
  free: "plus",
  plus: "business",
  business: "accountant",
  accountant: "accountant",
};

/** The Subscription panel: the account's plan and this month's automatic scans. */
export function PlanSummary({ preview }: { preview: boolean }) {
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (preview) return;
    api<PlanOut>("/v1/plan")
      .then(setPlan)
      .catch(() => setError("Couldn't load your plan."));
  }, [preview]);

  if (preview) {
    return (
      <div className="rounded-lg border border-line bg-[var(--raised)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-quiet">Current access</p>
        <p className="mt-1 text-sm font-semibold text-ink">Sample preview</p>
        <p className="mt-1 text-sm text-quiet">Plans apply to signed-in accounts.</p>
      </div>
    );
  }
  if (error)
    return (
      <p role="alert" className="text-sm text-stamp">
        {error}
      </p>
    );
  if (!plan)
    return (
      <p role="status" className="text-sm text-quiet">
        Loading your plan…
      </p>
    );

  const used = Math.min(plan.scans_used, plan.scans_limit);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-[var(--raised)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-quiet">Your plan</p>
        <p className="mt-1 text-sm font-semibold text-ink">{PLAN_LABELS[plan.plan]}</p>
        <p className="mt-3 text-xs text-quiet">
          {plan.scans_used} of {plan.scans_limit} automatic scans used this month
        </p>
        {/* The sentence above says the numbers; the bar only shows them. */}
        <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
          <div
            className={`h-full rounded-full ${used >= plan.scans_limit ? "bg-amber" : "bg-ledger"}`}
            style={{ width: `${plan.scans_limit ? (used / plan.scans_limit) * 100 : 0}%` }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          askToUpgrade({
            code: "upgrade_required",
            feature: "plans",
            plan: NEXT[plan.plan],
            message: "Compare what each plan includes.",
          })
        }
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-[var(--raised)]"
      >
        See plans
      </button>
    </div>
  );
}

/** In the upload dialog: how many automatic scans are left, and what happens when none are. */
export function ScansLeft() {
  const [plan, setPlan] = useState<PlanOut | null>(null);

  useEffect(() => {
    api<PlanOut>("/v1/plan")
      .then(setPlan)
      .catch(() => setPlan(null)); // not essential: uploading works without it
  }, []);

  if (!plan?.automatic_reading) return null;
  const left = Math.max(0, plan.scans_limit - plan.scans_used);
  if (left > 0)
    return (
      <p className="mt-2 text-xs text-quiet">
        {left} of {plan.scans_limit} automatic scans left this month.
      </p>
    );
  return (
    <div className="mt-3 rounded-md border border-amber/20 bg-amber-soft p-3 text-sm text-ink">
      <p>
        <span className="font-semibold text-amber">No automatic scans left this month.</span> You can still
        upload; you'll type the details in yourself.
      </p>
      <button
        type="button"
        onClick={() =>
          askToUpgrade({
            code: "upgrade_required",
            feature: "scans",
            plan: NEXT[plan.plan],
            message: "More automatic scans each month come with a bigger plan.",
          })
        }
        className="mt-2 font-semibold text-ledger hover:underline"
      >
        See plans
      </button>
    </div>
  );
}
