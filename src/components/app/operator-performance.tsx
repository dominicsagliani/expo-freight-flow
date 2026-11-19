import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Award, CheckCircle2, Package, Target, TrendingUp, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery } from "@/lib/queries";
import { BONUS_STATUS_LABEL, dayRange, fmtMin, fmtPct, type BonusStatus, type Performance } from "@/lib/incentives";
import { fmtMoney } from "@/lib/billing";

async function perf(org: string, event: string | null, from: string, to: string, operator?: string) {
  const { data, error } = await supabase.rpc("operator_performance", { _org: org, _event: event as string, _from: from, _to: to, ...(operator ? { _operator: operator } : {}) });
  if (error) throw new Error(error.message);
  return (data ?? []) as Performance[];
}

export function useOrgId() {
  const { data } = useQuery(membershipQuery());
  return data?.organizationId ?? null;
}

/** Driver's own performance — read-only, large type, its own tab so it never sits on the driving screen. */
export function MyPerformance({ operatorId }: { operatorId: string }) {
  const org = useOrgId();
  const today = dayRange();
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString();
  const { data: mine } = useQuery({ queryKey: ["my-perf", org, operatorId, today.from], enabled: !!org, refetchInterval: 60_000,
    queryFn: () => perf(org!, null, today.from, today.to, operatorId).then((r) => r[0] ?? null) });
  const { data: life } = useQuery({ queryKey: ["my-perf-life", org, operatorId], enabled: !!org,
    queryFn: () => perf(org!, null, yearAgo, new Date(Date.now() + 864e5).toISOString(), operatorId).then((r) => r[0] ?? null) });
  const { data: setup } = useQuery({ queryKey: ["incentive-setup", org], enabled: !!org, queryFn: async () => {
    const [s, p] = await Promise.all([
      supabase.from("incentive_settings").select("daily_goal_crates").eq("organization_id", org!).maybeSingle(),
      supabase.from("incentive_programs").select("id, name, period, amount, min_score, min_scan_compliance, min_jobs, min_crates").eq("organization_id", org!).eq("active", true),
    ]);
    return { goal: s.data?.daily_goal_crates ?? 10, programs: p.data ?? [] };
  } });
  const { data: bonuses = [] } = useQuery({ queryKey: ["my-bonuses", operatorId], queryFn: async () => {
    const { data, error } = await supabase.from("operator_bonuses").select("id, period, period_start, amount, status, score, program:incentive_programs(name)")
      .eq("operator_id", operatorId).in("status", ["pending_review", "approved", "paid"]).order("period_start", { ascending: false }).limit(20);
    if (error) throw new Error(error.message); return data ?? [];
  } });

  const goal = setup?.goal ?? 10;
  const crates = mine?.crates_delivered ?? 0;
  const pct = Math.min(100, Math.round((crates / goal) * 100));
  const daily = setup?.programs.filter((p) => p.period === "daily") ?? [];
  const onTrack = daily.filter((p) => mine && mine.score >= p.min_score && (mine.scan_compliance_pct ?? 0) >= p.min_scan_compliance && mine.jobs_completed >= p.min_jobs && crates >= p.min_crates);
  const potential = daily.reduce((s, p) => s + Number(p.amount), 0);
  const approved = bonuses.filter((b) => b.status === "approved" || b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);
  const total = life?.crates_delivered ?? 0;
  const achievements = [
    { label: "First delivery", got: total >= 1 }, { label: "25 crates", got: total >= 25 }, { label: "100 crates", got: total >= 100 },
    { label: "Perfect scans", got: (life?.scan_compliance_pct ?? 0) >= 100 && total >= 5 }, { label: "First bonus", got: approved > 0 },
  ];

  const Stat = ({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string | number }) => (
    <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5">
      <div className="flex items-center gap-2 text-base text-primary-foreground/70"><Icon className="size-5" />{label}</div>
      <div className="mt-2 font-mono text-4xl font-bold">{value}</div>
    </div>
  );

  return (
    <div className="grid gap-4 p-5" aria-label="My performance">
      <p className="text-base text-primary-foreground/60">Only look at this when parked. Updates every minute.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={CheckCircle2} label="Jobs today" value={mine?.jobs_completed ?? 0} />
        <Stat icon={Package} label="Crates today" value={crates} />
        <Stat icon={TrendingUp} label="Score" value={mine ? Math.round(mine.score) : "—"} />
        <Stat icon={Award} label="Approved bonuses" value={fmtMoney(approved)} />
      </div>
      <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5">
        <div className="flex items-center justify-between text-lg font-semibold"><span className="flex items-center gap-2"><Target className="size-5" />Daily goal</span><span className="font-mono">{crates} / {goal} crates</span></div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-primary-foreground/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        {daily.length > 0 && <p className="mt-3 text-lg">{onTrack.length ? <>On track for <b>{fmtMoney(onTrack.reduce((s, p) => s + Number(p.amount), 0))}</b> today</> : <>Up to <b>{fmtMoney(potential)}</b> possible today</>}<span className="text-primary-foreground/60"> · needs manager approval</span></p>}
      </div>
      <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5">
        <div className="flex items-center gap-2 text-lg font-semibold"><Trophy className="size-5" />Achievements</div>
        <div className="mt-3 flex flex-wrap gap-2">{achievements.map((a) => <span key={a.label} className={`rounded-full px-4 py-2 text-base font-semibold ${a.got ? "bg-accent text-accent-foreground" : "bg-primary-foreground/10 text-primary-foreground/50"}`}>{a.label}</span>)}</div>
        <p className="mt-3 text-base text-primary-foreground/60">{total} crates delivered all-time</p>
      </div>
      {bonuses.length > 0 && (
        <div className="grid gap-2">
          <div className="text-lg font-semibold">My bonuses</div>
          {bonuses.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl bg-primary-foreground/5 px-5 py-4 text-lg">
              <span>{b.program?.name} <span className="text-primary-foreground/60">· {b.period_start}</span></span>
              <span className="font-mono font-bold">{fmtMoney(Number(b.amount))} <span className="ml-2 text-base font-normal text-primary-foreground/70">{BONUS_STATUS_LABEL[b.status as BonusStatus]}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mission Control: today's per-driver performance for supervisors. Read-only — dispatch stays manual. */
export function PerformancePanel({ eventId }: { eventId: string }) {
  const org = useOrgId();
  const today = dayRange();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: rows = [] } = useQuery({ queryKey: ["perf-panel", org, eventId, today.from], enabled: !!org && !!eventId, refetchInterval: 60_000,
    queryFn: () => perf(org!, eventId, today.from, today.to) });
  const { data: week = [] } = useQuery({ queryKey: ["perf-panel-week", org, eventId], enabled: !!org && !!eventId,
    queryFn: () => perf(org!, eventId, weekAgo, today.from) });
  const { data: programs = [] } = useQuery({ queryKey: ["daily-programs", org], enabled: !!org, queryFn: async () =>
    (await supabase.from("incentive_programs").select("min_score, min_scan_compliance, min_jobs, min_crates").eq("organization_id", org!).eq("period", "daily").eq("active", true)).data ?? [] });
  const active = rows.filter((r) => r.jobs_completed || r.crates_delivered || r.open_assignments || r.shifts);
  if (!active.length) return null;
  return (
    <section aria-label="Driver performance" className="border-b border-border pb-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="size-4 text-teal" />Driver performance today</h2>
        <Link to="/incentives" className="text-xs font-medium text-teal hover:underline">Bonuses & reports</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr>
            <th className="py-2 pr-3 font-medium">Driver</th><th className="pr-3 font-medium">Jobs</th><th className="pr-3 font-medium">Crates</th><th className="pr-3 font-medium">Open</th>
            <th className="pr-3 font-medium">Pickup time</th><th className="pr-3 font-medium">On time</th><th className="pr-3 font-medium">Scans</th><th className="pr-3 font-medium">Score</th><th className="font-medium">Trend · bonus</th></tr></thead>
          <tbody>{active.map((r) => {
            const prev = week.find((w) => w.operator_id === r.operator_id);
            const diff = prev && (prev.jobs_completed || prev.crates_delivered) ? Math.round(r.score - prev.score) : null;
            const eligible = programs.some((p) => r.score >= p.min_score && (r.scan_compliance_pct ?? 0) >= p.min_scan_compliance && r.jobs_completed >= p.min_jobs && r.crates_delivered >= p.min_crates);
            return (
              <tr key={r.operator_id} className="border-t border-border">
                <td className="py-2 pr-3 font-medium">{r.full_name}</td>
                <td className="pr-3 tabular-nums">{r.jobs_completed}</td><td className="pr-3 tabular-nums">{r.crates_delivered}</td><td className="pr-3 tabular-nums">{r.open_assignments}</td>
                <td className="pr-3">{fmtMin(r.avg_pickup_min)}</td><td className="pr-3">{fmtPct(r.on_time_pct)}</td><td className="pr-3">{fmtPct(r.scan_compliance_pct)}</td>
                <td className="pr-3 font-mono font-semibold">{Math.round(r.score)}</td>
                <td className="text-xs text-muted-foreground">{diff == null ? "—" : `${diff >= 0 ? "+" : ""}${diff} vs last 7 days`} · {programs.length ? (eligible ? <span className="font-medium text-status-completed">On track</span> : "Not yet") : "No program"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Scores weigh crates, job size and accuracy, not raw speed. Reported damage or exceptions never lower a score.</p>
    </section>
  );
}
