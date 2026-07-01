import { useState } from "react";
import { Upload as UploadIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function UploadDialog() {
  const [busy, setBusy] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { inserted } = await api.upload(file);
      toast.success(`Imported ${inserted} new transactions`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <UploadIcon size={16} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Import transactions</DialogTitle></DialogHeader>
        <Input type="file" accept=".csv" onChange={onUpload} disabled={busy} />
      </DialogContent>
    </Dialog>
  );
}
