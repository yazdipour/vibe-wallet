import type { Tx, Rule, Category } from "./api.ts";

export type Suggestion = {
  partnerName: string;
  categoryName: string;
  categoryId: number;
  count: number;
};

export function suggestRules(txns: Tx[], rules: Rule[], categories: Category[]): Suggestion[] {
  const nameToId = new Map(categories.map((c) => [c.name, c.id]));
  const covered = new Set(
    rules
      .filter((r) => r.field === "partner_name" && r.match_type === "exact")
      .map((r) => r.pattern.trim().toLowerCase()),
  );

  const counts = new Map<string, { partnerName: string; categoryName: string; count: number }>();
  for (const t of txns) {
    if (t.categorized_by !== "llm" || !t.category_name) continue;
    const key = `${t.partner_name} ${t.category_name}`;
    const entry = counts.get(key) ?? { partnerName: t.partner_name, categoryName: t.category_name, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }

  const suggestions: Suggestion[] = [];
  for (const { partnerName, categoryName, count } of counts.values()) {
    if (count < 2) continue;
    if (covered.has(partnerName.trim().toLowerCase())) continue;
    const categoryId = nameToId.get(categoryName);
    if (categoryId === undefined) continue;
    suggestions.push({ partnerName, categoryName, categoryId, count });
  }
  return suggestions.sort((a, b) => b.count - a.count);
}
