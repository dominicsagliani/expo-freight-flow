import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { PriorityBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { equipmentQuery, operatorsQuery, ticketsQuery, type TicketListItem } from "@/lib/queries";
import { PRIORITY_LABEL, SERVICE_LABEL, type TicketPriority, type TicketStatus } from "@/lib/labels";
import { fmtAgo } from "@/lib/format";
import { fmtMoney } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch — ExpoHaul" },
      { name: "description", content: "Live dispatch board for pending, assigned, in-progress, and completed jobs." },
      { property: "og:title", content: "Dispatch — ExpoHaul" },
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
    ]),
  component: Dispatch,
});

const COLUMNS: { key: TicketStatus; title: string; dot: string }[] = [
  { key: "requested", title: "Pending", dot: "bg-status-requested" },
  { key: "assigned", title: "Assigned", dot: "bg-status-assigned" },
  { key: "in_progress", title: "In progress", dot: "bg-status-progress" },
  { key: "completed", title: "Completed today", dot: "bg-status-completed" },
];
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const NONE = "__none";

function Dispatch() {
  const { data: tickets } = useSuspenseQuery({ ...ticketsQuery(), refetchInterval: 15_000 });
  const { data: operators } = useSuspenseQuery({ ...operatorsQuery(), refetchInterval: 15_000 });
  const { data: equipment } = useSuspenseQuery(equipmentQuery());
  const today = new Date().toDateString();

  const col = (k: TicketStatus) =>
    tickets
      .filter((t) => t.status === k && (k !== "completed" || (t.completed_at && new Date(t.completed_at).toDateString() === today)))
      .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.requested_at.localeCompare(b.requested_at));

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Dispatch" title="Dispatch board"
        description={`${operators.filter((o) => o.status === "available").length} operators available · refreshes every 15 seconds`} />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {COLUMNS.map((c) => {
          const items = col(c.key);
          return (
            <section key={c.key} className="flex min-h-40 flex-col rounded-lg border border-border bg-surface">
              <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <span className={`size-2 rounded-full ${c.dot}`} />
                <h2 className="text-sm font-semibold">{c.title}</h2>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{items.length}</span>
              </header>
              <div className="grid content-start gap-2 p-2">
                {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
                {items.map((t) => <JobCard key={t.id} t={t} operators={operators} equipment={equipment} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ t, operators, equipment }: {
  t: TicketListItem;
  operators: { id: string; full_name: string; status: string }[];
  equipment: { id: string; unit_number: string; status: string }[];
}) {
  const qc = useQueryClient();
  const editable = t.status === "requested" || t.status === "assigned";
  const update = async (patch: Record<string, unknown>, ok: string) => {
    const { error } = await supabase.from("tickets").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
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
        <div className="truncate text-sm font-medium">{t.exhibitor?.company_name}</div>
        <div className="truncate text-xs text-muted-foreground">
          Booth {t.booth_number ?? "—"} · {SERVICE_LABEL[t.service_type]} · {t.ticket_freight.length} freight
        </div>
        <div className="text-xs text-muted-foreground">
          {t.status === "completed" ? `Done ${fmtAgo(t.completed_at)} · ${fmtMoney(t.charge_amount)}` : `Requested ${fmtAgo(t.requested_at)}`}
          {!editable && t.operator ? ` · ${t.operator.full_name}` : ""}
        </div>
      </div>
      {editable && (
        <div className="grid gap-1.5">
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
