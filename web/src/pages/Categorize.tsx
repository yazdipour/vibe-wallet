import { useEffect, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { api, type Category, type Rule, type CategorizeLogEntry } from "@/lib/api";
import { CATEGORY_ICONS, resolveIcon } from "@/lib/icons";
import { PALETTE, readableTextColor } from "@/lib/colors";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const FIELDS = ["partner_iban", "partner_name", "type", "payment_reference"];
const MATCHES = ["exact", "keyword"];

function sourceVariant(source: string): "default" | "secondary" | "outline" {
  if (source === "llm") return "secondary";
  if (source === "rule") return "default";
  return "outline";
}

type EditDraft = { icon: string; color: string; iconColor: string };
type NewRuleDraft = { field: string; match_type: string; pattern: string };

function CategoryRow({
  category, rules, isExpanded, editDraft, newRule,
  onToggleExpand, onEditDraftChange, onNewRuleChange, onDeleteRule, onSaveAppearance, onAddRule,
}: {
  category: Category;
  rules: Rule[];
  isExpanded: boolean;
  editDraft: EditDraft | null;
  newRule: NewRuleDraft;
  onToggleExpand: () => void;
  onEditDraftChange: (d: EditDraft) => void;
  onNewRuleChange: (r: NewRuleDraft) => void;
  onDeleteRule: (id: number) => void;
  onSaveAppearance: () => void;
  onAddRule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: category.id });
  const Icon = resolveIcon(category.icon);
  const categoryRules = rules.filter((r) => r.category_id === category.id);
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10, position: "relative" as const }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border bg-background ${isDragging ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label={`Drag ${category.name} between Income and Expenses`}
        >
          <GripVertical size={14} />
        </button>
        <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={onToggleExpand}>
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={{ backgroundColor: category.color, color: category.icon_color }}
          >
            <Icon size={14} />
          </span>
          <span className="flex-1">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            {categoryRules.length} rule{categoryRules.length === 1 ? "" : "s"}
          </span>
        </button>
      </div>
      {isExpanded && (
        <div className="space-y-2 border-t p-2">
          {categoryRules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{r.field} {r.match_type} "{r.pattern}"</span>
              <Button size="sm" variant="ghost" onClick={() => onDeleteRule(r.id)}>Delete</Button>
            </div>
          ))}
          {editDraft && (
            <div className="space-y-2 border-b pb-2">
              <div className="flex flex-wrap gap-1">
                {CATEGORY_ICONS.map((iconName) => {
                  const IconOption = resolveIcon(iconName);
                  const selected = editDraft.icon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      className={`flex size-8 items-center justify-center rounded-lg border ${selected ? "border-foreground" : "border-input"}`}
                      onClick={() => onEditDraftChange({ ...editDraft, icon: iconName })}
                    >
                      <IconOption size={16} />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {PALETTE.map((color) => {
                  const selected = editDraft.color === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      className={`size-8 rounded-full ${selected ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                      style={{ backgroundColor: color }}
                      onClick={() => onEditDraftChange({ ...editDraft, color, iconColor: readableTextColor(color) })}
                    />
                  );
                })}
                <input
                  type="color"
                  className="size-8 cursor-pointer rounded-full border border-input p-0"
                  value={editDraft.color}
                  onChange={(e) => onEditDraftChange({ ...editDraft, color: e.target.value, iconColor: readableTextColor(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Icon color:</span>
                <button
                  type="button"
                  className={`rounded-lg border px-2 py-1 text-xs ${editDraft.iconColor === "#000000" ? "border-foreground" : "border-input"}`}
                  onClick={() => onEditDraftChange({ ...editDraft, iconColor: "#000000" })}
                >
                  Black
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-2 py-1 text-xs ${editDraft.iconColor === "#ffffff" ? "border-foreground" : "border-input"}`}
                  onClick={() => onEditDraftChange({ ...editDraft, iconColor: "#ffffff" })}
                >
                  White
                </button>
              </div>
              <Button size="sm" onClick={onSaveAppearance}>Save</Button>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={newRule.field}
              onChange={(e) => onNewRuleChange({ ...newRule, field: e.target.value })}
            >
              {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={newRule.match_type}
              onChange={(e) => onNewRuleChange({ ...newRule, match_type: e.target.value })}
            >
              {MATCHES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm"
              placeholder="pattern"
              value={newRule.pattern}
              onChange={(e) => onNewRuleChange({ ...newRule, pattern: e.target.value })}
            />
            <Button size="sm" onClick={onAddRule}>Add rule</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropZone({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`space-y-2 rounded-lg p-2 transition-colors ${isOver ? "bg-accent" : ""}`}>
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      {children}
    </div>
  );
}

export default function Categorize() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<CategorizeLogEntry[] | null>(null);
  const [newCategory, setNewCategory] = useState<{ name: string; icon: string; color: string; iconColor: string }>(
    { name: "", icon: CATEGORY_ICONS[0], color: PALETTE[0], iconColor: readableTextColor(PALETTE[0]) },
  );
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [newRule, setNewRule] = useState<NewRuleDraft>({ field: "partner_name", match_type: "keyword", pattern: "" });
  const [runPhase, setRunPhase] = useState<"idle" | "running" | "error" | "done">("idle");
  const [runTotal, setRunTotal] = useState(0);
  const [runProcessed, setRunProcessed] = useState(0);
  const [runError, setRunError] = useState("");
  const [runSummary, setRunSummary] = useState<{ categorized: number; stillUncategorized: number } | null>(null);

  const reload = () => {
    api.rules().then(setRules);
  };
  useEffect(() => { reload(); api.categories().then(setCategories); }, []);

  const incomeCategories = categories.filter((c) => c.kind === "income");
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  function toggleExpand(c: Category) {
    if (expandedCategory === c.id) {
      setExpandedCategory(null);
      setEditDraft(null);
    } else {
      setExpandedCategory(c.id);
      setEditDraft({ icon: c.icon, color: c.color, iconColor: c.icon_color });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const categoryId = Number(event.active.id);
    const overId = event.over?.id;
    const newKind = overId === "income" ? "income" : overId === "expense" ? "expense" : null;
    if (!newKind) return;
    const category = categories.find((c) => c.id === categoryId);
    if (!category || category.kind === newKind) return;
    try {
      const updated = await api.updateCategoryKind(categoryId, newKind);
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function createCategory() {
    if (!newCategory.name.trim()) { toast.error("name required"); return; }
    try {
      await api.createCategory({
        name: newCategory.name, icon: newCategory.icon, color: newCategory.color,
        icon_color: newCategory.iconColor,
      });
      setNewCategory({ name: "", icon: CATEGORY_ICONS[0], color: PALETTE[0], iconColor: readableTextColor(PALETTE[0]) });
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
      const updated = await api.updateCategoryAppearance(id, {
        icon: editDraft.icon, color: editDraft.color, icon_color: editDraft.iconColor,
      });
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function run() {
    setBusy(true);
    setLog([]);
    setRunError("");
    setRunSummary(null);
    setRunProcessed(0);
    setRunPhase("running");
    try {
      const allTxns = await api.transactions();
      const total = allTxns.filter((t) => !t.category_name).length;
      setRunTotal(total);

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
              setRunError(parsed.error);
              setRunPhase("error");
              toast.error(parsed.error);
            } else {
              setRunSummary({ categorized: parsed.rules + parsed.llm, stillUncategorized: parsed.skipped });
              setRunPhase("done");
              toast.success(`Rules: ${parsed.rules}, LLM: ${parsed.llm}, Skipped: ${parsed.skipped}`);
            }
          } else {
            const entry = parsed as CategorizeLogEntry;
            if (entry.source !== "skipped") {
              setLog((prev) => [...(prev ?? []), entry]);
            }
            setRunProcessed((prev) => prev + 1);
          }
        }
      }
      reload();
    } catch (e) {
      setRunError(String(e));
      setRunPhase("error");
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  function closeRunPopup() {
    setRunPhase("idle");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Run categorization based on rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={run} disabled={busy}>Run categorization based on rules</Button>

          {log && (
            log.length === 0 ? (
              <p className="text-muted-foreground">No records were categorized.</p>
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

      <Dialog open={runPhase !== "idle"} onOpenChange={(open) => { if (!open && runPhase !== "running") closeRunPopup(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Running categorization</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {runPhase === "running" && (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground transition-all"
                    style={{ width: `${runTotal === 0 ? 0 : Math.min(100, Math.round((runProcessed / runTotal) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{runProcessed} / {runTotal} processed</p>
              </>
            )}
            {runPhase === "error" && <p className="text-sm text-destructive">{runError}</p>}
            {runPhase === "done" && runSummary && (
              <p className="text-sm">
                Categorized {runSummary.categorized}. Still uncategorized: {runSummary.stillUncategorized}.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRunPopup} disabled={runPhase === "running"}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Drag a category card to move it between Income and Expenses.</p>
          <DndContext onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              <DropZone id="income" label="Income">
                {incomeCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Drag a category here to mark it as income.</p>
                ) : (
                  incomeCategories.map((c) => (
                    <CategoryRow
                      key={c.id}
                      category={c}
                      rules={rules}
                      isExpanded={expandedCategory === c.id}
                      editDraft={expandedCategory === c.id ? editDraft : null}
                      newRule={newRule}
                      onToggleExpand={() => toggleExpand(c)}
                      onEditDraftChange={setEditDraft}
                      onNewRuleChange={setNewRule}
                      onDeleteRule={deleteCategoryRule}
                      onSaveAppearance={() => saveCategoryAppearance(c.id)}
                      onAddRule={() => addCategoryRule(c.id)}
                    />
                  ))
                )}
              </DropZone>
              <DropZone id="expense" label="Expenses">
                {expenseCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Drag a category here to mark it as an expense.</p>
                ) : (
                  expenseCategories.map((c) => (
                    <CategoryRow
                      key={c.id}
                      category={c}
                      rules={rules}
                      isExpanded={expandedCategory === c.id}
                      editDraft={expandedCategory === c.id ? editDraft : null}
                      newRule={newRule}
                      onToggleExpand={() => toggleExpand(c)}
                      onEditDraftChange={setEditDraft}
                      onNewRuleChange={setNewRule}
                      onDeleteRule={deleteCategoryRule}
                      onSaveAppearance={() => saveCategoryAppearance(c.id)}
                      onAddRule={() => addCategoryRule(c.id)}
                    />
                  ))
                )}
              </DropZone>
            </div>
          </DndContext>

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
            <div className="flex flex-wrap items-center gap-1">
              {PALETTE.map((color) => {
                const selected = newCategory.color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={`size-8 rounded-full ${selected ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategory({ ...newCategory, color, iconColor: readableTextColor(color) })}
                  />
                );
              })}
              <input
                type="color"
                className="size-8 cursor-pointer rounded-full border border-input p-0"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value, iconColor: readableTextColor(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Icon color:</span>
              <button
                type="button"
                className={`rounded-lg border px-2 py-1 text-xs ${newCategory.iconColor === "#000000" ? "border-foreground" : "border-input"}`}
                onClick={() => setNewCategory({ ...newCategory, iconColor: "#000000" })}
              >
                Black
              </button>
              <button
                type="button"
                className={`rounded-lg border px-2 py-1 text-xs ${newCategory.iconColor === "#ffffff" ? "border-foreground" : "border-input"}`}
                onClick={() => setNewCategory({ ...newCategory, iconColor: "#ffffff" })}
              >
                White
              </button>
            </div>
            <Button onClick={createCategory}>Create category</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
