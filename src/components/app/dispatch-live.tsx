import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtAgo } from "@/lib/format";
import { fmtDuration, ISSUE_LABEL, sessionSeconds } from "@/lib/work-session";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export function DispatchLive() {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  useRealtimeRefresh(["work_sessions", "ticket_freight", "delivery_updates", "tickets"], [["live-sessions"], ["open-issues"], ["tickets"], ["operators"]]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["live-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_sessions")
        .select(`id, status, started_at, ended_at, paused_at, paused_seconds,
          equipment:equipment(unit_number), operator:operators(full_name),
          ticket:tickets(id, ticket_number, booth_number, destination, exhibitor:exhibitors(company_name), ticket_freight(picked_up_at, delivered_at))`)
        .neq("status", "completed").order("started_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const { data: issues = [] } = useQuery({
    queryKey: ["open-issues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_updates")
        .select("id, issue_type, note, created_at, ticket:tickets(id, ticket_number, booth_number), freight:freight_items(freight_code)")
        .eq("kind", "issue").is("resolved_at", null).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const resolve = async (id: string) => {
    const { error } = await supabase.rpc("resolve_issue", { _update: id });
    if (error) toast.error(error.message); else { toast.success("Issue resolved"); qc.invalidateQueries({ queryKey: ["open-issues"] }); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <span className="size-2 rounded-full bg-status-progress" />
          <h2 className="text-sm font-semibold">Active forklifts</h2>
          <span className="ml-auto text-xs text-muted-foreground">live</span>
        </header>
        {sessions.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No forklift timers running</p>}
        <div className="divide-y divide-border">
          {sessions.map((s) => {
            const tf = s.ticket?.ticket_freight ?? [];
            return (
              <div key={s.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 text-sm">
                <span className="rounded bg-primary px-2 py-1 font-mono text-xs font-bold text-primary-foreground">{s.equipment?.unit_number}</span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.operator?.full_name} · {s.ticket && <Link to="/tickets/$ticketId" params={{ ticketId: s.ticket.id }} className="font-mono hover:underline">{s.ticket.ticket_number}</Link>}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.ticket?.exhibitor?.company_name} · Booth {s.ticket?.booth_number ?? "—"} · {tf.filter((x) => x.picked_up_at).length}/{tf.length} picked · {tf.filter((x) => x.delivered_at).length}/{tf.length} delivered
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold tabular-nums">{fmtDuration(sessionSeconds(s, now))}</div>
                  <div className={`text-xs ${s.status === "paused" ? "text-status-requested" : "text-status-progress"}`}>{s.status === "paused" ? "Paused" : "Working"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <span className="size-2 rounded-full bg-destructive" />
          <h2 className="text-sm font-semibold">Reported issues</h2>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{issues.length}</span>
        </header>
        {issues.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No open issues</p>}
        <div className="divide-y divide-border">
          {issues.map((i) => (
            <div key={i.id} className="flex items-start gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-destructive">{ISSUE_LABEL[i.issue_type ?? "other"] ?? "Issue"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {i.ticket && <Link to="/tickets/$ticketId" params={{ ticketId: i.ticket.id }} className="font-mono hover:underline">{i.ticket.ticket_number}</Link>}
                  {i.freight?.freight_code ? ` · ${i.freight.freight_code}` : ""} · {fmtAgo(i.created_at)}{i.note ? ` · ${i.note}` : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(i.id)}>Resolve</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Lets dispatch add extra operators (each on their own forklift) to a ticket. */
export function CrewPicker({ ticketId, operators, assignedId }: { ticketId: string; operators: { id: string; full_name: string }[]; assignedId: string | null }) {
  const qc = useQueryClient();
  const { data: crew = [] } = useQuery({
    queryKey: ["crew", ticketId],
    queryFn: async () => (await supabase.from("ticket_crew").select("operator_id").eq("ticket_id", ticketId)).data ?? [],
  });
  const ids = new Set(crew.map((c) => c.operator_id));
  const add = async (opId: string) => {
    const { error } = await supabase.from("ticket_crew").insert({ ticket_id: ticketId, operator_id: opId, organization_id: "00000000-0000-0000-0000-000000000000" });
    if (error) toast.error(error.message); else { toast.success("Operator added to job"); qc.invalidateQueries({ queryKey: ["crew", ticketId] }); }
  };
  const remove = async (opId: string) => {
    const { error } = await supabase.from("ticket_crew").delete().eq("ticket_id", ticketId).eq("operator_id", opId);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["crew", ticketId] });
  };
  const avail = operators.filter((o) => o.id !== assignedId && !ids.has(o.id));
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {operators.filter((o) => ids.has(o.id)).map((o) => (
        <button key={o.id} onClick={() => remove(o.id)} className="rounded bg-muted px-1.5 py-0.5" title="Remove from job">+ {o.full_name} ×</button>
      ))}
      {avail.length > 0 && (
        <select aria-label="Add another forklift operator" className="h-7 rounded border border-border bg-card px-1 text-xs" value=""
          onChange={(e) => e.target.value && add(e.target.value)}>
          <option value="">+ Add forklift operator</option>
          {avail.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </select>
      )}
    </div>
  );
}
