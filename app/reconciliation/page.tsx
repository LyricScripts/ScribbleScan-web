"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/src/api/client";
import { useDemo } from "@/src/components/demo-context";
import { money } from "@/src/lib/demo-data";

type Candidate = {
  document_id: string;
  merchant: string | null;
  total: number;
  date: string;
  day_delta: number;
  description_match: boolean;
};
type StatementTransaction = {
  transaction_index: number;
  date: string;
  description: string | null;
  debit: number;
  status: "suggested" | "ambiguous" | "unmatched";
  suggested_document_id: string | null;
  candidates: Candidate[];
};
type Statement = {
  id: string;
  filename: string;
  period_start: string | null;
  period_end: string | null;
  currency: string | null;
  transactions: StatementTransaction[];
};
type Reconciliation = {
  statements: Statement[];
  unmatched_receipts: { document_id: string; merchant: string | null; total: number | null; date: string | null }[];
};

export default function ReconciliationPage() {
  const { activeSpace, activeSpaceId, currency, source } = useDemo();
  const [result, setResult] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (source !== "connected") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void api<Reconciliation>(`/v1/spaces/${activeSpaceId}/reconciliation`).then((value) => {
      if (!cancelled) setResult(value);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Couldn't load reconciliation suggestions.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSpaceId, source]);

  const transactions = result?.statements.flatMap((statement) => statement.transactions.map((row) => ({ ...row, statement }))) ?? [];
  const suggestedCount = transactions.filter((row) => row.status === "suggested").length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-quiet">{activeSpace} · Receipts and bank activity</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Reconciliation</h1>
        <p className="mt-1 max-w-2xl text-quiet">Compare statement withdrawals with confirmed receipts. Suggestions use amount and date; review each one before relying on it.</p>
      </header>

      {source !== "connected" ? <section className="rounded-2xl border border-line bg-card p-6 text-sm text-quiet">
        Connect a live account to compare bank statements and receipts.
      </section> : null}
      {loading ? <p role="status" className="rounded-xl border border-line bg-card p-5 text-sm text-quiet">Loading statement matches…</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-stamp/30 bg-card p-5 text-sm text-stamp">{error}</p> : null}
      {source === "connected" && !loading && !error && result ? <>
        {result.statements.length === 0 ? <section className="rounded-2xl border border-line bg-card p-6">
          <h2 className="font-semibold text-ink">Add a bank statement to begin</h2>
          <p className="mt-1 text-sm text-quiet">Choose <strong>Bank statement</strong> from the Add a document dialog. Once you review and confirm it, matching suggestions will appear here.</p>
        </section> : <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-card p-4"><p className="text-sm text-quiet">Statements</p><p className="mt-1 text-2xl font-bold text-ink">{result.statements.length}</p></div>
            <div className="rounded-xl border border-line bg-card p-4"><p className="text-sm text-quiet">Suggested matches</p><p className="mt-1 text-2xl font-bold text-ledger">{suggestedCount}</p></div>
            <div className="rounded-xl border border-line bg-card p-4"><p className="text-sm text-quiet">Receipts without a candidate</p><p className="mt-1 text-2xl font-bold text-ink">{result.unmatched_receipts.length}</p></div>
          </section>
          {result.statements.map((statement) => <section key={statement.id} className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-ink">{statement.filename}</h2>
              <p className="mt-1 text-sm text-quiet">{statement.period_start ?? "Unknown start"} – {statement.period_end ?? "Unknown end"} · {statement.currency ?? currency}</p>
            </div>
            {statement.transactions.length ? <div className="divide-y divide-line">
              {statement.transactions.map((row) => <article key={`${statement.id}-${row.transaction_index}`} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{row.description || "Statement withdrawal"}</p>
                  <p className="mt-0.5 text-sm text-quiet">{row.date} · {money(row.debit, statement.currency ?? currency)}</p>
                  {row.candidates.length ? <div className="mt-3 space-y-2">
                    {row.candidates.map((candidate) => <p key={candidate.document_id} className="text-sm text-quiet">
                      {row.status === "suggested" ? "Suggested: " : "Possible match: "}
                      <Link href={`/receipts/${candidate.document_id}`} className="font-semibold text-ledger hover:underline">{candidate.merchant || "Receipt"}</Link>
                      {" · "}{money(candidate.total, statement.currency ?? currency)} · {candidate.date}
                      {candidate.description_match ? " · name matches" : ""}
                    </p>)}
                  </div> : <p className="mt-2 text-sm text-quiet">No receipt with the same amount and nearby date.</p>}
                </div>
                <span className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${row.status === "suggested" ? "bg-ledger-soft text-ledger" : row.status === "ambiguous" ? "bg-amber-soft text-amber" : "bg-[var(--raised)] text-quiet"}`}>
                  {row.status === "suggested" ? "Review suggestion" : row.status === "ambiguous" ? "Multiple candidates" : "Unmatched"}
                </span>
              </article>)}
            </div> : <p className="px-5 py-6 text-sm text-quiet">No dated withdrawals were found in this statement.</p>}
          </section>)}
          {result.unmatched_receipts.length ? <section className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="border-b border-line px-5 py-4 sm:px-6"><h2 className="font-semibold text-ink">Receipts with no statement candidate</h2></div>
            <ul className="divide-y divide-line">
              {result.unmatched_receipts.map((receipt) => <li key={receipt.document_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6">
                <Link href={`/receipts/${receipt.document_id}`} className="font-medium text-ledger hover:underline">{receipt.merchant || "Receipt"}</Link>
                <span className="text-sm text-quiet">{receipt.date ?? "Date unknown"} · {receipt.total == null ? "Amount unknown" : money(receipt.total, currency)}</span>
              </li>)}
            </ul>
          </section> : null}
        </>
        }
      </> : null}
    </div>
  );
}
