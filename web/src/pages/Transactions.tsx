import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api, type Account, type Category, type Tx } from "@/lib/api";
import { filterTxns } from "@/lib/transactions";
import { formatEUR } from "@/lib/format";
import { resolveIcon } from "@/lib/icons";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function categoryVariant(by: string): "default" | "secondary" | "outline" {
  if (by === "llm") return "secondary";
  if (by === "manual" || by === "import") return "outline";
  return "default";
}

export default function Transactions() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<string>("all");
  const [rows, setRows] = useState<Tx[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    api.accounts().then(setAccounts);
    api.categories().then(setCategories);
  }, []);
  useEffect(() => {
    api.transactions(accountId === "all" ? undefined : Number(accountId)).then(setRows);
  }, [accountId]);

  const filtered = useMemo(
    () => filterTxns(rows, search, categoryFilter),
    [rows, search, categoryFilter],
  );

  async function assignCategory(tx: Tx, categoryId: number) {
    try {
      await api.setTransactionCategory(tx.id, categoryId);
      const category = categories.find((c) => c.id === categoryId);
      setRows((prev) => prev.map((t) =>
        t.id === tx.id
          ? { ...t, category_name: category?.name ?? "", categorized_by: "manual" }
          : t,
      ));
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function ignoreTransaction(tx: Tx) {
    const ignoreCategory = categories.find((c) => c.name === "Ignore");
    if (!ignoreCategory) {
      toast.error("Ignore category not found");
      return;
    }
    await assignCategory(tx, ignoreCategory.id);
  }

  async function unignoreTransaction(tx: Tx) {
    const uncategorized = categories.find((c) => c.name === "Uncategorized");
    if (!uncategorized) {
      toast.error("Uncategorized category not found");
      return;
    }
    await assignCategory(tx, uncategorized.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "all")}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            {categories.map((c) => {
              const Icon = resolveIcon(c.icon);
              return (
                <SelectItem key={c.id} value={c.name}>
                  <span className="flex items-center gap-1.5"><Icon size={14} />{c.name}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Input placeholder="Search partner or reference…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="w-64" />
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Date</TableHead>
            <TableHead className="w-48">Partner</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="w-32 text-right">Amount</TableHead>
            <TableHead className="w-40">Category</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((t) => (
            <TableRow key={t.id} className={t.category_name === "Ignore" ? "opacity-50 line-through" : undefined}>
              <TableCell>{t.booking_date}</TableCell>
              <TableCell className="whitespace-normal break-words">{t.partner_name}</TableCell>
              <TableCell className="whitespace-normal break-words text-muted-foreground">
                {t.payment_reference}
              </TableCell>
              <TableCell className={`text-right ${t.amount_eur < 0 ? "" : "text-green-600"}`}>
                {formatEUR(t.amount_eur)}
              </TableCell>
              <TableCell>
                {t.category_name && editingId !== t.id ? (
                  (() => {
                    const category = categories.find((c) => c.name === t.category_name);
                    const Icon = resolveIcon(category?.icon ?? "Tag");
                    const bg = category?.color ?? "#6b7280";
                    const fg = category?.icon_color ?? "#ffffff";
                    return (
                      <button type="button" onClick={() => setEditingId(t.id)} className="cursor-pointer">
                        <Badge
                          variant={categoryVariant(t.categorized_by)}
                          style={{ backgroundColor: bg, color: fg, borderColor: "transparent" }}
                        >
                          <Icon size={12} />
                          {t.category_name}
                        </Badge>
                      </button>
                    );
                  })()
                ) : (
                  <Select
                    value={categories.find((c) => c.name === t.category_name)?.id ? String(categories.find((c) => c.name === t.category_name)?.id) : undefined}
                    onValueChange={(v) => { if (v) assignCategory(t, Number(v)); setEditingId(null); }}
                    onOpenChange={(open) => { if (!open) setEditingId(null); }}
                  >
                    <SelectTrigger className="w-36"><SelectValue placeholder="Assign…" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell>
                {t.category_name === "Ignore" ? (
                  <Button variant="ghost" size="icon-sm" onClick={() => unignoreTransaction(t)}>
                    <Eye size={14} />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon-sm" onClick={() => ignoreTransaction(t)}>
                    <EyeOff size={14} />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
