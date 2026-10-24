"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/src/components/demo-context";

export default function NewSpacePage() {
  const router = useRouter();
  const { addSpace } = useDemo();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"personal" | "business">("business");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/spaces" className="text-sm font-semibold text-ledger hover:underline">Back to spaces</Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Create a space</h1>
        <p className="mt-1 text-quiet">Give a set of spending its own name.</p>
      </div>
      <form onSubmit={async (event) => {
        event.preventDefault();
        const cleanName = name.trim();
        if (!cleanName) { setError("Enter a name for this space."); return; }
        setSaving(true);
        try {
          await addSpace(cleanName, kind);
          router.push("/spaces");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Couldn't create the space.");
          setSaving(false);
        }
      }} className="rounded-2xl border border-line bg-card p-5 sm:p-7">
        <label htmlFor="space-name" className="block text-sm font-semibold text-ink">Space name</label>
        <input id="space-name" autoFocus maxLength={80} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="For example, Family or Shop" className="mt-2 w-full rounded-lg border border-line bg-paper px-3.5 py-3 outline-none focus:border-ledger" />
        <label htmlFor="space-kind" className="mt-4 block text-sm font-semibold text-ink">Type</label>
        <select id="space-kind" value={kind} onChange={(event) => setKind(event.target.value as "personal" | "business")} className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-3 outline-none focus:border-ledger">
          <option value="personal">Personal</option>
          <option value="business">Business</option>
        </select>
        <p role="alert" className="mt-2 min-h-5 text-sm text-stamp">{error}</p>
        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={saving} className="rounded-lg bg-ledger-button px-5 py-2.5 font-semibold text-white transition hover:bg-[#0a5948] disabled:opacity-60">{saving ? "Creating…" : "Create space"}</button>
          <Link href="/spaces" className="rounded-lg border border-line px-5 py-2.5 font-semibold text-ink hover:bg-paper">Cancel</Link>
        </div>
        <p className="mt-5 border-t border-line pt-4 text-sm text-quiet">In sample mode, this space exists until you reload the page.</p>
      </form>
    </div>
  );
}
