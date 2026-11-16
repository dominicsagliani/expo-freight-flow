import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./event-form-dialog";
import { ARRIVAL_LABEL, FREIGHT_TYPE_LABEL, type ArrivalStatus, type FreightType } from "@/lib/labels";

type Booth = { event_id: string; exhibitor_id: string; booth_number: string; exhibitor: { company_name: string } | null };

export function FreightFormDialog({
  events,
  booths,
  lockedExhibitorId,
  canSetStatus,
  trigger,
}: {
  events: { id: string; name: string; organization_id: string }[];
  booths: Booth[];
  lockedExhibitorId: string | null;
  canSetStatus: boolean;
  trigger: ReactNode;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [exhibitorId, setExhibitorId] = useState(lockedExhibitorId ?? "");
  const [type, setType] = useState<FreightType>("pallet");
  const [status, setStatus] = useState<ArrivalStatus>("expected");
  const [f, setF] = useState({ description: "", pieces: "1", weight: "", l: "", w: "", h: "", location: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const eventBooths = booths.filter((b) => b.event_id === eventId);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = useMutation({
    mutationFn: async () => {
      if (!eventId || !exhibitorId) throw new Error("Choose an event and exhibitor");
      if (f.description.trim().length < 2) throw new Error("Describe the freight");
      const pieces = Number(f.pieces);
      const weight = Number(f.weight);
      if (!Number.isInteger(pieces) || pieces < 1) throw new Error("Pieces must be a whole number of at least 1");
      if (!(weight > 0)) throw new Error("Enter a weight greater than 0");
      const { data, error } = await supabase.from("freight_items").insert({
        organization_id: events.find((e) => e.id === eventId)!.organization_id,
        event_id: eventId,
        exhibitor_id: exhibitorId,
        freight_code: "",
        freight_type: type,
        description: f.description.trim(),
        pieces,
        weight_lbs: weight,
        length_in: num(f.l),
        width_in: num(f.w),
        height_in: num(f.h),
        arrival_status: canSetStatus ? status : "expected",
        storage_location: canSetStatus ? f.location.trim() || null : null,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Freight registered");
      if (canSetStatus && autoPrint) navigate({ to: "/labels/$freightId", params: { freightId: id }, search: { autoprint: 1 } });
      qc.invalidateQueries({ queryKey: ["freight"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      setOpen(false);
      setF({ description: "", pieces: "1", weight: "", l: "", w: "", h: "", location: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register freight</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Event">
            <Select value={eventId} onValueChange={(v) => { setEventId(v); if (!lockedExhibitorId) setExhibitorId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
              <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Exhibitor">
            <Select value={exhibitorId} onValueChange={setExhibitorId} disabled={!!lockedExhibitorId}>
              <SelectTrigger><SelectValue placeholder="Select exhibitor" /></SelectTrigger>
              <SelectContent>
                {eventBooths.map((b) => (
                  <SelectItem key={b.exhibitor_id} value={b.exhibitor_id}>{b.exhibitor?.company_name} · Booth {b.booth_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_6rem_7rem]">
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as FreightType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FREIGHT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Pieces"><Input type="number" min={1} value={f.pieces} onChange={set("pieces")} /></Field>
            <Field label="Weight (lb)"><Input type="number" min={0} step="0.1" value={f.weight} onChange={set("weight")} /></Field>
          </div>
          <Field label="Description"><Input value={f.description} onChange={set("description")} placeholder="e.g. Demo machine — crated" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Length (in)"><Input type="number" min={0} value={f.l} onChange={set("l")} /></Field>
            <Field label="Width (in)"><Input type="number" min={0} value={f.w} onChange={set("w")} /></Field>
            <Field label="Height (in)"><Input type="number" min={0} value={f.h} onChange={set("h")} /></Field>
          </div>
          {canSetStatus && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Arrival status">
                <Select value={status} onValueChange={(v) => setStatus(v as ArrivalStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ARRIVAL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Storage location"><Input value={f.location} onChange={set("location")} placeholder="Dock B · Bay 4" /></Field>
            </div>
          )}
          <p className="text-xs text-muted-foreground">A unique freight ID and a private QR code are generated automatically.</p>
          {canSetStatus && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="size-4 accent-primary" />
              Print label automatically after saving
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Register freight"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
