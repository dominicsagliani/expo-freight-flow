import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ARRIVAL_LABEL, type ArrivalStatus } from "@/lib/labels";

export function FreightStatusEditor({ id, status, location }: { id: string; status: ArrivalStatus; location: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(status);
  const [loc, setLoc] = useState(location ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("freight_items").update({ arrival_status: s, storage_location: loc.trim() || null }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Freight updated");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["freight"] });
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setS(status); setLoc(location ?? ""); } }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Update status and location"><Pencil className="size-3.5" /></Button>
      </PopoverTrigger>
      <PopoverContent className="grid w-64 gap-3">
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={s} onValueChange={(v) => setS(v as ArrivalStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ARRIVAL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Current location</Label>
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Marshalling yard B-4" />
        </div>
        <Button onClick={save} disabled={busy}>Save</Button>
      </PopoverContent>
    </Popover>
  );
}
