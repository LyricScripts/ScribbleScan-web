"use client";

import Link from "next/link";
import { useDemo } from "@/src/components/demo-context";

export default function SpacesPage() {
  const { activeSpace, spaces, selectSpace, source } = useDemo();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-quiet">Keep different budgets separate</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Spaces</h1>
          <p className="mt-1 text-quiet">Choose a space for home, a shop, or another set of spending.</p>
        </div>
        <Link
          href="/spaces/new"
          className="inline-flex w-fit rounded-lg bg-ledger-button px-4 py-2.5 font-semibold text-white transition hover:bg-[#0a5948]"
        >
          Create a space
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {spaces.map((space) => (
          <section
            key={space.id}
            className={`rounded-2xl border bg-card p-5 sm:p-6 ${space.name === activeSpace ? "border-ledger ring-1 ring-ledger" : "border-line"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-ledger-soft text-ledger">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d={
                      space.kind === "personal"
                        ? "M3 10.5 12 3l9 7.5V21H3V10.5Zm6 10v-6h6v6"
                        : "M3 21h18M5 21V8l7-4 7 4v13M9 10h.01M15 10h.01M9 14h.01M15 14h.01"
                    }
                  />
                </svg>
              </div>
              {space.name === activeSpace ? (
                <span className="rounded-full bg-ledger-soft px-3 py-1 text-xs font-semibold text-ledger">
                  Current space
                </span>
              ) : null}
            </div>
            <h2 className="mt-4 text-lg font-bold text-ink">{space.name}</h2>
            <p className="mt-1 text-sm text-quiet">
              {space.kind === "personal" ? "Personal spending" : "Business spending and budgets"}
            </p>
            {space.name !== activeSpace ? (
              <button
                type="button"
                onClick={() => selectSpace(space.name)}
                className="mt-5 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
              >
                Switch to this space
              </button>
            ) : null}
          </section>
        ))}
      </div>
      {source === "sample" ? (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-quiet">
          Sample mode: spaces are temporary and will reset when you reload.
        </p>
      ) : null}
    </div>
  );
}
