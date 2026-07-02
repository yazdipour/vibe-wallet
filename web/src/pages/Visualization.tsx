import { useEffect, useMemo, useState } from "react";
import { api, type Account, type Category, type Tx } from "@/lib/api";
import { filterTransactions, summarize, monthlyTotals, categoryTotals } from "@/lib/visualization";
import { formatEUR } from "@/lib/format";
import { PALETTE } from "@/lib/colors";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const tooltipFormatter = ((v: number) => formatEUR(v)) as (value: unknown) => string;

export default function Visualization() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [accountId, setAccountId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    api.accounts().then(setAccounts);
    api.transactions().then(setTxns);
    api.categories().then(setCategories);
  }, []);

  const filtered = useMemo(
    () => filterTransactions(txns, accountId, from, to),
    [txns, accountId, from, to],
  );
  const summary = useMemo(() => summarize(filtered, categories), [filtered, categories]);
  const months = useMemo(() => monthlyTotals(filtered, categories), [filtered, categories]);
  const expensesByCategory = useMemo(() => categoryTotals(filtered, categories, "expense"), [filtered, categories]);
  const incomeByCategory = useMemo(() => categoryTotals(filtered, categories, "income"), [filtered, categories]);

  const colorForSlice = (name: string, index: number): string => {
    const category = categories.find((c) => c.name === name);
    return category?.color ?? PALETTE[index % PALETTE.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "all")}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No transactions in this range.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Total Income</CardTitle></CardHeader>
              <CardContent className="text-2xl font-medium text-green-600">{formatEUR(summary.income)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Total Expenses</CardTitle></CardHeader>
              <CardContent className="text-2xl font-medium text-red-600">{formatEUR(-summary.expenses)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Net</CardTitle></CardHeader>
              <CardContent className={`text-2xl font-medium ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatEUR(summary.net)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Monthly history</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#16a34a" />
                  <Bar dataKey="expenses" name="Expenses" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Expenses by category</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                {expensesByCategory.length === 0 ? (
                  <p className="text-muted-foreground">No expenses in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expensesByCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                        {expensesByCategory.map((slice, i) => (
                          <Cell key={i} fill={colorForSlice(slice.name, i)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipFormatter} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Income by category</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                {incomeByCategory.length === 0 ? (
                  <p className="text-muted-foreground">No income in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={incomeByCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                        {incomeByCategory.map((slice, i) => (
                          <Cell key={i} fill={colorForSlice(slice.name, i)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipFormatter} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
