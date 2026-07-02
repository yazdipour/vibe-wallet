import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Category, type Rule, type Tx, type AIRuleSuggestion } from "@/lib/api";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { suggestRules, type Suggestion } from "@/lib/suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const FIELDS = ["partner_iban", "partner_name", "type", "payment_reference"];
const MATCHES = ["exact", "keyword"];

type ListItem =
  | { source: "heuristic"; key: string; pattern: string; categoryName: string; categoryId: number; count: number; matchType: "exact" }
  | { source: "ai"; key: string; pattern: string; categoryName: string; categoryId: number; reason: string; matchType: string };

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [draft, setDraft] = useState({ field: "partner_name", match_type: "keyword", pattern: "", category_id: 0 });
  const [aiSuggestions, setAiSuggestions] = useState<AIRuleSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, number>>({});
  const [patternOverrides, setPatternOverrides] = useState<Record<string, string>>({});
  const [suggestPhase, setSuggestPhase] = useState<"idle" | "running" | "stopped" | "error" | "done">("idle");
  const [suggestLogs, setSuggestLogs] = useState<string[]>([]);
  const [suggestError, setSuggestError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef(0);

  const reload = () => api.rules().then(setRules);
  useEffect(() => { reload(); api.categories().then(setCats); api.transactions().then(setTxns); }, []);

  const catName = (id: number) => cats.find((c) => c.id === id)?.name ?? id;

  async function add() {
    if (!draft.pattern || !draft.category_id) { toast.error("pattern and category required"); return; }
    try { await api.createRule(draft); setDraft({ ...draft, pattern: "" }); reload(); }
    catch (e) { toast.error(String(e)); }
  }

  function exportRules() {
    const rows: string[][] = [["Field", "MatchType", "Pattern", "Category"]];
    for (const r of rules) {
      rows.push([r.field, r.match_type, r.pattern, String(catName(r.category_id))]);
    }
    downloadCsv("rules-export.csv", rows);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("Empty file");
      e.target.value = "";
      return;
    }
    const [header, ...dataRows] = rows;
    if (header.join(",") !== "Field,MatchType,Pattern,Category") {
      toast.error("Unrecognized rules CSV format");
      e.target.value = "";
      return;
    }
    let imported = 0;
    let skipped = 0;
    for (const row of dataRows) {
      const [field, matchType, pattern, categoryName] = row;
      const cat = cats.find((c) => c.name.toLowerCase() === (categoryName ?? "").toLowerCase());
      if (!cat) {
        skipped++;
        continue;
      }
      try {
        await api.createRule({ field, match_type: matchType, pattern, category_id: cat.id });
        imported++;
      } catch {
        skipped++;
      }
    }
    toast.success(`Imported ${imported} rules, skipped ${skipped}`);
    reload();
    e.target.value = "";
  }

  useEffect(() => {
    if (suggestPhase !== "running") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [suggestPhase]);

  const heuristicSuggestions = useMemo(
    () => suggestRules(txns, rules, cats),
    [txns, rules, cats],
  );

  const items = useMemo<ListItem[]>(() => {
    const heuristic: ListItem[] = heuristicSuggestions
      .filter((s: Suggestion) => !dismissed.has(`h:${s.partnerName}:${s.categoryName}`))
      .map((s) => ({
        source: "heuristic", key: `h:${s.partnerName}:${s.categoryName}`,
        pattern: s.partnerName, categoryName: s.categoryName, categoryId: s.categoryId,
        count: s.count, matchType: "exact",
      }));
    const ai: ListItem[] = aiSuggestions
      .filter((s) => !dismissed.has(`a:${s.pattern}:${s.category_name}`))
      .map((s) => ({
        source: "ai", key: `a:${s.pattern}:${s.category_name}`,
        pattern: s.pattern, categoryName: s.category_name, categoryId: s.category_id,
        reason: s.reason, matchType: s.match_type,
      }));
    return [...heuristic, ...ai];
  }, [heuristicSuggestions, aiSuggestions, dismissed]);

  function resolvedCategoryId(item: ListItem): number {
    return categoryOverrides[item.key] ?? item.categoryId;
  }

  function resolvedPattern(item: ListItem): string {
    return patternOverrides[item.key] ?? item.pattern;
  }

  async function acceptItem(item: ListItem) {
    const categoryId = resolvedCategoryId(item);
    const categoryName = cats.find((c) => c.id === categoryId)?.name ?? item.categoryName;
    const pattern = resolvedPattern(item);
    if (!pattern.trim()) { toast.error("pattern required"); return; }
    try {
      await api.createRule({ field: "partner_name", match_type: item.matchType, pattern, category_id: categoryId });
      toast.success(`Rule created: "${pattern}" → ${categoryName}`);
      setDismissed((prev) => new Set(prev).add(item.key));
      reload();
    } catch (e) {
      toast.error(String(e));
    }
  }

  function dismissItem(item: ListItem) {
    setDismissed((prev) => new Set(prev).add(item.key));
  }

  function wipeAiSuggestions() {
    setAiSuggestions([]);
    setDismissed((prev) => new Set([...prev].filter((k) => !k.startsWith("a:"))));
    setCategoryOverrides((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("a:"))));
    setPatternOverrides((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("a:"))));
  }

  async function suggestWithAI() {
    wipeAiSuggestions();
    const controller = new AbortController();
    abortRef.current = controller;
    startRef.current = Date.now();
    setElapsed(0);
    setSuggestLogs([]);
    setSuggestError("");
    setSuggestPhase("running");
    try {
      const resp = await fetch("/api/rules/suggest", { method: "POST", signal: controller.signal });
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
              setSuggestError(parsed.error);
              setSuggestPhase("error");
            } else {
              setAiSuggestions(parsed.suggestions ?? []);
              setSuggestPhase("done");
            }
          } else if (parsed.log) {
            setSuggestLogs((prev) => [...prev, parsed.log]);
          }
        }
      }
    } catch (e) {
      if (controller.signal.aborted) {
        setSuggestPhase("stopped");
      } else {
        setSuggestError(String(e));
        setSuggestPhase("error");
      }
    }
  }

  function stopSuggesting() {
    abortRef.current?.abort();
  }

  function closeSuggestPopup() {
    setSuggestPhase("idle");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>AI-suggested rules</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button onClick={suggestWithAI} disabled={suggestPhase === "running"}>Suggest with AI</Button>
            <Button
              variant="outline"
              onClick={wipeAiSuggestions}
              disabled={suggestPhase === "running" || aiSuggestions.length === 0}
            >
              Wipe suggestions
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-muted-foreground">No rule suggestions right now.</p>
          ) : (
            items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={resolvedPattern(item)}
                      onChange={(e) => setPatternOverrides((prev) => ({ ...prev, [item.key]: e.target.value }))}
                      className="h-7 w-40 font-medium"
                    />
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={String(resolvedCategoryId(item))}
                      onValueChange={(v) => { if (v) setCategoryOverrides((prev) => ({ ...prev, [item.key]: Number(v) })); }}
                    >
                      <SelectTrigger className="h-7 w-40">
                        <SelectValue>
                          {(v: string) => cats.find((c) => String(c.id) === v)?.name ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {item.source === "ai" && <Badge variant="secondary">AI</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.source === "heuristic" ? `seen ${item.count} times` : item.reason}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => acceptItem(item)}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => dismissItem(item)}>Dismiss</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={suggestPhase !== "idle"} onOpenChange={(open) => { if (!open && suggestPhase !== "running") closeSuggestPopup(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suggesting rules with AI</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm">
              {suggestLogs.length === 0 ? (
                <p className="text-muted-foreground">Starting…</p>
              ) : (
                suggestLogs.map((l, i) => <p key={i}>{l}</p>)
              )}
            </div>
            {suggestPhase === "running" && <p className="text-xs text-muted-foreground">Elapsed: {elapsed}s</p>}
            {suggestPhase === "stopped" && <p className="text-sm text-muted-foreground">Stopped.</p>}
            {suggestPhase === "error" && <p className="text-sm text-destructive">{suggestError}</p>}
            {suggestPhase === "done" && <p className="text-sm text-muted-foreground">Done.</p>}
          </div>
          <DialogFooter>
            {suggestPhase === "running" ? (
              <Button variant="destructive" onClick={stopSuggesting}>Stop</Button>
            ) : (
              <Button variant="outline" onClick={closeSuggestPopup}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={draft.field} onValueChange={(v) => setDraft({ ...draft, field: v ?? draft.field })}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={draft.match_type} onValueChange={(v) => setDraft({ ...draft, match_type: v ?? draft.match_type })}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{MATCHES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="pattern (e.g. Lidl)" value={draft.pattern}
          onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} className="w-48" />
        <Select value={String(draft.category_id || "")} onValueChange={(v) => setDraft({ ...draft, category_id: Number(v) })}>
          <SelectTrigger className="w-44"><SelectValue placeholder="category" /></SelectTrigger>
          <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={add}>Add rule</Button>
        <Button variant="outline" onClick={exportRules}>Export</Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import</Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onImportFile}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow><TableHead>Field</TableHead><TableHead>Match</TableHead><TableHead>Pattern</TableHead>
            <TableHead>Category</TableHead><TableHead></TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.field}</TableCell><TableCell>{r.match_type}</TableCell>
              <TableCell>{r.pattern}</TableCell>
              <TableCell><CategoryBadge category={cats.find((c) => c.id === r.category_id)} /></TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm"
                  onClick={async () => { await api.deleteRule(r.id); reload(); }}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
