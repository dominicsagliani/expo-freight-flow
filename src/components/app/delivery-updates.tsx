import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deliveryUpdatesQuery, jobAssignmentsQuery } from "@/lib/queries";
import { DELIVERY_UPDATE_LABEL, type DeliveryUpdateKind } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";

type FreightOption = { id: string; freight_code: string };

export function DeliveryUpdates({ ticketId, freight, canPost }: { ticketId: string; freight: FreightOption[]; canPost: boolean }) {
  const { data: updates } = useSuspenseQuery(deliveryUpdatesQuery(ticketId));
  const qc = useQueryClient();
  const [kind, setKind] = useState<DeliveryUpdateKind>("in_transit");
  const [freightId, setFreightId] = useState("all");
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("delivery_updates").insert({
      ticket_id: ticketId,
      organization_id: "00000000-0000-0000-0000-000000000000", // replaced by the database from the ticket
      kind,
      freight_id: freightId === "all" ? null : freightId,
      note: note.trim() || null,
      location: location.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Update posted");
    setNote("");
    setLocation("");
    qc.invalidateQueries({ queryKey: ["delivery_updates", ticketId] });
    qc.invalidateQueries({ queryKey: ["activity"] });
  }

  return (
    <div className="grid gap-4">
      {canPost && (
        <form onSubmit={submit} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DeliveryUpdateKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DELIVERY_UPDATE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Freight item</Label>
            <Select value={freightId} onValueChange={setFreightId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole ticket</SelectItem>
                {freight.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.freight_code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="du-loc">Location (optional)</Label>
            <Input id="du-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dock 4, Aisle 1200" />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="du-note">Note{kind === "note" ? "" : " (optional)"}</Label>
            <Textarea id="du-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} required={kind === "note"} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Posting…" : "Post update"}</Button>
          </div>
        </form>
      )}
      {updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No delivery updates yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {updates.map((u) => (
            <li key={u.id} className="grid gap-0.5 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {DELIVERY_UPDATE_LABEL[u.kind as DeliveryUpdateKind]}
                  {u.freight ? <span className="ml-2 font-mono text-xs text-muted-foreground">{u.freight.freight_code}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(u.created_at)}</span>
              </div>
              {u.location && <div className="text-xs text-muted-foreground">{u.location}</div>}
              {u.note && <div className="text-sm">{u.note}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AssignmentHistory({ ticketId }: { ticketId: string }) {
  const { data: rows } = useSuspenseQuery(jobAssignmentsQuery(ticketId));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Not assigned yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
          <span className="font-medium">{[r.operator?.full_name, r.equipment?.unit_number].filter(Boolean).join(" · ") || "Unassigned"}</span>
          <span className="text-xs text-muted-foreground">
            {fmtDateTime(r.assigned_at)}
            {r.released_at ? ` → ${fmtDateTime(r.released_at)} (${r.release_reason ?? "released"})` : " · current"}
          </span>
        </li>
      ))}
    </ul>
  );
}
