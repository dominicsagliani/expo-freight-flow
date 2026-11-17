import { TicketPhotos } from "@/components/app/ticket-photos";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/app/page-header";
import { PriorityBadge, TicketStatusBadge } from "@/components/app/badges";
import { OperatorJobActions } from "@/components/app/operator-job-actions";
import { FreightQueueScanner } from "@/components/app/freight-queue-scanner";
import { Button } from "@/components/ui/button";
import { SERVICE_LABEL, OPEN_STATUSES } from "@/lib/labels";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export const Route = createFileRoute("/_authenticated/operator")({
  head: () => ({
    meta: [
      { title: "My delivery queue — ExpoHaul driver" },
      { name: "description", content: "A forklift driver's personal delivery queue and scan-to-dispatch workflow." },
      { property: "og:title", content: "My delivery queue — ExpoHaul driver" },
      { property: "og:description", content: "Scan freight and complete automatically dispatched forklift deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OperatorPage,
});

function OperatorPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  useRealtimeRefresh(["tickets", "ticket_freight"], [["operator-jobs"]]);

  const { data: dash = { open: [], done: [] } } = useQuery({
    queryKey: ["operator-jobs"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const [{ data: roles }, { data: current, error: currentError }] = await Promise.all([
        supabase.from("user_roles").select("operator_id").eq("user_id", auth.user?.id ?? "").eq("role", "operator"),
        supabase.rpc("forklift_current"),
      ]);
      if (currentError) throw new Error(currentError.message);
      const ids = [...new Set([
        ...(roles ?? []).map((role) => role.operator_id),
        ...(current ?? []).map((operator) => operator.operator_id),
      ].filter(Boolean))] as string[];
      if (!ids.length) return { open: [], done: [] };
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { data: done } = await supabase
        .from("tickets")
        .select("id, ticket_number, booth_number, completed_at, exhibitor:exhibitors(company_name), ticket_freight(freight_id)")
        .in("assigned_operator_id", ids)
        .eq("status", "completed")
        .gte("completed_at", since.toISOString())
        .order("completed_at", { ascending: false });
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_number, booth_number, status, priority, service_type, destination, exhibitor:exhibitors(company_name), equipment:equipment!tickets_assigned_equipment_id_fkey(unit_number), ticket_freight(freight_id, picked_up_at, delivered_at)")
        .in("assigned_operator_id", ids)
        .in("status", OPEN_STATUSES)
        .order("requested_at");
      if (error) throw new Error(error.message);
      return { open: data ?? [], done: done ?? [] };
    },
  });

  const jobs = dash.open;
  const allCrates = jobs.flatMap((j) => j.ticket_freight);
  const loaded = allCrates.filter((f) => f.picked_up_at && !f.delivered_at).length;
  const doneCrates = dash.done.reduce((n, t) => n + t.ticket_freight.length, 0);
  const stats = [
    { label: "Open jobs", value: jobs.length },
    { label: "Crates on forks", value: loaded },
    { label: "Jobs done today", value: dash.done.length },
    { label: "Crates delivered today", value: doneCrates },
  ];
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageHeader eyebrow="Driver" title="My dashboard" description="Your jobs, crates and progress. New jobs appear here automatically." />
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <Button size="lg" className="h-14 text-base" onClick={() => setOpen(true)}>
        <ScanLine className="mr-2 size-5" /> Scan freight to queue
      </Button>
      <Panel bodyClassName="divide-y">
        {jobs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No deliveries assigned. Scan freight or wait for dispatch.</p>}
        {jobs.map((job, index) => (
          <div key={job.id} className="grid gap-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stop {index + 1} · {job.equipment?.unit_number ?? "Forklift"}</div>
            <Link to="/tickets/$ticketId" params={{ ticketId: job.id }} className="block hover:opacity-80">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">{job.ticket_number}</span>
                <TicketStatusBadge status={job.status} />
              </div>
              <div className="mt-1 text-sm font-medium">{job.exhibitor?.company_name} · Booth {job.booth_number ?? "—"}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <PriorityBadge priority={job.priority} /> {SERVICE_LABEL[job.service_type]}{job.destination ? ` → ${job.destination}` : ""} · {job.ticket_freight.length} freight
              </div>
            </Link>
            {job.ticket_freight.length > 0 && (() => {
              const total = job.ticket_freight.length;
              const delivered = job.ticket_freight.filter((f) => f.delivered_at).length;
              const picked = job.ticket_freight.filter((f) => f.picked_up_at).length;
              return (
                <div className="grid gap-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{picked}/{total} picked up</span><span>{delivered}/{total} delivered</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(delivered / total) * 100}%` }} />
                  </div>
                </div>
              );
            })()}
            {job.status === "in_progress" && <TicketPhotos ticketId={job.id} canUpload />}
            <OperatorJobActions ticketId={job.id} status={job.status} />
          </div>
        ))}
      </Panel>

      {dash.done.length > 0 && (
        <Panel title="Completed today" bodyClassName="divide-y">
          {dash.done.map((t) => (
            <Link key={t.id} to="/tickets/$ticketId" params={{ ticketId: t.id }} className="flex items-center justify-between gap-2 p-4 text-sm hover:opacity-80">
              <span><span className="font-mono font-semibold">{t.ticket_number}</span> · {t.exhibitor?.company_name} · Booth {t.booth_number ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{t.ticket_freight.length} {t.ticket_freight.length === 1 ? "crate" : "crates"}</span>
            </Link>
          ))}
        </Panel>
      )}

      <FreightQueueScanner
        open={open}
        onOpenChange={setOpen}
        onQueued={() => void queryClient.invalidateQueries({ queryKey: ["operator-jobs"] })}
      />
    </div>
  );
}
