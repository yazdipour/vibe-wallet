import { useState } from "react";
import { Users, Download, Trash2, Upload as UploadIcon } from "lucide-react";
import { api, type Account, type Tx } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function AccountInfoDialog() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

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

  async function confirmDeleteAccount() {
    if (!deleteTarget) return;
    try {
      await api.deleteAccount(deleteTarget.id);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setTxns((prev) => prev.filter((t) => t.account_id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    try {
      const { inserted } = await api.upload(file);
      toast.success(`Imported ${inserted} new transactions`);
      load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  }

  return (
    <>
      <Dialog onOpenChange={(open) => open && load()}>
        <DialogTrigger render={<Button variant="outline" />}>
          <Users size={16} />
          Accounts
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Accounts</DialogTitle></DialogHeader>
          <div className="space-y-2 border-b pb-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <UploadIcon size={14} />
              Import transactions
            </label>
            <Input type="file" accept=".csv" onChange={onUpload} disabled={uploadBusy} />
          </div>
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
                    <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(a)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete this account?</DialogTitle></DialogHeader>
          {deleteTarget && (
            <p className="text-sm text-muted-foreground">
              "{deleteTarget.name}" and all {countFor(deleteTarget.id)} of its transactions will be permanently deleted.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteAccount}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
