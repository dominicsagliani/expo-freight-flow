import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./event-form-dialog";
import { BOL_ACCEPT, bolMimeType, sanitizeBolFilename, validateBolFile } from "@/lib/bol";

type Piece = { id: string; freight_code: string; description: string; weight_lbs: number };
export function ReceiveShipment({ eventId, exhibitorId, organizationId, pieces }: { eventId: string; exhibitorId: string; organizationId: string; pieces: Piece[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [pro, setPro] = useState("");
  const receive = async () => {
    if (file) { const problem = validateBolFile(file); if (problem) return void toast.error(problem); }
    const chosen = pieces.filter((p) => selected.includes(p.id));
    if (!chosen.length || chosen.length > 50) return void toast.error("Select between 1 and 50 pieces");
    const rows = chosen.map((p) => ({ freight_id: p.id, description: p.description, weight_lbs: Number(weights[p.id] ?? p.weight_lbs) }));
    if (rows.some((p) => !Number.isFinite(p.weight_lbs) || p.weight_lbs < 0)) return void toast.error("Weights must be zero or greater");
    setBusy(true);
    try {
      const intakeKey = key.current ?? crypto.randomUUID(); key.current = intakeKey;
      const registered = await supabase.rpc("register_inbound_shipment", {
        _event: eventId, _exhibitor: exhibitorId, _carrier: carrier, _arrival: new Date().toISOString().slice(0, 10),
        _count: pieces.length, _type: "crate", _note: pro ? `PRO: ${pro}` : "", _unexpected: false,
        _existing: pieces.map((p) => p.id), _key: intakeKey,
      });
      if (registered.error) throw registered.error;
      if (!file) {
        const result = await supabase.rpc("receive_inbound_shipment", {
          _shipment: registered.data, _pieces: rows.map((p) => ({ id: p.freight_id, weight: String(p.weight_lbs) })),
          _extra: 0, _note: pro ? `PRO: ${pro}` : "", _path: "", _filename: "", _key: intakeKey,
        });
        if (result.error) throw result.error;
      } else {
      const path = `${organizationId}/${eventId}/${intakeKey}/${sanitizeBolFilename(file.name)}`;
      const mime = bolMimeType(file);
      const upload = await supabase.storage.from("bol-documents").upload(path, file, { contentType: mime });
      if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;
      const { error } = await supabase.rpc("receive_bill_of_lading", {
        _event: eventId, _exhibitor: exhibitorId, _storage_path: path, _filename: file.name,
        _mime: mime, _file_size: file.size, _carrier: carrier, _pro: pro, _shipper: "", _consignee: "", _booth: "",
        _declared_pieces: rows.length, _description: "Imported shipment", _total_weight: rows.reduce((n, p) => n + p.weight_lbs, 0),
        _special: "", _crates: rows, _intake_key: intakeKey,
      });
      if (error) throw error;
      }
      toast.success(`${rows.length} pieces received — existing labels preserved`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["freight"] }), qc.invalidateQueries({ queryKey: ["bills_of_lading"] }), qc.invalidateQueries({ queryKey: ["inbound-shipments"] })]);
      setOpen(false); setSelected([]); setFile(null); key.current = null;
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Could not receive shipment"); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) { setSelected([]); setFile(null); key.current = null; } } }}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><PackageCheck /> Receive pieces</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Receive labeled freight</DialogTitle></DialogHeader>
      <Field label="Bill of Lading (optional)"><Input type="file" accept={BOL_ACCEPT} disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); }} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Carrier"><Input value={carrier} disabled={busy} onChange={(e) => setCarrier(e.target.value)} /></Field><Field label="PRO / tracking number"><Input value={pro} disabled={busy} onChange={(e) => setPro(e.target.value)} /></Field></div>
      <div className="max-h-64 space-y-2 overflow-auto">
        {pieces.map((p) => <div key={p.id} className="flex items-center gap-3 border-b border-border py-2">
          <Checkbox aria-label={`Receive ${p.freight_code}`} disabled={busy} checked={selected.includes(p.id)} onCheckedChange={(v) => setSelected((ids) => v ? [...ids, p.id] : ids.filter((id) => id !== p.id))} />
          <span className="flex-1 font-mono text-xs">{p.freight_code}</span>
          <Input className="w-24" aria-label={`Weight for ${p.freight_code}`} type="number" min="0" step="0.1" value={weights[p.id] ?? String(p.weight_lbs || "")} disabled={busy} onChange={(e) => setWeights((w) => ({ ...w, [p.id]: e.target.value }))} /><span className="text-xs text-muted-foreground">lb</span>
        </div>)}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setOpen(false); setSelected([]); setFile(null); setWeights({}); key.current = null; }}>Cancel</Button><Button disabled={busy || !selected.length} onClick={receive}><PackageCheck />{busy ? "Receiving…" : `Receive ${selected.length} ${selected.length === 1 ? "piece" : "pieces"}`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}