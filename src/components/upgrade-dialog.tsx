"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/src/api/client";
import type { PlanOut } from "@/src/api/types";
import { money } from "@/src/format";
import { onUpgradeAsked, PLAN_LABELS, type PlanName, planFeatures, type UpgradeRequired } from "@/src/plan";

// One upgrade prompt for every limit: the API's 402 answers (and "See plans" buttons) open it
// through the "ss:upgrade" event. Until payments are built in, upgrading is an email to us.

export function UpgradeDialog() {
  const [asked, setAsked] = useState<UpgradeRequired | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [loadError, setLoadError] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      onUpgradeAsked((detail) => {
        setAsked(detail);
        setLoadError("");
        api<PlanOut>("/v1/plan")
          .then(setPlan)
          .catch(() => setLoadError("Couldn't load the plans. Try again in a moment."));
      }),
    [],
  );

  useEffect(() => {
    if (!asked) return;
    closeButton.current?.focus();
    // Capture, and stop the key there: this dialog can sit on top of the upload dialog,
    // and Escape should close only the top one.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setAsked(null);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [asked]);

  if (!asked) return null;
  const order: PlanName[] = ["free", "plus", "business", "accountant"];
  const current = plan ? order.indexOf(plan.plan) : 0;
  const choices = plan?.plans.filter((info) => order.indexOf(info.name) > current) ?? [];

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="max-h-[min(92vh,48rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-line bg-card shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id="upgrade-title" className="text-lg font-semibold tracking-tight text-ink">
              {asked.feature === "plans" ? "Plans" : `Upgrade to ${PLAN_LABELS[asked.plan]}`}
            </h2>
            <p className="mt-1 text-sm text-quiet">{asked.message}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={() => setAsked(null)}
            aria-label="Close plans"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-quiet transition hover:bg-[var(--raised)] hover:text-ink"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="p-5 sm:p-6">
          {loadError ? (
            <p role="alert" className="text-sm text-stamp">
              {loadError}
            </p>
          ) : null}
          {!plan && !loadError ? (
            <p role="status" className="text-sm text-quiet">
              Loading plans…
            </p>
          ) : null}
          {plan ? (
            <>
              <p className="text-sm text-quiet">
                You're on <span className="font-semibold text-ink">{PLAN_LABELS[plan.plan]}</span>:{" "}
                {plan.scans_used} of {plan.scans_limit} automatic scans used this month.
              </p>
              {choices.length ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                  {choices.map((info) => {
                    const suggested = info.name === asked.plan;
                    return (
                      <li
                        key={info.name}
                        className={`rounded-lg border p-4 ${suggested ? "border-ledger bg-ledger-soft/40" : "border-line"}`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-semibold text-ink">{PLAN_LABELS[info.name]}</h3>
                          {suggested ? (
                            <span className="text-xs font-semibold text-ledger">Suggested</span>
                          ) : null}
                        </div>
                        {info.price_monthly != null ? (
                          <p className="mt-1 text-sm text-ink">
                            <span className="text-lg font-semibold">
                              {money(info.price_monthly, plan.currency)}
                            </span>
                            <span className="text-quiet"> / month</span>
                          </p>
                        ) : null}
                        {info.price_yearly != null ? (
                          <p className="text-xs text-quiet">
                            or {money(info.price_yearly, plan.currency)} a year
                          </p>
                        ) : null}
                        <ul className="mt-3 space-y-1 text-sm text-quiet">
                          {planFeatures(info).map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-quiet">You're on the largest plan.</p>
              )}
              <div className="mt-5 border-t border-line pt-4">
                {plan.upgrade_contact && choices.length ? (
                  <a
                    href={`mailto:${plan.upgrade_contact}?subject=${encodeURIComponent(`Upgrade to ${PLAN_LABELS[asked.plan]}`)}`}
                    className="inline-flex rounded-lg bg-ledger-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5948]"
                  >
                    Email us to upgrade
                  </a>
                ) : null}
                {!plan.upgrade_contact && choices.length ? (
                  <p className="text-sm text-quiet">
                    Upgrades open soon. Everything you've saved stays as it is.
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-quiet">
                  Typing receipt details in yourself is never limited; plans only change automatic reading and
                  extras.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
