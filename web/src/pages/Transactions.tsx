import { useEffect, useMemo, useState } from "react";
import { api, type Account, type Category, type Tx } from "@/lib/api";
import { filterTxns } from "@/lib/transactions";
import { formatEUR } from "@/lib/format";
import { resolveIcon } from "@/lib/icons";
import { readableTextColor } from "@/lib/colors";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function categoryVariant(by: string): "default" | "secondary" | "outline" {
  if (by === "llm") return "secondary";
  if (by === "manual") return "outline";
  return "default";
}

export default function Transactions() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<string>("all");
  const [rows, setRows] = useState<Tx[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

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
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.booking_date}</TableCell>
              <TableCell className="whitespace-normal break-words">{t.partner_name}</TableCell>
              <TableCell className="whitespace-normal break-words text-muted-foreground">
                {t.payment_reference}
              </TableCell>
              <TableCell className={`text-right ${t.amount_eur < 0 ? "" : "text-green-600"}`}>
                {formatEUR(t.amount_eur)}
              </TableCell>
              <TableCell>
                {t.category_name ? (
                  (() => {
                    const category = categories.find((c) => c.name === t.category_name);
                    const Icon = resolveIcon(category?.icon ?? "Tag");
                    const bg = category?.color ?? "#6b7280";
                    return (
                      <Badge
                        variant={categoryVariant(t.categorized_by)}
                        style={{ backgroundColor: bg, color: readableTextColor(bg), borderColor: "transparent" }}
                      >
                        <Icon size={12} />
                        {t.category_name}
                      </Badge>
                    );
                  })()
                ) : (
                  <Select onValueChange={(v) => v && assignCategory(t, Number(v))}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Assign…" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
