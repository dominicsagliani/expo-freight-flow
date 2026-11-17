import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDuration, sessionSeconds } from "@/lib/work-session";
import { radarState, type RadarState } from "@/lib/fleet-radar";

type Driver = { user_id: string; operator_id: string; equipment_id: string; ready: boolean; heartbeat_at: string; ready_since?: string | null;
  operator?: { full_name: string } | null; equipment?: { unit_number: string; equipment_class: string; capacity_lbs: number | null } | null;
  job?: { id: string; status: string; ticket_number: string; booth_number: string | null; destination: string | null; exhibitor?: { company_name: string } | null } };

const TONE: Record<RadarState, string> = {
  "Ready now": "border-teal bg-teal/10 text-teal",
  "Finishing soon": "border-status-requested bg-status-requested/10 text-status-requested",
  "In progress": "border-status-assigned bg-status-assigned/10 text-status-assigned",
  Assigned: "border-status-assigned bg-status-assigned/10 text-status-assigned",
  "On break": "border-border bg-muted text-muted-foreground",
  Offline: "border-border bg-muted text-muted-foreground",
};

export function FleetRadar({ drivers, now }: { drivers: Driver[]; now: number }) {
  const { data: sessions = [] } = useQuery({
    queryKey: ["live-sessions", "radar"], refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("work_sessions").select("id, ticket_id, equipment_id, status, started_at, ended_at, paused_at, paused_seconds").neq("status", "completed");
      if (error) throw new Error(error.message); return data;
    },
  });
  const jobIds = drivers.map(d => d.job?.id).filter(Boolean) as string[];
  const { data: freight = [] } = useQuery({
    queryKey: ["live-sessions", "radar-freight", jobIds.join(",")], enabled: jobIds.length > 0, refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_freight").select("ticket_id, picked_up_at, delivered_at").in("ticket_id", jobIds);
      if (error) throw new Error(error.message); return data;
    },
  });

  const cards = drivers.map(d => {
    const tf = d.job ? freight.filter(f => f.ticket_id === d.job!.id) : [];
    const picked = tf.filter(f => f.picked_up_at).length, delivered = tf.filter(f => f.delivered_at).length;
    const session = d.job ? sessions.find(s => s.ticket_id === d.job!.id && s.equipment_id === d.equipment_id) : undefined;
    const state = radarState({ online: new Date(d.heartbeat_at).getTime() > now - 60_000, ready: d.ready, jobStatus: d.job?.status, total: tf.length, picked, delivered });
    return { d, tf, picked, delivered, session, state };
  });
  const order: RadarState[] = ["Ready now", "Finishing soon", "In progress", "Assigned", "On break", "Offline"];
  cards.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || (a.d.ready_since ?? "").localeCompare(b.d.ready_since ?? ""));
  const count = (s: RadarState) => cards.filter(c => c.state === s).length;
  const next = cards.find(c => c.state === "Ready now") ?? cards.find(c => c.state === "Finishing soon");

  return (
    <section className="grid gap-3 border-b border-border pb-5" aria-label="Fleet radar">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Radar className="size-4 text-teal" />Fleet radar</h2>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className={`rounded border px-2 py-1 ${TONE["Ready now"]}`}>Ready now: {count("Ready now")}</span>
        <span className={`rounded border px-2 py-1 ${TONE["Finishing soon"]}`}>Finishing soon: {count("Finishing soon")}</span>
        <span className={`rounded border px-2 py-1 ${TONE["In progress"]}`}>On jobs: {count("In progress") + count("Assigned")}</span>
        <span className="rounded border border-border px-2 py-1">Next up: {next ? `${next.d.equipment?.unit_number} · ${next.d.operator?.full_name}` : "—"}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ d, tf, picked, delivered, session, state }) => (
          <article key={d.user_id} className={`grid gap-2 rounded-md border-l-4 border bg-card p-3 ${TONE[state].split(" ")[0]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate"><b className="mr-2 rounded bg-primary px-1.5 py-0.5 font-mono text-xs text-primary-foreground">{d.equipment?.unit_number}</b>{d.operator?.full_name}</span>
              <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-bold uppercase ${TONE[state]}`}>{state}</span>
            </div>
            <div className="text-xs text-muted-foreground">{d.equipment?.equipment_class} · {d.equipment?.capacity_lbs?.toLocaleString() ?? "Unknown"} lb</div>
            {d.job ? <>
              <Link to="/tickets/$ticketId" params={{ ticketId: d.job.id }} className="text-sm font-medium hover:underline">
                {d.job.destination || `Booth ${d.job.booth_number ?? "—"}`}{d.job.exhibitor ? ` · ${d.job.exhibitor.company_name}` : ""}
              </Link>
              <div className="flex items-center justify-between text-xs">
                <span>{tf.length ? `${picked}/${tf.length} loaded · ${delivered}/${tf.length} at destination` : "Call-in · no freight"}</span>
                <span className="font-mono font-semibold tabular-nums">{session ? fmtDuration(sessionSeconds(session, now)) : "Not started"}</span>
              </div>
            </> : <div className="text-xs text-muted-foreground">{state === "Ready now" ? "At dock · standing by" : state === "On break" ? "Paused" : "Not signed in"}</div>}
          </article>
        ))}
      </div>
      {!cards.length && <p className="py-3 text-sm text-muted-foreground">No drivers signed into this event.</p>}
    </section>
  );
}
