// Formatting for Bangladesh-first money and dates. The API sends ISO dates and plain numbers;
// people see lakh grouping, the taka sign and day-first dates.

const SYMBOL: Record<string, string> = { BDT: "৳", INR: "₹", PKR: "Rs", USD: "$", EUR: "€", GBP: "£" };

export const currencySymbol = (currency: string) => SYMBOL[currency] ?? currency;

/** 125000 -> "৳1,25,000" (Indian/Bangladeshi lakh grouping). */
export function money(n: number | null | undefined, currency: string, { sign = true } = {}): string {
  if (n == null) return "—";
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  return sign ? `${SYMBOL[currency] ?? `${currency} `}${s}` : s;
}

/** "2026-10" -> "October 2026" */
export function monthLabel(month: string): string {
  const [y = 0, m = 1] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** shiftMonth("2026-01", -1) === "2025-12" */
export function shiftMonth(month: string, by: number): string {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const t = new Date(y, m - 1 + by, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/** The month on the user's own clock (not UTC: just after midnight in Dhaka is still yesterday in UTC). */
export function thisMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10-16" -> "Fri, 16 Oct" */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "No date";
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export const nice = (s: string) => s.replace(/_/g, " ");
export const title = (s: string) => {
  const t = nice(s);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** "2026-10-05" -> "05/10/2026". Native date inputs show US order in many browsers, so dates are text. */
export const toDMY = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso;

/** "5/10/2026" or "05.10.2026" -> "2026-10-05"; anything else is returned as typed. */
export function toISO(dmy: string): string {
  const m = dmy.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2]?.padStart(2, "0")}-${m[1]?.padStart(2, "0")}` : dmy;
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** What people type for an amount: "৳১,২৫০", "1,250 Tk", "1250/-" -> 1250. Unreadable input comes back as text. */
export function parseAmount(typed: string): number | string {
  const n = Number(
    typed.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d))).replace(/[৳,\s]|Tk\.?|BDT|\/-/gi, ""),
  );
  return typed.trim() && Number.isFinite(n) ? n : typed;
}
