import { test } from "node:test";
import assert from "node:assert/strict";
import type { Tx, Category } from "./api.ts";
import {
  filterTransactions,
  summarize,
  monthlyTotals,
  categoryTotals,
} from "./visualization.ts";

function mkTx(partial: Partial<Tx>): Tx {
  return {
    id: 1,
    account_id: 1,
    booking_date: "2026-01-01",
    partner_name: "Test Partner",
    partner_iban: "AT000",
    type: "Card Payment",
    payment_reference: "",
    amount_eur: -10,
    categorized_by: "",
    account_name: "Main",
    category_name: "",
    ...partial,
  };
}

function mkCategory(partial: Partial<Category>): Category {
  return {
    id: 1, name: "Misc", icon: "Tag", color: "#000000", icon_color: "#ffffff", kind: "expense",
    ...partial,
  };
}

const categories: Category[] = [
  mkCategory({ id: 1, name: "Groceries", kind: "expense" }),
  mkCategory({ id: 2, name: "Rent", kind: "expense" }),
  mkCategory({ id: 3, name: "Salary", kind: "income" }),
  mkCategory({ id: 4, name: "Misc", kind: "expense" }),
];

test("filterTransactions: account filter", () => {
  const txns = [mkTx({ id: 1, account_id: 1 }), mkTx({ id: 2, account_id: 2 })];
  const result = filterTransactions(txns, "1", "", "");
  assert.deepEqual(result.map((t) => t.id), [1]);
});

test("filterTransactions: 'all' keeps every account", () => {
  const txns = [mkTx({ id: 1, account_id: 1 }), mkTx({ id: 2, account_id: 2 })];
  const result = filterTransactions(txns, "all", "", "");
  assert.equal(result.length, 2);
});

test("filterTransactions: excludes Ignore-categorized rows", () => {
  const txns = [
    mkTx({ id: 1, category_name: "Groceries" }),
    mkTx({ id: 2, category_name: "Ignore" }),
    mkTx({ id: 3, category_name: "" }),
  ];
  const result = filterTransactions(txns, "all", "", "");
  assert.deepEqual(result.map((t) => t.id), [1, 3]);
});

test("filterTransactions: date range is inclusive on both ends", () => {
  const txns = [
    mkTx({ id: 1, booking_date: "2026-01-01" }),
    mkTx({ id: 2, booking_date: "2026-01-15" }),
    mkTx({ id: 3, booking_date: "2026-02-01" }),
  ];
  const result = filterTransactions(txns, "all", "2026-01-01", "2026-01-15");
  assert.deepEqual(result.map((t) => t.id), [1, 2]);
});

test("summarize: splits by category kind, not raw amount sign", () => {
  const txns = [
    mkTx({ amount_eur: 100, category_name: "Salary" }),
    mkTx({ amount_eur: -40, category_name: "Groceries" }),
    mkTx({ amount_eur: -10, category_name: "Rent" }),
  ];
  const result = summarize(txns, categories);
  assert.deepEqual(result, { income: 100, expenses: -50, net: 50 });
});

test("summarize: uncategorized transactions fall back to amount sign", () => {
  const txns = [
    mkTx({ amount_eur: 50, category_name: "" }),
    mkTx({ amount_eur: -20, category_name: "" }),
  ];
  const result = summarize(txns, categories);
  assert.deepEqual(result, { income: 50, expenses: -20, net: 30 });
});

test("summarize: a positive-amount transaction in an expense category still counts as expense (e.g. a refund)", () => {
  const txns = [
    mkTx({ amount_eur: -40, category_name: "Groceries" }),
    mkTx({ amount_eur: 10, category_name: "Groceries" }), // refund, still an expense-kind category
  ];
  const result = summarize(txns, categories);
  assert.deepEqual(result, { income: 0, expenses: -30, net: -30 });
});

test("summarize: empty input gives zeros", () => {
  assert.deepEqual(summarize([], categories), { income: 0, expenses: 0, net: 0 });
});

test("monthlyTotals: buckets by YYYY-MM and sums magnitudes, sorted ascending", () => {
  const txns = [
    mkTx({ booking_date: "2026-02-05", amount_eur: -20, category_name: "Groceries" }),
    mkTx({ booking_date: "2026-01-10", amount_eur: 50, category_name: "Salary" }),
    mkTx({ booking_date: "2026-01-20", amount_eur: -5, category_name: "Rent" }),
  ];
  const result = monthlyTotals(txns, categories);
  assert.deepEqual(result, [
    { month: "2026-01", income: 50, expenses: 5 },
    { month: "2026-02", income: 0, expenses: 20 },
  ]);
});

test("categoryTotals: groups expenses by category, uses absolute value, sorted descending", () => {
  const txns = [
    mkTx({ amount_eur: -30, category_name: "Groceries" }),
    mkTx({ amount_eur: -10, category_name: "Groceries" }),
    mkTx({ amount_eur: -50, category_name: "Rent" }),
    mkTx({ amount_eur: 1000, category_name: "Salary" }), // income, excluded
  ];
  const result = categoryTotals(txns, categories, "expense");
  assert.deepEqual(result, [
    { name: "Rent", value: 50 },
    { name: "Groceries", value: 40 },
  ]);
});

test("categoryTotals: uncategorized rows group into 'Uncategorized'", () => {
  const txns = [
    mkTx({ amount_eur: -30, category_name: "" }),
    mkTx({ amount_eur: -20, category_name: "" }),
  ];
  const result = categoryTotals(txns, categories, "expense");
  assert.deepEqual(result, [{ name: "Uncategorized", value: 50 }]);
});

test("categoryTotals: income sign only includes income-kind categories", () => {
  const txns = [
    mkTx({ amount_eur: 500, category_name: "Salary" }),
    mkTx({ amount_eur: -30, category_name: "Groceries" }),
  ];
  const result = categoryTotals(txns, categories, "income");
  assert.deepEqual(result, [{ name: "Salary", value: 500 }]);
});

test("categoryTotals: rounds away floating-point drift from repeated addition", () => {
  const txns: Tx[] = [];
  // 0.1 + 0.2 repeated many times accumulates float drift in plain JS addition
  for (let i = 0; i < 20; i++) {
    txns.push(mkTx({ id: i, amount_eur: -0.1, category_name: "Misc" }));
    txns.push(mkTx({ id: 100 + i, amount_eur: -0.2, category_name: "Misc" }));
  }
  const result = categoryTotals(txns, categories, "expense");
  assert.equal(result.length, 1);
  // 20*(0.1+0.2) = 6 exactly; without rounding this would be something like 5.999999999999999
  assert.equal(result[0].value, 6);
});
