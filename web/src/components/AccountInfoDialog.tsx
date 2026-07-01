import { useState } from "react";
import { Users } from "lucide-react";
import { api, type Account, type Tx } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function AccountInfoDialog() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [counts, setCounts] = useState<Map<number, number>>(new Map());

  async function load() {
    const [accs, txns] = await Promise.all([api.accounts(), api.transactions()]);
    setAccounts(accs);
    const byAccount = new Map<number, number>();
    for (const t of txns as Tx[]) {
      byAccount.set(t.account_id, (byAccount.get(t.account_id) ?? 0) + 1);
    }
    setCounts(byAccount);
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
                <span className="text-sm text-muted-foreground">
                  {counts.get(a.id) ?? 0} transaction{(counts.get(a.id) ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
