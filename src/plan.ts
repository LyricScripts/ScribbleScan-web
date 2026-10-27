// Plans: what the account is on, this month's automatic scans, and the upgrade prompt.
// The API answers 402 {code: "upgrade_required", feature, plan, message} whenever something
// needs a bigger plan; the client turns that into one event the upgrade dialog listens for.

import type { PlanInfo, PlanOut } from "./api/types";

export type PlanName = PlanOut["plan"];

export const PLAN_LABELS: Record<PlanName, string> = {
  free: "Free",
  plus: "Plus",
  business: "Business",
  accountant: "Accountant",
};

export interface UpgradeRequired {
  code: "upgrade_required";
  feature: string;
  plan: PlanName;
  message: string;
}

const UPGRADE_EVENT = "ss:upgrade";

export function isUpgradeRequired(detail: unknown): detail is UpgradeRequired {
  return (detail as UpgradeRequired | null)?.code === "upgrade_required";
}

/** Ask the app to show the upgrade dialog. */
export function askToUpgrade(detail: UpgradeRequired): void {
  window.dispatchEvent(new CustomEvent<UpgradeRequired>(UPGRADE_EVENT, { detail }));
}

export function onUpgradeAsked(listener: (detail: UpgradeRequired) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<UpgradeRequired>).detail);
  window.addEventListener(UPGRADE_EVENT, handle);
  return () => window.removeEventListener(UPGRADE_EVENT, handle);
}

export const scansLeft = (plan: PlanOut) => Math.max(0, plan.scans_limit - plan.scans_used);

const DOC_NAMES: Record<string, string> = {
  receipt: "receipts",
  invoice: "invoices",
  bank_statement: "bank statements",
};

/** "Receipts, invoices and bank statements", from the types the plan actually includes. */
export function documentsLabel(docTypes: string[]): string {
  const order = Object.keys(DOC_NAMES);
  const names = [...docTypes]
    .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map((type) => DOC_NAMES[type] ?? `${type.replaceAll("_", " ")}s`);
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One line per plan for the comparison: what changes as you move up. */
export function planFeatures(info: PlanInfo): string[] {
  const docs = documentsLabel(info.doc_types);
  return [
    `${info.scans_per_month.toLocaleString("en-IN")} automatic scans a month`,
    info.business_spaces === 0
      ? "Personal space"
      : `Personal + ${info.business_spaces} business space${info.business_spaces > 1 ? "s" : ""}`,
    info.budget_categories == null
      ? "Budgets for every category"
      : `Budgets for ${info.budget_categories} categories`,
    docs,
    info.export_formats.includes("xlsx") ? "CSV and Excel export" : "CSV export",
  ];
}
