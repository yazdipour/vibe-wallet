export type Account = { id: number; name: string };
export type Category = { id: number; name: string; icon: string; color: string; icon_color: string };
export type Rule = { id: number; field: string; match_type: string; pattern: string; category_id: number };
export type CategorizeLogEntry = {
  tx_id: number; partner: string; category: string; source: string; reason: string;
};
export type LLMHealth = { status: string; message: string };
export type Tx = {
  id: number; account_id: number; booking_date: string; partner_name: string;
  partner_iban: string; type: string; payment_reference: string;
  amount_eur: number; categorized_by: string; account_name: string; category_name: string;
};

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? (undefined as T) : r.json();
}

export const api = {
  accounts: () => fetch("/api/accounts").then(j<Account[]>),
  transactions: (accountId?: number) =>
    fetch(`/api/transactions${accountId ? `?account_id=${accountId}` : ""}`).then(j<Tx[]>),
  setTransactionCategory: (id: number, categoryId: number) =>
    fetch(`/api/transactions/${id}/category`, {
      method: "PUT", body: JSON.stringify({ category_id: categoryId }),
      headers: { "Content-Type": "application/json" },
    }).then(j<void>),
  deleteTransaction: (id: number) => fetch(`/api/transactions/${id}`, { method: "DELETE" }).then(j<void>),
  deleteAccount: (id: number) => fetch(`/api/accounts/${id}`, { method: "DELETE" }).then(j<void>),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch("/api/upload", { method: "POST", body: fd }).then(j<{ inserted: number }>);
  },
  categories: () => fetch("/api/categories").then(j<Category[]>),
  createCategory: (input: { name: string; icon: string; color: string; icon_color: string }) =>
    fetch("/api/categories", { method: "POST", body: JSON.stringify(input), headers: { "Content-Type": "application/json" } }).then(j<Category>),
  updateCategoryAppearance: (id: number, input: { icon: string; color: string; icon_color: string }) =>
    fetch(`/api/categories/${id}`, {
      method: "PUT", body: JSON.stringify(input), headers: { "Content-Type": "application/json" },
    }).then(j<Category>),
  rules: () => fetch("/api/rules").then(j<Rule[]>),
  createRule: (r: Omit<Rule, "id">) =>
    fetch("/api/rules", { method: "POST", body: JSON.stringify(r), headers: { "Content-Type": "application/json" } }).then(j<Rule>),
  deleteRule: (id: number) => fetch(`/api/rules/${id}`, { method: "DELETE" }).then(j<void>),
  getSettings: () => fetch("/api/settings").then(j<Record<string, string>>),
  llmHealth: () => fetch("/api/llm/health").then(j<LLMHealth>),
  putSettings: (kv: Record<string, string>) =>
    fetch("/api/settings", { method: "PUT", body: JSON.stringify(kv), headers: { "Content-Type": "application/json" } }).then(j<void>),
};
