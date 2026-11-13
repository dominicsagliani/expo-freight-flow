import type { TablesUpdate } from "@/integrations/supabase/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Activity, Phone, Send, Truck, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PriorityBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { freightQuery, equipmentQuery, operatorsQuery, ticketsQuery, eventsQuery, eventExhibitorsQuery, membershipQuery, isStaff, type TicketListItem } from "@/lib/queries";
import { PRIORITY_LABEL, SERVICE_LABEL, type TicketPriority, type TicketStatus } from "@/lib/labels";
import { fmtAgo } from "@/lib/format";
import { fmtMoney } from "@/lib/billing";
import { CrewPicker, DispatchLive } from "@/components/app/dispatch-live";
import { EQUIPMENT_CLASSES } from "@/lib/fleet";
import { CallInDialog } from "@/components/app/call-in-dialog";
import { driverState, REQUEST_SOURCES } from "@/lib/dispatch";
import { DockQueue } from "@/components/app/dock-queue";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Mission Control dispatch — ExpoHaul" },
      { name: "description", content: "Live dispatch board for pending, assigned, in-progress, and completed jobs." },
      { property: "og:title", content: "Mission Control dispatch — ExpoHaul" },
      { property: "og:description", content: "Live dispatch board for material handling jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(ticketsQuery()),
      queryClient.ensureQueryData(operatorsQuery()),
      queryClient.ensureQueryData(equipmentQuery()),
      queryClient.ensureQueryData(eventsQuery()),
      queryClient.ensureQueryData(eventExhibitorsQuery()),
      queryClient.ensureQueryData(freightQuery()),
    ]),
  component: Dispatch,
});

const COLUMNS: { key: TicketStatus; title: string; dot: string }[] = [
  { key: "requested", title: "Waiting queue", dot: "bg-status-requested" },
  { key: "assigned", title: "Dispatched", dot: "bg-status-assigned" },
  { key: "in_progress", title: "Working", dot: "bg-status-progress" },
  { key: "completed", title: "Completed today", dot: "bg-status-completed" },
];
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const NONE = "__none";

function Dispatch() {
  const qc = useQueryClient();
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: membership } = useSuspenseQuery(membershipQuery());
  const [eventId, setEventId] = useState(events.find(e => e.status !== "closed")?.id ?? events[0]?.id ?? "");
  const [callOpen, setCallOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const staff = isStaff(membership);
  const event = events.find(e => e.id === eventId);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useRealtimeRefresh(["tickets", "queue_drivers", "operators", "work_sessions", "freight_items"], [["tickets"], ["freight"], ["queue-drivers"], ["operators"], ["live-sessions"]]);
  const { data: tickets } = useSuspenseQuery({ ...ticketsQuery(), refetchInterval: 15_000 });
  const { data: operators } = useSuspenseQuery({ ...operatorsQuery(), refetchInterval: 15_000 });
  const { data: equipment } = useSuspenseQuery(equipmentQuery());
  const { data: queue = [] } = useQuery({ queryKey: ["queue-drivers"], refetchInterval: 10_000, queryFn: async () => {
    const { data, error } = await supabase.from("queue_drivers").select("user_id, event_id, operator_id, equipment_id, ready, heartbeat_at, operator:operators(full_name), equipment:equipment(unit_number, equipment_class, capacity_lbs, fuel_type), event:events(name)");
    if (error) throw new Error(error.message); return data ?? [];
  } });
  const today = new Date().toDateString();
  const eventTickets = tickets.filter(t => t.event_id === eventId);
  const drivers = queue.filter(q => q.event_id === eventId).map(q => ({ ...q, job: eventTickets.find(t => ["assigned", "in_progress"].includes(t.status) && (t.assigned_operator_id === q.operator_id || t.assigned_equipment_id === q.equipment_id)) }));
  const available = drivers.filter(q => driverState(q.heartbeat_at, q.ready, !!q.job, now) === "Available");
  const waiting = eventTickets.filter(t => t.status === "requested");
  const oldest = waiting.length ? Math.max(0, Math.floor((now - Math.min(...waiting.map(t => new Date(t.requested_at).getTime()))) / 60000)) : 0;
  const dispatch = async () => {
    setSending(true);
    const { error } = await supabase.rpc("dispatch_next_available", { _event: eventId });
    setSending(false);
    if (error) toast.error(error.message); else { toast.success("Queue checked for available compatible drivers"); void qc.invalidateQueries({ queryKey: ["tickets"] }); }
  };

  const col = (k: TicketStatus) =>
    eventTickets
      .filter((t) => t.status === k && (k !== "completed" || (t.completed_at && new Date(t.completed_at).toDateString() === today)))
      .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.requested_at.localeCompare(b.requested_at));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal"><Activity className="size-4" />ExpoHaul dispatch desk</div><h1 className="text-3xl font-bold">Mission Control</h1></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Select value={eventId} onValueChange={setEventId}><SelectTrigger aria-label="Dispatch event" className="w-full sm:w-64"><SelectValue placeholder="Select event" /></SelectTrigger><SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
          {staff && <Button variant="teal" onClick={() => setCallOpen(true)} disabled={!event || event.status === "closed"}><Phone />New call-in</Button>}
        </div>
      </header>
      <div className="grid grid-cols-2 gap-4 border-b border-border pb-5 lg:grid-cols-4">
        {[{ label: "Drivers available", value: available.length, icon: Truck, tone: "text-teal" }, { label: "Waiting requests", value: waiting.length, icon: Phone, tone: "text-status-requested" }, { label: "Longest wait", value: `${oldest} min`, icon: Clock, tone: "text-foreground" }, { label: "Completed today", value: col("completed").length, icon: CheckCircle2, tone: "text-status-completed" }].map(s => <div key={s.label}><div className="flex items-center gap-2 text-xs text-muted-foreground"><s.icon className={`size-4 ${s.tone}`} />{s.label}</div><div className={`mt-2 font-mono text-3xl font-bold ${s.tone}`}>{s.value}</div></div>)}
      </div>
      <DockQueue eventId={eventId} tickets={eventTickets} />
      <section className="grid gap-3 border-b border-border pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Driver fleet · {drivers.filter(q => driverState(q.heartbeat_at,q.ready,!!q.job,now) !== "Offline").length} online</h2>{staff && <Button size="sm" variant="outline" onClick={dispatch} disabled={sending || !event || event.status === "closed"}><Send />{sending ? "Checking…" : "Dispatch waiting"}</Button>}</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{drivers.map(q => {
          const state = driverState(q.heartbeat_at,q.ready,!!q.job,now);
          return <article key={q.user_id} className="grid gap-2 rounded-md border border-border bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium">{q.operator?.full_name}</span><span className={`text-xs font-semibold ${state === "Available" ? "text-teal" : state === "On a job" ? "text-status-assigned" : "text-muted-foreground"}`}>{state}</span></div><div className="text-xs text-muted-foreground"><b className="font-mono text-foreground">{q.equipment?.unit_number}</b> · {q.equipment?.equipment_class} · {q.equipment?.capacity_lbs?.toLocaleString() ?? "Unknown"} lb · {q.equipment?.fuel_type}</div>{q.job && <Link to="/tickets/$ticketId" params={{ ticketId:q.job.id }} className="text-xs hover:underline">{q.job.ticket_number} · {q.job.destination || `Booth ${q.job.booth_number ?? "—"}`}</Link>}</article>;
        })}</div>
        {!drivers.length && <p className="py-3 text-sm text-muted-foreground">No drivers signed into this event.</p>}
      </section>
      <DispatchLive eventId={eventId} />
      {event && callOpen && <CallInDialog key={eventId} eventId={eventId} eventName={event.name} open={callOpen} onOpenChange={setCallOpen} />}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {COLUMNS.map((c) => {
          const items = col(c.key);
          return (
            <section key={c.key} className="flex min-h-40 min-w-0 flex-col">
              <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <span className={`size-2 rounded-full ${c.dot}`} />
                <h2 className="text-sm font-semibold">{c.title}</h2>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{items.length}</span>
              </header>
              <div className="grid content-start gap-2 p-2">
                {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
                {items.map((t) => <JobCard key={t.id} t={t} operators={operators} equipment={equipment} staff={staff} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ t, operators, equipment, staff }: {
  t: TicketListItem;
  operators: { id: string; full_name: string; status: string }[];
  equipment: { id: string; unit_number: string; status: string }[];
  staff: boolean;
}) {
  const qc = useQueryClient();
  const editable = staff && (t.status === "requested" || t.status === "assigned");
  const update = async (patch: TablesUpdate<"tickets">, ok: string) => {
    const { error } = await supabase.from("tickets").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["operators"] });
  };
  const assign = (opId: string | null, eqId: string | null) =>
    update({
      assigned_operator_id: opId,
      assigned_equipment_id: eqId,
      status: opId ? "assigned" : "requested",
    }, opId ? "Job assigned" : "Assignment cleared");

  return (
    <article className="grid gap-2 rounded-md border border-border bg-card p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="font-mono text-xs font-semibold hover:underline">{t.ticket_number}</Link>
        <PriorityBadge priority={t.priority} />
      </div>
      <div>
        {t.request_source !== "standard" && <div className="mb-1 text-xs font-semibold text-teal">{REQUEST_SOURCES[t.request_source as keyof typeof REQUEST_SOURCES] ?? "Call-in"} request</div>}
        <div className="truncate text-sm font-medium">{t.exhibitor?.company_name}</div>
        <div className="truncate text-xs text-muted-foreground">
          Booth {t.booth_number ?? "—"} · {SERVICE_LABEL[t.service_type]} · {t.ticket_freight.length} freight
        </div>
        {t.destination && <div className="break-words text-sm font-medium">{t.destination}</div>}
        {t.request_source !== "standard" && <div className={`text-xs ${!t.service_only && !t.estimated_weight_lbs ? "text-status-requested" : "text-muted-foreground"}`}>{t.service_only ? "Service only" : t.estimated_weight_lbs ? `${t.estimated_weight_lbs.toLocaleString()} lb load` : "Unknown weight · manual dispatch"}</div>}
        {t.special_instructions && <p className="break-words text-xs text-muted-foreground">{t.special_instructions}</p>}
        {t.equipment && <div className="font-mono text-xs text-muted-foreground">{t.equipment.unit_number} · {t.operator?.full_name}</div>}
        <div className="text-xs text-muted-foreground">
          {t.status === "completed" ? `Done ${fmtAgo(t.completed_at)} · ${fmtMoney(t.charge_amount)}` : `Requested ${fmtAgo(t.requested_at)}`}
          {!editable && t.operator ? ` · ${t.operator.full_name}` : ""}
        </div>
      </div>
      {staff && (t.status === "assigned" || t.status === "in_progress") && (
        <CrewPicker ticketId={t.id} operators={operators} assignedId={t.assigned_operator_id} />
      )}
      {editable && (
        <div className="grid gap-1.5">
          <Select value={t.required_equipment_class} onValueChange={v => update({ required_equipment_class: v }, "Equipment type updated")}>
            <SelectTrigger className="h-8 text-xs" aria-label="Required equipment type"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(EQUIPMENT_CLASSES).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={t.assigned_operator_id ?? NONE} onValueChange={(v) => assign(v === NONE ? null : v, t.assigned_equipment_id)}>
            <SelectTrigger className="h-8 text-xs" aria-label="Operator"><SelectValue placeholder="Assign operator" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Unassigned</SelectItem>
              {operators.map((o) => (
                <SelectItem key={o.id} value={o.id} disabled={o.status === "off_shift" && o.id !== t.assigned_operator_id}>
                  {o.full_name} · {o.status === "available" ? "Available" : o.status === "on_job" ? "On job" : "Off shift"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-1.5">
            <Select value={t.assigned_equipment_id ?? NONE} onValueChange={(v) => assign(t.assigned_operator_id, v === NONE ? null : v)}>
              <SelectTrigger className="h-8 text-xs" aria-label="Equipment"><SelectValue placeholder="Equipment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No equipment</SelectItem>
                {equipment.map((e) => (
                  <SelectItem key={e.id} value={e.id} disabled={e.status === "maintenance"}>{e.unit_number}{e.status === "maintenance" ? " · Maint." : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={t.priority} onValueChange={(v) => update({ priority: v as TicketPriority }, "Priority updated")}>
              <SelectTrigger className="h-8 text-xs" aria-label="Priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" className="h-7 justify-self-end text-xs text-muted-foreground"
            onClick={() => confirm(`Cancel ticket ${t.ticket_number}?`) && update({ status: "cancelled" }, "Ticket cancelled")}>
            Cancel ticket
          </Button>
        </div>
      )}
    </article>
  );
}
