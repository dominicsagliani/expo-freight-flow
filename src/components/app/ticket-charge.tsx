import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { fmtMoney } from "@/lib/billing";
import { fmtDateTime } from "@/lib/format";

type T = {
  id: string; status: string; labor_hours: number | null; charge_amount: number | null; calculated_charge: number | null;
  charge_adjustment_reason: string | null; charge_adjusted_at: string | null;
};

export function TicketCharge({ t, canEditHours, canAdjust }: { t: T; canEditHours: boolean; canAdjust: boolean }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState(t.labor_hours == null ? "" : String(t.labor_hours));
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const done = t.status === "completed";

  const update = async (patch: TablesUpdate<"tickets">, ok: string) => {
    const { error } = await supabase.from("tickets").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return false; }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
    return true;
  };
  const saveHours = () => {
    const n = hours.trim() === "" ? null : Number(hours);
    if (n !== null && !(n > 0 && n <= 999)) { toast.error("Enter hours between 0.25 and 999"); return; }
    update({ labor_hours: n }, n === null ? "Labor hours cleared" : "Labor hours saved");
  };
  const saveAdjust = async () => {
    const n = Number(amount);
    if (amount === "" || !(n >= 0)) { toast.error("Enter a charge of zero or more"); return; }
    if (!reason.trim()) { toast.error("A reason is required"); return; }
    if (await update({ charge_amount: n, charge_adjustment_reason: reason.trim() }, "Charge adjusted")) setOpen(false);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="eyebrow">Labor hours</div>
          {canEditHours ? (
            <div className="mt-1 flex gap-2">
              <Input className="h-8 w-24" type="number" min="0.25" step="0.25" value={hours} placeholder="—"
                onChange={(e) => setHours(e.target.value)} aria-label="Labor hours" />
              <Button size="sm" variant="outline" className="h-8" onClick={saveHours}
                disabled={(hours.trim() === "" ? null : Number(hours)) === (t.labor_hours == null ? null : Number(t.labor_hours))}>Save</Button>
            </div>
          ) : <div className="mt-0.5 text-sm">{t.labor_hours ?? "—"}</div>}
        </div>
        <div>
          <div className="eyebrow">Calculated</div>
          <div className="mt-0.5 text-sm tabular-nums">{done ? fmtMoney(t.calculated_charge) : "On completion"}</div>
        </div>
        <div>
          <div className="eyebrow">Charge</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">{done ? fmtMoney(t.charge_amount) : "—"}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Hourly services bill entered labor hours × the event's hourly rate (minimum charge applies). Without hours, the start-to-finish time is used.
      </p>
      {t.charge_adjusted_at && (
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
          Manually adjusted {fmtDateTime(t.charge_adjusted_at)} — {t.charge_adjustment_reason}
        </div>
      )}
      {done && canAdjust && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setAmount(String(t.charge_amount ?? "")); setReason(""); setOpen(true); }}>Adjust charge</Button>
          {t.charge_adjusted_at && (
            <Button size="sm" variant="ghost" onClick={() => update({ charge_amount: null }, "Charge reset to calculated")}>Reset to calculated</Button>
          )}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust charge</DialogTitle>
            <DialogDescription>Calculated charge is {fmtMoney(t.calculated_charge)}. The change and reason are recorded in the activity history.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label htmlFor="adj-amt">New charge (USD)</Label>
              <Input id="adj-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="adj-reason">Reason</Label>
              <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Dock delay credit approved by supervisor" /></div>
          </div>
          <DialogFooter><Button variant="teal" onClick={saveAdjust}>Save adjustment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
