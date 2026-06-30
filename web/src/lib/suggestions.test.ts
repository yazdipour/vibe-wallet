import { test } from "node:test";
import assert from "node:assert/strict";
import type { Tx, Rule, Category } from "./api.ts";
import { suggestRules } from "./suggestions.ts";

function mkTx(partial: Partial<Tx>): Tx {
  return {
    id: 1, account_id: 1, booking_date: "2026-01-01", partner_name: "Partner",
    partner_iban: "AT000", type: "Card Payment", payment_reference: "",
    amount_eur: -10, categorized_by: "", account_name: "Main", category_name: "",
    ...partial,
  };
}

const categories: Category[] = [{ id: 1, name: "Groceries" }, { id: 2, name: "Transport" }];

test("suggestRules: requires 2+ matching LLM categorizations", () => {
  const txns = [
    mkTx({ id: 1, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
  ];
  assert.deepEqual(suggestRules(txns, [], categories), []);
});

test("suggestRules: surfaces a suggestion at 2+ matches", () => {
  const txns = [
    mkTx({ id: 1, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
    mkTx({ id: 2, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
  ];
  assert.deepEqual(suggestRules(txns, [], categories), [
    { partnerName: "LIDL", categoryName: "Groceries", categoryId: 1, count: 2 },
  ]);
});

test("suggestRules: ignores rule-categorized and manual transactions", () => {
  const txns = [
    mkTx({ id: 1, partner_name: "LIDL", category_name: "Groceries", categorized_by: "rule" }),
    mkTx({ id: 2, partner_name: "LIDL", category_name: "Groceries", categorized_by: "rule" }),
  ];
  assert.deepEqual(suggestRules(txns, [], categories), []);
});

test("suggestRules: drops suggestions already covered by an exact partner_name rule", () => {
  const txns = [
    mkTx({ id: 1, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
    mkTx({ id: 2, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
  ];
  const rules: Rule[] = [{ id: 1, field: "partner_name", match_type: "exact", pattern: "lidl", category_id: 1 }];
  assert.deepEqual(suggestRules(txns, rules, categories), []);
});

test("suggestRules: a covering rule for a different field doesn't suppress the suggestion", () => {
  const txns = [
    mkTx({ id: 1, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
    mkTx({ id: 2, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
  ];
  const rules: Rule[] = [{ id: 1, field: "payment_reference", match_type: "keyword", pattern: "lidl", category_id: 1 }];
  assert.deepEqual(suggestRules(txns, rules, categories), [
    { partnerName: "LIDL", categoryName: "Groceries", categoryId: 1, count: 2 },
  ]);
});

test("suggestRules: sorts by count descending", () => {
  const txns = [
    mkTx({ id: 1, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
    mkTx({ id: 2, partner_name: "LIDL", category_name: "Groceries", categorized_by: "llm" }),
    mkTx({ id: 3, partner_name: "TAXI CO", category_name: "Transport", categorized_by: "llm" }),
    mkTx({ id: 4, partner_name: "TAXI CO", category_name: "Transport", categorized_by: "llm" }),
    mkTx({ id: 5, partner_name: "TAXI CO", category_name: "Transport", categorized_by: "llm" }),
  ];
  assert.deepEqual(suggestRules(txns, [], categories), [
    { partnerName: "TAXI CO", categoryName: "Transport", categoryId: 2, count: 3 },
    { partnerName: "LIDL", categoryName: "Groceries", categoryId: 1, count: 2 },
  ]);
});
