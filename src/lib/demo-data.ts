export type Category = {
  key: string;
  name: string;
  amount: number;
  budget: number;
  color: string;
};

export type Receipt = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  status: "Ready" | "Needs review" | "Processing" | "Unreadable";
};

export const categories: Category[] = [
  { key: "food", name: "Food", amount: 12_480, budget: 16_000, color: "#ff4e58" },
  { key: "groceries", name: "Groceries", amount: 8_560, budget: 12_000, color: "#ffbf3c" },
  { key: "transport", name: "Transport", amount: 3_720, budget: 5_000, color: "#68b4ff" },
  { key: "utilities", name: "Utilities", amount: 3_640, budget: 5_500, color: "#ff8b52" },
  { key: "medicine", name: "Medicine", amount: 2_650, budget: 4_000, color: "#a78bfa" },
  { key: "shopping", name: "Shopping", amount: 1_900, budget: 4_500, color: "#f079ae" },
  { key: "other", name: "Other", amount: 1_870, budget: 6_000, color: "#f3f4f6" },
];

export const receipts: Receipt[] = [
  {
    id: "rcp-1042",
    merchant: "Dhanmondi Kitchen",
    category: "Food",
    amount: 860,
    date: "2026-10-20",
    status: "Needs review",
  },
  {
    id: "rcp-1041",
    merchant: "Agora",
    category: "Groceries",
    amount: 2_450,
    date: "2026-10-19",
    status: "Ready",
  },
  {
    id: "rcp-1040",
    merchant: "Pathao",
    category: "Transport",
    amount: 320,
    date: "2026-10-18",
    status: "Ready",
  },
  {
    id: "rcp-1039",
    merchant: "Shwapno",
    category: "Groceries",
    amount: 1_830,
    date: "2026-10-17",
    status: "Ready",
  },
  {
    id: "rcp-1038",
    merchant: "Lazz Pharma",
    category: "Medicine",
    amount: 2_650,
    date: "2026-10-16",
    status: "Needs review",
  },
  {
    id: "rcp-1037",
    merchant: "Titas Gas",
    category: "Utilities",
    amount: 1_000,
    date: "2026-10-15",
    status: "Ready",
  },
  {
    id: "rcp-1036",
    merchant: "Bengal Boi",
    category: "Shopping",
    amount: 1_900,
    date: "2026-10-12",
    status: "Ready",
  },
  {
    id: "rcp-1035",
    merchant: "Star Kabab",
    category: "Food",
    amount: 11_620,
    date: "2026-10-11",
    status: "Ready",
  },
  {
    id: "rcp-1034",
    merchant: "Agora",
    category: "Groceries",
    amount: 4_280,
    date: "2026-10-10",
    status: "Ready",
  },
  {
    id: "rcp-1033",
    merchant: "Pathao",
    category: "Transport",
    amount: 3_400,
    date: "2026-10-09",
    status: "Ready",
  },
  {
    id: "rcp-1032",
    merchant: "DESCO",
    category: "Utilities",
    amount: 2_640,
    date: "2026-10-08",
    status: "Ready",
  },
  {
    id: "rcp-1031",
    merchant: "Stationery House",
    category: "Other",
    amount: 1_870,
    date: "2026-10-07",
    status: "Ready",
  },
];

export const budgetTotal = categories.reduce((sum, category) => sum + category.budget, 0);
export const spentTotal = categories.reduce((sum, category) => sum + category.amount, 0);

const currencySymbol: Record<string, string> = {
  BDT: "৳",
  INR: "₹",
  PKR: "Rs ",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function money(amount: number, currency = "BDT"): string {
  const symbol = currencySymbol[currency] ?? `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function monthName(month: Date = new Date()): string {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month);
}

export function dateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${isoDate}T12:00:00`),
  );
}
