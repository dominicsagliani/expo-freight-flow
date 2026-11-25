import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./event-form-dialog";
import { BOL_ACCEPT } from "@/lib/bol";
import { uploadInboundDocument } from "@/lib/inbound-documents";
import type { InboundShipment } from "@/lib/queries";

export function InboundReceive({ shipment }: { shipment: InboundShipment }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [damaged, setDamaged] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState("0");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const remaining = shipment.freight.filter((f) => f.arrival_status === "expected");
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string, v: boolean) => setter((ids) => v ? [...ids, id] : ids.filter((i) => i !== id));
  function close(v: boolean) { if (busy) return; setOpen(v); if (!v) { setSelected([]); setDamaged([]); setWeights({}); setExtra("0"); setNote(""); setFile(null); key.current = null; } }
  async function receive() {
    const n = Number(extra);
    if (!Number.isInteger(n) || n < 0 || n + selected.length < 1 || n + selected.length > 1000) return void toast.error("Select received pieces or enter an additional piece count");
    if (selected.some((id) => weights[id]?.trim() && (!Number.isFinite(Number(weights[id])) || Number(weights[id]) < 0))) return void toast.error("Weights must be zero or greater");
    setBusy(true);
    try {
      const intake = key.current ?? crypto.randomUUID(); key.current = intake;
      const doc = await uploadInboundDocument(file, shipment.organization_id, shipment.event_id, shipment.id, intake);
      const { error } = await supabase.rpc("receive_inbound_shipment", { _shipment: shipment.id, _pieces: selected.map((id) => ({ id, weight: weights[id] ?? "", damaged: damaged.includes(id) })), _extra: n, _note: note, _path: doc.path, _filename: doc.filename, _key: intake });
      if (error) throw new Error(error.message);
      toast.success(`${selected.length + n} pieces received — existing QR labels preserved`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["inbound-shipments"] }), qc.invalidateQueries({ queryKey: ["freight"] }), qc.invalidateQueries({ queryKey: ["freight-issues"] })]);
      setBusy(false); close(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not receive shipment"); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={close}><DialogTrigger asChild><Button variant="outline" size="sm"><PackageCheck /> Receive shipment</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Receive {shipment.exhibitor?.company_name} · Booth {shipment.booth_number}</DialogTitle></DialogHeader>
      <div className="flex flex-wrap gap-4 text-sm"><span>{shipment.expected_pieces} originally expected</span><span>{remaining.length} still expected</span><span className="font-semibold">{selected.length + Number(extra || 0)} arriving now</span></div>
      {!!remaining.length && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setSelected(remaining.map((f) => f.id))}>Select all remaining pieces</Button>}
      <div className="max-h-64 overflow-auto">{remaining.map((f) => <div key={f.id} className="flex flex-wrap items-center gap-3 border-b border-border py-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs"><Checkbox aria-label={`Receive ${f.freight_code}`} checked={selected.includes(f.id)} disabled={busy} onCheckedChange={(v) => toggle(setSelected, f.id, v === true)} /><span className="font-mono">{f.freight_code}</span></label>
        <Input aria-label={`Weight for ${f.freight_code}`} className="w-24" type="number" min="0" value={weights[f.id] ?? ""} placeholder={String(f.weight_lbs || "lb")} disabled={busy} onChange={(e) => setWeights((w) => ({ ...w, [f.id]: e.target.value }))} />
        <label className="flex items-center gap-2 text-xs"><Checkbox aria-label={`Damage for ${f.freight_code}`} checked={damaged.includes(f.id)} disabled={busy || !selected.includes(f.id)} onCheckedChange={(v) => toggle(setDamaged, f.id, v === true)} /> Damaged</label>
      </div>)}</div>
      <Field label="Additional pieces arriving now"><Input aria-label="Additional pieces" type="number" min="0" max="1000" value={extra} disabled={busy} onChange={(e) => setExtra(e.target.value)} /></Field>
      <Field label="Arrival notes / damage details"><Textarea aria-label="Arrival notes" maxLength={4000} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label="BOL (optional)"><Input aria-label="Arrival BOL" type="file" accept={BOL_ACCEPT} disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button><Button variant="teal" disabled={busy} onClick={receive}>{busy ? "Receiving…" : "Confirm arrival"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}