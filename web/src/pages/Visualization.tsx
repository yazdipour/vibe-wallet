import { useEffect, useMemo, useState } from "react";
import { api, type Account, type Category, type Tx } from "@/lib/api";
import { filterTransactions, summarize, monthlyTotals, categoryTotals } from "@/lib/visualization";
import { formatEUR } from "@/lib/format";
import { PALETTE } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Area, AreaChart, BarChart, Bar, Line, LineChart, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  RadialBarChart, RadialBar, PolarRadiusAxis,
} from "recharts";

const tooltipFormatter = ((v: number) => formatEUR(v)) as (value: unknown) => string;
const percentFormatter = ((v: number) => `${v.toFixed(0)}%`) as (value: unknown) => string;

export default function Visualization() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [accountId, setAccountId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hiddenExpenses, setHiddenExpenses] = useState<Set<string>>(new Set());
  const [hiddenIncome, setHiddenIncome] = useState<Set<string>>(new Set());

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
  const visibleExpensesByCategory = useMemo(
    () => expensesByCategory.filter((c) => !hiddenExpenses.has(c.name)),
    [expensesByCategory, hiddenExpenses],
  );
  const visibleIncomeByCategory = useMemo(
    () => incomeByCategory.filter((c) => !hiddenIncome.has(c.name)),
    [incomeByCategory, hiddenIncome],
  );
  const cumulativeMonths = useMemo(() => {
    let net = 0;
    return months.map((m) => {
      net += m.income - m.expenses;
      return { month: m.month, net: Math.round(net * 100) / 100 };
    });
  }, [months]);
  const categoryRadar = useMemo(
    () => expensesByCategory.slice(0, 8).map((c) => ({ category: c.name, value: c.value })),
    [expensesByCategory],
  );
  const radialData = useMemo(() => {
    const total = summary.income + Math.abs(summary.expenses);
    if (total === 0) return [];
    return [
      {
        name: "Share",
        income: Math.round((summary.income / total) * 100),
        expenses: Math.round((Math.abs(summary.expenses) / total) * 100),
      },
    ];
  }, [summary]);

  function toggleHidden(setHidden: React.Dispatch<React.SetStateAction<Set<string>>>, name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

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
                  <Bar dataKey="income" name="Income" fill="#16a34a" />
                  <Bar dataKey="expenses" name="Expenses" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Cumulative net</CardTitle></CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeMonths}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={tooltipFormatter} />
                    <Area type="monotone" dataKey="net" name="Net" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Monthly net</CardTitle></CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={months.map((m) => ({ month: m.month, net: m.income - m.expenses }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={tooltipFormatter} />
                    <Line type="monotone" dataKey="net" name="Net" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Expenses by category</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {expensesByCategory.length === 0 ? (
                  <p className="text-muted-foreground">No expenses in this range.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {expensesByCategory.map((slice, i) => (
                        <Button
                          key={slice.name}
                          type="button"
                          size="xs"
                          variant={hiddenExpenses.has(slice.name) ? "outline" : "secondary"}
                          aria-pressed={!hiddenExpenses.has(slice.name)}
                          onClick={() => toggleHidden(setHiddenExpenses, slice.name)}
                        >
                          <span className="size-2 rounded-full" style={{ backgroundColor: colorForSlice(slice.name, i) }} />
                          <span className={cn(hiddenExpenses.has(slice.name) && "line-through")}>{slice.name}</span>
                        </Button>
                      ))}
                    </div>
                    {visibleExpensesByCategory.length === 0 ? (
                      <p className="text-muted-foreground">All expense categories are hidden.</p>
                    ) : (
                      <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={visibleExpensesByCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                              {visibleExpensesByCategory.map((slice, i) => (
                                <Cell key={slice.name} fill={colorForSlice(slice.name, i)} />
                              ))}
                            </Pie>
                            <Tooltip formatter={tooltipFormatter} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Income by category</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {incomeByCategory.length === 0 ? (
                  <p className="text-muted-foreground">No income in this range.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {incomeByCategory.map((slice, i) => (
                        <Button
                          key={slice.name}
                          type="button"
                          size="xs"
                          variant={hiddenIncome.has(slice.name) ? "outline" : "secondary"}
                          aria-pressed={!hiddenIncome.has(slice.name)}
                          onClick={() => toggleHidden(setHiddenIncome, slice.name)}
                        >
                          <span className="size-2 rounded-full" style={{ backgroundColor: colorForSlice(slice.name, i) }} />
                          <span className={cn(hiddenIncome.has(slice.name) && "line-through")}>{slice.name}</span>
                        </Button>
                      ))}
                    </div>
                    {visibleIncomeByCategory.length === 0 ? (
                      <p className="text-muted-foreground">All income categories are hidden.</p>
                    ) : (
                      <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={visibleIncomeByCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                              {visibleIncomeByCategory.map((slice, i) => (
                                <Cell key={slice.name} fill={colorForSlice(slice.name, i)} />
                              ))}
                            </Pie>
                            <Tooltip formatter={tooltipFormatter} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top expense shape</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                {categoryRadar.length === 0 ? (
                  <p className="text-muted-foreground">No expenses in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={categoryRadar}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" />
                      <Radar dataKey="value" name="Expenses" stroke="#dc2626" fill="#dc2626" fillOpacity={0.25} />
                      <Tooltip formatter={tooltipFormatter} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Income vs expenses share</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                {radialData.length === 0 ? (
                  <p className="text-muted-foreground">No categorized money in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart data={radialData} startAngle={180} endAngle={0} innerRadius="55%" outerRadius="90%">
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
                      <RadialBar dataKey="income" stackId="a" fill="#16a34a" cornerRadius={8} />
                      <RadialBar dataKey="expenses" stackId="a" fill="#dc2626" cornerRadius={8} />
                      <Tooltip formatter={percentFormatter} />
                    </RadialBarChart>
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
