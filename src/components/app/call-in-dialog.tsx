import { useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Phone, Radio, Footprints, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eventExhibitorsQuery } from "@/lib/queries";
import { EQUIPMENT_CLASSES } from "@/lib/fleet";
import { REQUEST_SOURCES } from "@/lib/dispatch";
import { SERVICE_LABEL, PRIORITY_LABEL, type ServiceType, type TicketPriority } from "@/lib/labels";
import { supabase } from "@/integrations/supabase/client";

export function CallInDialog({ eventId, eventName, open, onOpenChange }: { eventId: string; eventName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const { data: booths } = useSuspenseQuery(eventExhibitorsQuery());
  const [search, setSearch] = useState("");
  const [exhibitorId, setExhibitorId] = useState("");
  const [location, setLocation] = useState("");
  const [service, setService] = useState<ServiceType>("equipment_lift");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [equipmentClass, setEquipmentClass] = useState("forklift");
  const [source, setSource] = useState<keyof typeof REQUEST_SOURCES>("phone");
  const [serviceOnly, setServiceOnly] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const roster = booths.filter(b => b.event_id === eventId);
  const matches = useMemo(() => roster.filter(b => `${b.exhibitor?.company_name} ${b.booth_number}`.toLowerCase().includes(search.toLowerCase())), [roster, search]);
  const selected = roster.find(b => b.exhibitor_id === exhibitorId);
  const create = useMutation({
    mutationFn: async () => {
      const { data: id, error } = await supabase.rpc("create_call_in", {
        _event: eventId, _exhibitor: exhibitorId, _location: location.trim(), _service: service, _priority: priority,
        _class: equipmentClass, _service_only: serviceOnly, _weight: !serviceOnly && weight ? Number(weight) : undefined,
        _notes: notes, _source: source, _key: key,
      });
      if (error) throw new Error(error.message);
      if (!id) throw new Error("Request could not be saved");
      const result = await supabase.from("tickets").select("ticket_number, status, operator:operators!tickets_assigned_operator_id_fkey(full_name)").eq("id", id).single();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: t => {
      toast.success(t.operator ? `${t.ticket_number} dispatched to ${t.operator.full_name}` : `${t.ticket_number} saved in the waiting queue`);
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Dialog open={open} onOpenChange={v => { if (!create.isPending) onOpenChange(v); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
      <DialogHeader><DialogTitle>New call-in request</DialogTitle><DialogDescription>{eventName}</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={e => { e.preventDefault(); create.mutate(); }}>
        <div className="flex gap-2">{Object.entries(REQUEST_SOURCES).map(([v, label]) => {
          const Icon = v === "phone" ? Phone : v === "radio" ? Radio : Footprints;
          return <Button type="button" key={v} variant={source === v ? "default" : "outline"} aria-pressed={source === v} onClick={() => setSource(v as keyof typeof REQUEST_SOURCES)}><Icon />{label}</Button>;
        })}</div>
        <label className="grid gap-1.5 text-sm font-medium">Company or booth
          <Input aria-label="Find company or booth" placeholder="Search company name or booth…" value={search} onChange={e => { setSearch(e.target.value); setExhibitorId(""); }} />
        </label>
        {!selected ? <div className="max-h-36 overflow-y-auto divide-y divide-border border border-border rounded-md">
          {matches.map(b => <Button key={b.id} type="button" variant="ghost" className="h-auto w-full justify-between whitespace-normal rounded-none py-2 text-left" onClick={() => { setExhibitorId(b.exhibitor_id); setSearch(b.exhibitor?.company_name ?? ""); setLocation(`Booth ${b.booth_number}`); }}><span>{b.exhibitor?.company_name}</span><span className="ml-3 shrink-0 font-mono text-xs">{b.booth_number}</span></Button>)}
          {!matches.length && <p className="p-3 text-sm text-muted-foreground">No matching exhibitors at this event.</p>}
        </div> : <div className="flex justify-between text-sm text-teal"><span>{selected.exhibitor?.company_name} · Booth {selected.booth_number}</span><Button type="button" size="sm" variant="ghost" onClick={() => { setExhibitorId(""); setSearch(""); }}>Change</Button></div>}
        <label className="grid gap-1.5 text-sm font-medium">Send forklift to<Input aria-label="Send forklift to" required maxLength={300} value={location} onChange={e => setLocation(e.target.value)} placeholder="Booth, aisle, dock or meeting point" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">Service<Select value={service} onValueChange={v => setService(v as ServiceType)}><SelectTrigger aria-label="Call service"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SERVICE_LABEL).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm font-medium">Priority<Select value={priority} onValueChange={v => setPriority(v as TicketPriority)}><SelectTrigger aria-label="Call priority"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRIORITY_LABEL).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">Equipment<Select value={equipmentClass} onValueChange={setEquipmentClass}><SelectTrigger aria-label="Call equipment"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EQUIPMENT_CLASSES).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={serviceOnly} onCheckedChange={v => setServiceOnly(v === true)} />Service only — no load to move</label>
        {!serviceOnly && <label className="grid gap-1.5 text-sm font-medium">Estimated total load (lb)<Input aria-label="Estimated load weight" type="number" min="0.01" step="any" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Unknown" />{!weight && <span className="text-xs font-normal text-status-requested">Unknown weight · held for manual dispatch</span>}</label>}
        <label className="grid gap-1.5 text-sm font-medium">Call notes<Textarea aria-label="Call notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} /></label>
        <Button type="submit" variant="teal" className="w-full" disabled={!selected || !location.trim() || create.isPending}><Send />{create.isPending ? "Sending…" : "Dispatch next available"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}