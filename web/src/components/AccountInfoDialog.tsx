import { useState } from "react";
import { Users, Download } from "lucide-react";
import { api, type Account, type Tx } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function AccountInfoDialog() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Tx[]>([]);

  async function load() {
    const [accs, allTxns] = await Promise.all([api.accounts(), api.transactions()]);
    setAccounts(accs);
    setTxns(allTxns);
  }

  function countFor(accountId: number): number {
    return txns.filter((t) => t.account_id === accountId).length;
  }

  function exportAccount(account: Account) {
    const rows: string[][] = [["Date", "Partner", "Reference", "Amount", "Category", "Account"]];
    for (const t of txns) {
      if (t.account_id !== account.id || !t.category_name) continue;
      rows.push([t.booking_date, t.partner_name, t.payment_reference, String(t.amount_eur), t.category_name, account.name]);
    }
    downloadCsv(`${account.name}-export.csv`, rows);
  }

  return (
    <Dialog onOpenChange={(open) => open && load()}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Users size={16} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Accounts</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-muted-foreground">No accounts yet.</p>
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                <span>{a.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {countFor(a.id)} transaction{countFor(a.id) === 1 ? "" : "s"}
                  </span>
                  <Button size="icon-sm" variant="ghost" onClick={() => exportAccount(a)}>
                    <Download size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
