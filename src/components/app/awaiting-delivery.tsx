import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackageCheck, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABEL, type TicketPriority } from "@/lib/labels";
import type { FreightListItem } from "@/lib/queries";
import { useLatestStaging } from "@/components/app/freight-staging";

export function AwaitingDelivery({ eventId, freight }: { eventId: string; freight: FreightListItem[] }) {
  const qc = useQueryClient();
  const staging = useLatestStaging(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [busy, setBusy] = useState(false);
  const { data: busyIds = new Set<string>() } = useQuery({
    queryKey: ["tickets", "open-freight"], refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_freight").select("freight_id, ticket:tickets!inner(status)").in("ticket.status", ["requested", "assigned", "in_progress"]);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((r) => r.freight_id));
    },
  });
  const waiting = useMemo(() => freight.filter((f) => f.event_id === eventId && (f.arrival_status === "received" || f.arrival_status === "in_storage") && !busyIds.has(f.id)), [freight, eventId, busyIds]);
  const exhibitor = waiting.find((f) => f.id === picked[0])?.exhibitor_id;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const send = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("dispatch_staged_crates", { _freight: picked, _priority: priority });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${picked.length} crate${picked.length === 1 ? "" : "s"} sent to dispatch`);
    setPicked([]);
    void qc.invalidateQueries({ queryKey: ["tickets"] });
    void qc.invalidateQueries({ queryKey: ["freight"] });
  };
  return (
    <section aria-label="Awaiting delivery" className="rounded-md border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2 font-display font-semibold"><PackageCheck className="size-5 text-teal" />Awaiting delivery ({waiting.length})</div>
        <div className="flex flex-wrap gap-2">
          <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
            <SelectTrigger aria-label="Job priority" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="teal" disabled={!picked.length || busy} onClick={send}><Send />{busy ? "Sending…" : `Dispatch ${picked.length || ""} crate${picked.length === 1 ? "" : "s"}`}</Button>
        </div>
      </div>
      {waiting.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No received crates are waiting. Check freight in at the dock to fill this list.</p> : (
        <ul className="divide-y divide-border">
          {waiting.map((f) => {
            const s = staging.get(f.id);
            const disabled = !!exhibitor && exhibitor !== f.exhibitor_id;
            return (
              <li key={f.id}>
                <label className={`flex cursor-pointer items-start gap-3 p-3 ${disabled ? "opacity-40" : ""}`}>
                  <input type="checkbox" className="mt-1 size-4" checked={picked.includes(f.id)} disabled={disabled} onChange={() => toggle(f.id)} aria-label={`Select ${f.freight_code}`} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-mono text-xs font-medium">{f.freight_code}</div>
                    <div className="font-medium">{f.exhibitor?.company_name} · Booth {f.booth_number ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s ? `${s.area}${s.location_note ? ` · ${s.location_note}` : ""}${s.landmark ? ` · near ${s.landmark}` : ""}` : f.storage_location ?? "Not staged yet"}</div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {exhibitor && <p className="border-t border-border p-2 text-xs text-muted-foreground">One job carries crates for one exhibitor. Up to 3 forklifts can be added on the job afterward.</p>}
    </section>
  );
}
