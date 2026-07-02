import type { Tx, Category } from "./api.ts";

export type MonthlyTotals = { month: string; income: number; expenses: number };
export type CategorySlice = { name: string; value: number };
export type Summary = { income: number; expenses: number; net: number };

export function filterTransactions(
  txns: Tx[],
  accountId: string,
  from: string,
  to: string,
): Tx[] {
  return txns.filter((t) => {
    if (t.category_name === "Ignore") return false;
    if (accountId !== "all" && String(t.account_id) !== accountId) return false;
    if (from && t.booking_date < from) return false;
    if (to && t.booking_date > to) return false;
    return true;
  });
}

function buildKindMap(categories: Category[]): Map<string, "income" | "expense"> {
  return new Map(categories.map((c) => [c.name, c.kind]));
}

// A transaction's kind comes from its category when it has one; an
// uncategorized transaction (category_name === "") falls back to its raw
// amount sign, since there's no category to look up.
function kindOf(t: Tx, kindByName: Map<string, "income" | "expense">): "income" | "expense" {
  const kind = kindByName.get(t.category_name);
  if (kind) return kind;
  return t.amount_eur > 0 ? "income" : "expense";
}

export function summarize(txns: Tx[], categories: Category[]): Summary {
  const kindByName = buildKindMap(categories);
  let income = 0;
  let expenses = 0;
  for (const t of txns) {
    if (kindOf(t, kindByName) === "income") income += t.amount_eur;
    else expenses += t.amount_eur;
  }
  return { income, expenses, net: income + expenses };
}

export function monthlyTotals(txns: Tx[], categories: Category[]): MonthlyTotals[] {
  const kindByName = buildKindMap(categories);
  const byMonth = new Map<string, MonthlyTotals>();
  for (const t of txns) {
    const month = t.booking_date.slice(0, 7);
    const bucket = byMonth.get(month) ?? { month, income: 0, expenses: 0 };
    if (kindOf(t, kindByName) === "income") bucket.income += t.amount_eur;
    else bucket.expenses += -t.amount_eur;
    byMonth.set(month, bucket);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function categoryTotals(txns: Tx[], categories: Category[], sign: "income" | "expense"): CategorySlice[] {
  const kindByName = buildKindMap(categories);
  const filtered = txns.filter((t) => kindOf(t, kindByName) === sign);
  const byCategory = new Map<string, number>();
  for (const t of filtered) {
    const name = t.category_name || "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Math.abs(t.amount_eur));
  }
  return [...byCategory.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
}
