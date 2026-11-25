import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./event-form-dialog";
import { BOL_ACCEPT, validateBolFile } from "@/lib/bol";
import { uploadInboundDocument } from "@/lib/inbound-documents";
import type { FreightListItem } from "@/lib/queries";

type Company = { id: string; company_name: string; event_exhibitors: { event_id: string; booth_number: string }[] };
export function InboundRegister({ eventId, orgId, companies, freight, staff }: {
  eventId: string; orgId: string; companies: Company[]; freight: FreightListItem[]; staff: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ex, setEx] = useState("");
  const [carrier, setCarrier] = useState("");
  const [arrival, setArrival] = useState("");
  const [count, setCount] = useState("1");
  const [type, setType] = useState<"crate" | "pallet">("crate");
  const [note, setNote] = useState("");
  const [unexpected, setUnexpected] = useState(false);
  const [existing, setExisting] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const candidates = freight.filter((f) => f.event_id === eventId && f.exhibitor_id === ex && !f.inbound_shipment_id && !f.bol_id && f.arrival_status === "expected" && f.pieces === 1);
  const locked = busy || Boolean(saved);
  function close(v: boolean) {
    if (busy) return;
    setOpen(v);
    if (!v) { setEx(""); setCarrier(""); setArrival(""); setCount("1"); setNote(""); setType("crate"); setUnexpected(false); setExisting([]); setFile(null); setSaved(null); key.current = null; }
  }
  async function submit() {
    const n = Number(count);
    if (!ex || (!unexpected && !arrival) || !Number.isInteger(n) || n < 1 || n > 1000 || existing.length > n) return void toast.error("Choose an exhibitor, arrival date, and valid piece count");
    if (file) { const problem = validateBolFile(file); if (problem) return void toast.error(problem); }
    setBusy(true);
    try {
      const intake = key.current ?? crypto.randomUUID(); key.current = intake;
      let sid = saved;
      if (!sid) {
        const { data, error } = await supabase.rpc("register_inbound_shipment", { _event: eventId, _exhibitor: ex, _carrier: carrier, _arrival: arrival || new Date().toISOString().slice(0, 10), _count: n, _type: type, _note: note, _unexpected: unexpected, _existing: existing, _key: intake });
        if (error) throw new Error(error.message);
        sid = data; setSaved(sid);
      }
      if (!sid) throw new Error("Shipment could not be saved");
      const doc = await uploadInboundDocument(file, orgId, eventId, sid, intake);
      if (doc.path) {
        const { error } = await supabase.rpc("attach_inbound_document", { _shipment: sid, _path: doc.path, _filename: doc.filename });
        if (error) throw new Error(error.message);
      }
      if (unexpected) {
        const { error } = await supabase.rpc("receive_inbound_shipment", { _shipment: sid, _pieces: [], _extra: n, _note: note, _path: doc.path, _filename: doc.filename, _key: intake });
        if (error) throw new Error(error.message);
      }
      toast.success(unexpected ? `${n} unexpected pieces received` : `Shipment registered — ${n} pieces expected`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["inbound-shipments"] }), qc.invalidateQueries({ queryKey: ["freight"] })]);
      setBusy(false); close(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not register shipment"); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={close}>
    <DialogTrigger asChild><Button variant="outline" disabled={!eventId}><PackagePlus /> Add expected shipment</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{unexpected ? "Receive unexpected shipment" : "Add expected shipment"}</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        {staff && <label className="flex items-center gap-2 text-sm"><Checkbox checked={unexpected} disabled={locked} onCheckedChange={(v) => { setUnexpected(v === true); setExisting([]); }} /> Unregistered shipment arriving now</label>}
        <Field label="Exhibitor · booth"><Select value={ex} disabled={locked} onValueChange={(v) => { setEx(v); setExisting([]); }}><SelectTrigger aria-label="Shipment exhibitor"><SelectValue placeholder="Choose exhibitor" /></SelectTrigger><SelectContent>{companies.filter((c) => c.event_exhibitors.some((b) => b.event_id === eventId)).map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name} · Booth {c.event_exhibitors.find((b) => b.event_id === eventId)?.booth_number}</SelectItem>)}</SelectContent></Select></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Carrier"><Input aria-label="Shipment carrier" value={carrier} maxLength={240} disabled={locked} onChange={(e) => setCarrier(e.target.value)} /></Field><Field label={unexpected ? "Arrival date" : "Expected arrival date"}><Input aria-label="Expected arrival date" type="date" value={arrival} disabled={locked} onChange={(e) => setArrival(e.target.value)} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Freight type"><Select value={type} disabled={locked} onValueChange={(v) => setType(v === "pallet" ? "pallet" : "crate")}><SelectTrigger aria-label="Shipment freight type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="crate">Crates</SelectItem><SelectItem value="pallet">Pallets</SelectItem></SelectContent></Select></Field><Field label={unexpected ? "Actual pieces received" : "Expected pieces"}><Input aria-label="Shipment piece count" type="number" min="1" max="1000" value={count} disabled={locked} onChange={(e) => setCount(e.target.value)} /></Field></div>
        {!unexpected && candidates.length > 0 && <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">Use existing expected labels</legend><div className="max-h-40 overflow-y-auto">{candidates.map((f) => <label key={f.id} className="flex items-center gap-2 border-b border-border py-2 text-xs"><Checkbox checked={existing.includes(f.id)} disabled={locked} onCheckedChange={(v) => setExisting((ids) => v ? [...ids, f.id] : ids.filter((id) => id !== f.id))} /><span className="font-mono">{f.freight_code}</span><span className="truncate text-muted-foreground">{f.description}</span></label>)}</div></fieldset>}
        <Field label="Notes"><Textarea aria-label="Shipment notes" maxLength={4000} value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label="BOL (optional)"><Input aria-label="Shipment BOL" type="file" accept={BOL_ACCEPT} disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        {saved && <p className="text-sm text-muted-foreground">Shipment saved. Retry to finish the document or arrival record.</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button><Button variant="teal" disabled={busy || !ex} onClick={submit}>{busy ? "Saving…" : unexpected ? "Receive shipment" : "Save expected shipment"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}