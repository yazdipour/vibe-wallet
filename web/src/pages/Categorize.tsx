import { useEffect, useMemo, useState } from "react";
import { api, type Category, type Rule, type Tx, type CategorizeLogEntry } from "@/lib/api";
import { suggestRules, type Suggestion } from "@/lib/suggestions";
import { CATEGORY_ICONS, resolveIcon } from "@/lib/icons";
import { PALETTE, readableTextColor } from "@/lib/colors";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const FIELDS = ["partner_iban", "partner_name", "type", "payment_reference"];
const MATCHES = ["exact", "keyword"];

function suggestionKey(s: Pick<Suggestion, "partnerName" | "categoryName">): string {
  return `${s.partnerName} ${s.categoryName}`;
}

function sourceVariant(source: string): "default" | "secondary" | "outline" {
  if (source === "llm") return "secondary";
  if (source === "rule") return "default";
  return "outline";
}

export default function Categorize() {
  const [txns, setTxns] = useState<Tx[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<CategorizeLogEntry[] | null>(null);
  const [newCategory, setNewCategory] = useState<{ name: string; icon: string; color: string }>(
    { name: "", icon: CATEGORY_ICONS[0], color: PALETTE[0] },
  );
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ icon: string; color: string } | null>(null);
  const [newRule, setNewRule] = useState({ field: "partner_name", match_type: "keyword", pattern: "" });

  const reload = () => {
    api.transactions().then(setTxns);
    api.rules().then(setRules);
  };
  useEffect(() => { reload(); api.categories().then(setCategories); }, []);

  const suggestions = useMemo(
    () => suggestRules(txns, rules, categories).filter((s) => !dismissed.has(suggestionKey(s))),
    [txns, rules, categories, dismissed],
  );

  async function accept(s: Suggestion) {
    try {
      await api.createRule({ field: "partner_name", match_type: "exact", pattern: s.partnerName, category_id: s.categoryId });
      toast.success(`Rule created: ${s.partnerName} → ${s.categoryName}`);
      reload();
    } catch (e) {
      toast.error(String(e));
    }
  }

  function dismiss(s: Suggestion) {
    setDismissed((prev) => new Set(prev).add(suggestionKey(s)));
  }

  async function createCategory() {
    if (!newCategory.name.trim()) { toast.error("name required"); return; }
    try {
      await api.createCategory(newCategory);
      setNewCategory({ name: "", icon: CATEGORY_ICONS[0], color: PALETTE[0] });
      api.categories().then(setCategories);
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function addCategoryRule(categoryId: number) {
    if (!newRule.pattern.trim()) { toast.error("pattern required"); return; }
    try {
      await api.createRule({ ...newRule, category_id: categoryId });
      setNewRule({ ...newRule, pattern: "" });
      reload();
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function deleteCategoryRule(id: number) {
    try {
      await api.deleteRule(id);
      reload();
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function saveCategoryAppearance(id: number) {
    if (!editDraft) return;
    try {
      const updated = await api.updateCategoryAppearance(id, editDraft);
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function run() {
    setBusy(true);
    setLog([]);
    try {
      const resp = await fetch("/api/categorize", { method: "POST" });
      if (!resp.ok || !resp.body) {
        throw new Error(await resp.text());
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          if (parsed.done) {
            if (parsed.error) {
              toast.error(parsed.error);
            } else {
              toast.success(`Rules: ${parsed.rules}, LLM: ${parsed.llm}, Skipped: ${parsed.skipped}`);
            }
          } else {
            setLog((prev) => [...(prev ?? []), parsed as CategorizeLogEntry]);
          }
        }
      }
      reload();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {categories.map((c) => {
              const Icon = resolveIcon(c.icon);
              const categoryRules = rules.filter((r) => r.category_id === c.id);
              const isExpanded = expandedCategory === c.id;
              return (
                <div key={c.id} className="rounded-lg border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 p-2 text-left"
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedCategory(null);
                        setEditDraft(null);
                      } else {
                        setExpandedCategory(c.id);
                        setEditDraft({ icon: c.icon, color: c.color });
                      }
                    }}
                  >
                    <span
                      className="flex size-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: c.color, color: readableTextColor(c.color) }}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {categoryRules.length} rule{categoryRules.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 border-t p-2">
                      {categoryRules.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>{r.field} {r.match_type} "{r.pattern}"</span>
                          <Button size="sm" variant="ghost" onClick={() => deleteCategoryRule(r.id)}>Delete</Button>
                        </div>
                      ))}
                      {editDraft && (
                        <div className="space-y-2 border-b pb-2">
                          <div className="flex flex-wrap gap-1">
                            {CATEGORY_ICONS.map((iconName) => {
                              const Icon = resolveIcon(iconName);
                              const selected = editDraft.icon === iconName;
                              return (
                                <button
                                  key={iconName}
                                  type="button"
                                  className={`flex size-8 items-center justify-center rounded-lg border ${selected ? "border-foreground" : "border-input"}`}
                                  onClick={() => setEditDraft({ ...editDraft, icon: iconName })}
                                >
                                  <Icon size={16} />
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {PALETTE.map((color) => {
                              const selected = editDraft.color === color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  className={`size-8 rounded-full ${selected ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setEditDraft({ ...editDraft, color })}
                                />
                              );
                            })}
                          </div>
                          <Button size="sm" onClick={() => saveCategoryAppearance(c.id)}>Save</Button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-end gap-2">
                        <select
                          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                          value={newRule.field}
                          onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
                        >
                          {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <select
                          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                          value={newRule.match_type}
                          onChange={(e) => setNewRule({ ...newRule, match_type: e.target.value })}
                        >
                          {MATCHES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input
                          className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm"
                          placeholder="pattern"
                          value={newRule.pattern}
                          onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                        />
                        <Button size="sm" onClick={() => addCategoryRule(c.id)}>Add rule</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 border-t pt-4">
            <input
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              placeholder="New category name"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            />
            <div className="flex flex-wrap gap-1">
              {CATEGORY_ICONS.map((iconName) => {
                const Icon = resolveIcon(iconName);
                const selected = newCategory.icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    className={`flex size-8 items-center justify-center rounded-lg border ${selected ? "border-foreground" : "border-input"}`}
                    onClick={() => setNewCategory({ ...newCategory, icon: iconName })}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">
              {PALETTE.map((color) => {
                const selected = newCategory.color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={`size-8 rounded-full ${selected ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategory({ ...newCategory, color })}
                  />
                );
              })}
            </div>
            <Button onClick={createCategory}>Create category</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Suggested rules</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-muted-foreground">No rule suggestions right now.</p>
          ) : (
            suggestions.map((s) => (
              <div key={suggestionKey(s)} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                <span>
                  <strong>{s.partnerName}</strong> → {s.categoryName} (seen {s.count} times)
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => accept(s)}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => dismiss(s)}>Dismiss</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Run AI categorization</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={run} disabled={busy}>Run AI categorization</Button>

          {log && (
            log.length === 0 ? (
              <p className="text-muted-foreground">Nothing to categorize.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead><TableHead>Category</TableHead>
                    <TableHead>Source</TableHead><TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.map((entry) => (
                    <TableRow key={entry.tx_id}>
                      <TableCell>{entry.partner}</TableCell>
                      <TableCell>{entry.category || "—"}</TableCell>
                      <TableCell><Badge variant={sourceVariant(entry.source)}>{entry.source}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{entry.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
