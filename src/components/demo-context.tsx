"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, isDemoSession, session } from "@/src/api/client";
import type { ClientConfig, DocumentOut, Expenses, SpaceOut, Summary } from "@/src/api/types";
import { thisMonth, title } from "@/src/format";
import { store } from "@/src/store";
import { categories as sampleCategories, receipts as sampleReceipts, spentTotal as sampleSpent, budgetTotal as sampleBudget, type Category, type Receipt } from "@/src/lib/demo-data";

type Space = Pick<SpaceOut, "id" | "name" | "kind" | "currency">;
type DataSource = "sample" | "connected";
type AppData = {
  source: DataSource;
  loading: boolean;
  activeSpace: string;
  activeSpaceId: string;
  currency: string;
  spaces: Space[];
  categories: Category[];
  receipts: Receipt[];
  spentTotal: number;
  budgetTotal: number;
  documentCount: number;
  needsReview: number;
  lastMonthTotal: number;
  changePct: number | null;
  month: string;
  selectSpace: (name: string) => void;
  setMonth: (month: string) => void;
  addSpace: (name: string, kind?: "personal" | "business") => Promise<void>;
  saveBudgets: (budgets: Record<string, number>) => Promise<void>;
  updateReceipt: (id: string, updates: Partial<Pick<Receipt, "merchant" | "category" | "amount">>) => void;
  downloadCsv: () => void;
  refresh: () => Promise<void>;
  upload: (spaceId: string, file: File, docType?: "receipt" | "bank_statement") => Promise<DocumentOut>;
};

const colorByCategory: Record<string, string> = Object.fromEntries(sampleCategories.map((category) => [category.name.toLowerCase(), category.color]));

const sampleSpaces: Space[] = [
  { id: "sample-personal", name: "Personal", kind: "personal", currency: "BDT" },
  { id: "sample-shop", name: "Demo shop", kind: "business", currency: "BDT" },
];

type DataState = Omit<AppData, "selectSpace" | "setMonth" | "addSpace" | "saveBudgets" | "updateReceipt" | "downloadCsv" | "refresh" | "upload">;

const initialData: DataState = {
  source: "sample" as DataSource,
  loading: true,
  activeSpace: "Personal",
  activeSpaceId: sampleSpaces[0]?.id ?? "sample-personal",
  currency: "BDT",
  spaces: sampleSpaces,
  categories: sampleCategories,
  receipts: sampleReceipts,
  spentTotal: sampleSpent,
  budgetTotal: sampleBudget,
  documentCount: sampleReceipts.length,
  needsReview: sampleReceipts.filter((receipt) => receipt.status === "Needs review").length,
  lastMonthTotal: 38_140,
  changePct: -8.7,
  month: "2026-10",
};

const AppDataContext = createContext<AppData | null>(null);

function statusLabel(status: DocumentOut["status"]): Receipt["status"] {
  if (status === "ready") return "Ready";
  if (status === "needs_review") return "Needs review";
  if (status === "processing") return "Processing";
  return "Unreadable";
}

function mapReceipt(document: DocumentOut): Receipt {
  return {
    id: document.id,
    merchant: document.merchant ?? document.filename,
    category: title(document.category ?? document.doc_type),
    amount: document.total ?? 0,
    date: document.date ?? document.created_at.slice(0, 10),
    status: statusLabel(document.status),
  };
}

function mapCategories(summary: Summary): Category[] {
  return summary.categories.map((item) => ({
    key: item.category,
    name: title(item.category),
    amount: item.spent,
    budget: item.budget ?? 0,
    color: colorByCategory[item.category.toLowerCase()] ?? "#9aa6a8",
  }));
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initialData);

  const loadLive = useCallback(async (preferredSpace?: string, preferredMonth?: string) => {
    setData((current) => ({ ...current, loading: true }));
    try {
      const config = await api<ClientConfig>("/v1/config");
      session.config = config;
      if (!session.token) throw new Error("Sign in to load account data");

      const spaces = await api<SpaceOut[]>("/v1/spaces");
      if (!spaces.length) throw new Error("No spaces found");
      const requested = preferredSpace ?? store.get("ss.space") ?? undefined;
      const active = spaces.find((space) => space.name === requested) ?? spaces[0];
      if (!active) throw new Error("No spaces found");
      const month = preferredMonth ?? thisMonth();
      const [summary, expenses] = await Promise.all([
        api<Summary>(`/v1/spaces/${active.id}/summary?month=${month}`),
        api<Expenses>(`/v1/spaces/${active.id}/expenses?month=${month}`),
      ]);
      const categories = mapCategories(summary);
      store.set("ss.space", active.id);
      setData({
        source: "connected",
        loading: false,
        activeSpace: active.name,
        activeSpaceId: active.id,
        currency: active.currency,
        spaces: spaces.map(({ id, name, kind, currency }) => ({ id, name, kind, currency })),
        categories,
        receipts: expenses.items.map(mapReceipt),
        spentTotal: summary.total,
        budgetTotal: categories.reduce((sum, category) => sum + category.budget, 0),
        documentCount: summary.documents,
        needsReview: summary.needs_review,
        lastMonthTotal: summary.last_month.total,
        changePct: summary.change_pct,
        month: summary.month,
      });
    } catch {
      setData({ ...initialData, source: "sample", loading: false });
    }
  }, []);

  useEffect(() => {
    if (isDemoSession()) {
      setData({ ...initialData, loading: false });
      return;
    }
    void loadLive();
  }, [loadLive]);

  const selectSpace = useCallback((name: string) => {
    setData((current) => ({ ...current, activeSpace: name }));
    if (data.source === "connected") void loadLive(name, data.month);
  }, [data.month, data.source, loadLive]);

  const setMonth = useCallback((month: string) => {
    setData((current) => ({ ...current, month }));
    if (data.source === "connected") void loadLive(data.activeSpace, month);
  }, [data.activeSpace, data.source, loadLive]);

  const addSpace = useCallback(async (name: string, kind: "personal" | "business" = "business") => {
    if (data.source === "connected") {
      await api<SpaceOut>("/v1/spaces", { method: "POST", body: { name, kind, currency: data.currency } });
      await loadLive(name, data.month);
      return;
    }
    const space: Space = { id: `sample-${crypto.randomUUID()}`, name, kind, currency: "BDT" };
    setData((current) => ({ ...current, spaces: [...current.spaces, space], activeSpace: name, activeSpaceId: space.id }));
  }, [data.currency, data.month, data.source, loadLive]);

  const saveBudgets = useCallback(async (budgets: Record<string, number>) => {
    if (data.source === "connected") {
      await api(`/v1/spaces/${data.activeSpaceId}/budgets`, { method: "PUT", body: { budgets } });
      await loadLive(data.activeSpace, data.month);
      return;
    }
    setData((current) => {
      const categories = current.categories.map((category) => ({ ...category, budget: budgets[category.key] ?? 0 }));
      return { ...current, categories, budgetTotal: categories.reduce((sum, category) => sum + category.budget, 0) };
    });
  }, [data.activeSpace, data.activeSpaceId, data.month, data.source, loadLive]);

  const updateReceipt = useCallback((id: string, updates: Partial<Pick<Receipt, "merchant" | "category" | "amount">>) => {
    setData((current) => ({ ...current, receipts: current.receipts.map((receipt) => receipt.id === id ? { ...receipt, ...updates } : receipt) }));
  }, []);

  const upload = useCallback(async (spaceId: string, file: File, docType: "receipt" | "bank_statement" = "receipt") => {
    const { uploadFile } = await import("@/src/api/client");
    return uploadFile(spaceId, file, undefined, docType);
  }, []);

  const downloadCsv = useCallback(() => {
    const rows: (string | number)[][] = [
      ["Date", "Merchant", "Category", "Amount", "Status"],
      ...data.receipts.map((receipt) => [receipt.date, receipt.merchant, receipt.category, receipt.amount, receipt.status]),
    ];
    const csv = rows.map((row) => row.map((value) => {
      const raw = String(value);
      const safe = /^[=+@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    }).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.activeSpace.replaceAll(/[^\p{L}\p{N}-]+/gu, "-")}-${data.month}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [data.activeSpace, data.month, data.receipts]);

  const value = useMemo<AppData>(() => ({
    ...data,
    selectSpace,
    setMonth,
    addSpace,
    saveBudgets,
    updateReceipt,
    downloadCsv,
    refresh: () => loadLive(data.activeSpace, data.month),
    upload,
  }), [data, selectSpace, setMonth, addSpace, saveBudgets, updateReceipt, downloadCsv, loadLive, upload]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useDemo() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider");
  return value;
}
