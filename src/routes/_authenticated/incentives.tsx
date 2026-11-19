import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Check, History, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { eventsQuery, isAdmin, isStaff, membershipQuery } from "@/lib/queries";
import { fmtMoney } from "@/lib/billing";
import {
  BONUS_STATUS_LABEL, DEFAULT_WEIGHTS, PERIOD_LABEL, WEIGHT_LABEL, fmtMin, fmtPct, isoDate, weekStart, weightsError,
  type BonusStatus, type IncentivePeriod, type Performance, type Weights,
} from "@/lib/incentives";

export const Route = createFileRoute("/_authenticated/incentives")({
  head: () => ({
    meta: [
      { title: "Operator performance & bonuses — ExpoHaul" },
      { name: "description", content: "Track forklift operator performance and manage contractor-funded bonuses." },
      { property: "og:title", content: "Operator performance & bonuses — ExpoHaul" },
      { property: "og:description", content: "Fair, traceable operator scores and bonus approvals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) => Promise.all([queryClient.ensureQueryData(membershipQuery()), queryClient.ensureQueryData(eventsQuery())]),
  component: Incentives,
});

const ALL = "__all";
const STATUS_VARIANT: Record<BonusStatus, string> = {
  ineligible: "bg-muted text-muted-foreground", pending_review: "bg-status-requested/15 text-status-requested",
  approved: "bg-teal/15 text-teal", rejected: "bg-destructive/15 text-destructive", paid: "bg-status-completed/15 text-status-completed",
};

function Incentives() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const admin = isAdmin(m);
  const org = m.organizationId;
  const qc = useQueryClient();
  useEffect(() => {
    if (admin && org) void supabase.rpc("ensure_incentive_defaults", { _org: org }).then(() => qc.invalidateQueries({ queryKey: ["incentive"] }));
  }, [admin, org, qc]);
  if (!org || !isStaff(m)) return <div className="p-6 text-muted-foreground">Only company staff can view operator performance.</div>;
  return (
    <div className="grid gap-6">
      <PageHeader title="Operator performance & bonuses" description="Scores come from real scans, deliveries and job times. Bonuses are paid by your company; ExpoHaul never moves money." />
      <Tabs defaultValue={admin ? "bonuses" : "report"}>
        <TabsList className="h-auto flex-wrap justify-start">
          {admin && <TabsTrigger value="bonuses">Bonuses</TabsTrigger>}
          <TabsTrigger value="report">Performance report</TabsTrigger>
          {admin && <TabsTrigger value="programs">Bonus programs</TabsTrigger>}
          {admin && <TabsTrigger value="weights">Score weights</TabsTrigger>}
          {admin && <TabsTrigger value="history">History</TabsTrigger>}
        </TabsList>
        {admin && <TabsContent value="bonuses"><Bonuses org={org} /></TabsContent>}
        <TabsContent value="report"><Report org={org} /></TabsContent>
        {admin && <TabsContent value="programs"><Programs org={org} /></TabsContent>}
        {admin && <TabsContent value="weights"><WeightsForm org={org} /></TabsContent>}
        {admin && <TabsContent value="history"><AuditList org={org} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function useEvents() { return useSuspenseQuery(eventsQuery()).data; }

function Report({ org }: { org: string }) {
  const events = useEvents();
  const [eventId, setEventId] = useState(ALL);
  const [from, setFrom] = useState(isoDate(weekStart(new Date())));
  const [to, setTo] = useState(isoDate(new Date()));
  const { data: rows = [], isFetching } = useQuery({ queryKey: ["incentive", "report", org, eventId, from, to], queryFn: async () => {
    const end = new Date(to + "T00:00:00"); end.setDate(end.getDate() + 1);
    const { data, error } = await supabase.rpc("operator_performance", { _org: org, _event: (eventId === ALL ? null : eventId) as string, _from: new Date(from + "T00:00:00").toISOString(), _to: end.toISOString() });
    if (error) throw new Error(error.message); return (data ?? []) as Performance[];
  } });
  const cols: [string, (r: Performance) => string | number][] = [
    ["Jobs", (r) => r.jobs_completed], ["Crates", (r) => r.crates_delivered], ["Hours worked", (r) => r.active_hours],
    ["Accept", (r) => fmtMin(r.avg_accept_min)], ["To pickup", (r) => fmtMin(r.avg_pickup_min)], ["Pickup→delivery", (r) => fmtMin(r.avg_transit_min)],
    ["Between jobs", (r) => fmtMin(r.avg_gap_min)], ["On time", (r) => fmtPct(r.on_time_pct)], ["Scan compliance", (r) => fmtPct(r.scan_compliance_pct)],
    ["Booth accuracy", (r) => fmtPct(r.delivery_accuracy_pct)], ["Exceptions reported", (r) => r.exceptions_reported], ["Shifts", (r) => `${r.shifts}/${r.org_work_days}`],
  ];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1"><Label>Event</Label><Select value={eventId} onValueChange={setEventId}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All events</SelectItem>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1"><Label htmlFor="rf">From</Label><Input id="rf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grid gap-1"><Label htmlFor="rt">To</Label><Input id="rt" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {isFetching && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2 font-medium">Operator</th><th className="p-2 font-medium">Score</th>{cols.map(([h]) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.operator_id} className="border-t border-border">
              <td className="p-2 font-medium">{r.full_name}</td>
              <td className="p-2" title={`Productivity ${r.productivity} · Accuracy ${r.accuracy} · On time ${r.on_time} · Documentation ${r.documentation} · Reliability ${r.reliability}`}><span className="font-mono font-semibold">{Math.round(r.score)}</span></td>
              {cols.map(([h, f]) => <td key={h} className="p-2 tabular-nums">{f(r)}</td>)}
            </tr>
          ))}{rows.length === 0 && <tr><td colSpan={cols.length + 2} className="p-6 text-center text-muted-foreground">No operators yet.</td></tr>}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Listed alphabetically, not ranked. Productivity counts crates, job size and weight per hour worked and is capped, so going faster than the target earns nothing extra. Paused, held and dispatch-waiting time is left out. Crates with reported damage or exceptions are left out of timing and accuracy and count toward documentation.</p>
    </div>
  );
}

type Program = { id: string; name: string; period: string; amount: number; min_score: number; min_scan_compliance: number; min_jobs: number; min_crates: number; min_shifts: number; event_id: string | null; starts_on: string | null; ends_on: string | null; requires_approval: boolean; active: boolean };
const programsQuery = (org: string) => ({ queryKey: ["incentive", "programs", org], queryFn: async () => {
  const { data, error } = await supabase.from("incentive_programs").select("*").eq("organization_id", org).order("created_at");
  if (error) throw new Error(error.message); return (data ?? []) as Program[];
} });

function Bonuses({ org }: { org: string }) {
  const qc = useQueryClient();
  const { data: programs = [] } = useQuery(programsQuery(org));
  const [programId, setProgramId] = useState<string>("");
  const [date, setDate] = useState(isoDate(new Date()));
  const [status, setStatus] = useState<string>(ALL);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<string | null>(null);
  const program = programs.find((p) => p.id === programId) ?? programs[0];
  const { data: bonuses = [] } = useQuery({ queryKey: ["incentive", "bonuses", org], queryFn: async () => {
    const { data, error } = await supabase.from("operator_bonuses").select("*, operator:operators(full_name), program:incentive_programs(name), event:events(name)")
      .eq("organization_id", org).order("period_start", { ascending: false }).order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message); return data ?? [];
  } });
  const shown = bonuses.filter((b) => status === ALL || b.status === status);
  const refresh = () => qc.invalidateQueries({ queryKey: ["incentive"] });
  const calc = async () => {
    if (!program) return;
    setBusy(true);
    const start = program.period === "weekly" ? isoDate(weekStart(new Date(date + "T00:00:00"))) : date;
    const { data, error } = await supabase.rpc("calculate_bonuses", { _program: program.id, _period_start: start });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(`${data} operator${data === 1 ? "" : "s"} calculated or updated`); refresh(); }
  };
  const review = async (id: string, approve: boolean) => {
    const note = approve ? null : window.prompt("Reason for rejecting this bonus?");
    if (!approve && !note) return;
    const { error } = await supabase.rpc("review_bonus", { _bonus: id, _approve: approve, ...(note ? { _note: note } : {}) });
    if (error) toast.error(error.message); else { toast.success(approve ? "Bonus approved" : "Bonus rejected"); refresh(); }
  };
  const paid = async (id: string, isPaid: boolean) => {
    const ref = isPaid ? window.prompt("Payment note or reference (optional, e.g. payroll 11/22)") ?? "" : "";
    const { error } = await supabase.rpc("mark_bonus_paid", { _bonus: id, _paid: isPaid, ...(ref ? { _reference: ref } : {}) });
    if (error) toast.error(error.message); else { toast.success(isPaid ? "Marked paid" : "Payment record undone"); refresh(); }
  };
  const totals = useMemo(() => ({
    pending: shown.filter((b) => b.status === "pending_review").reduce((s, b) => s + Number(b.amount), 0),
    approved: shown.filter((b) => b.status === "approved").reduce((s, b) => s + Number(b.amount), 0),
    paid: shown.filter((b) => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0),
  }), [shown]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
        <div className="grid gap-1"><Label>Program</Label><Select value={program?.id ?? ""} onValueChange={setProgramId}><SelectTrigger className="w-64"><SelectValue placeholder="Choose program" /></SelectTrigger><SelectContent>{programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        {program?.period !== "event" && <div className="grid gap-1"><Label htmlFor="bd">{program?.period === "weekly" ? "Any day in the week" : "Day"}</Label><Input id="bd" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>}
        <Button variant="teal" onClick={calc} disabled={!program || busy}><Calculator />{busy ? "Calculating…" : "Calculate bonuses"}</Button>
        <p className="w-full text-xs text-muted-foreground">Calculating again updates unreviewed bonuses from the latest activity. Approved, rejected and paid bonuses stay locked.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{Object.entries(BONUS_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <span>Pending <b>{fmtMoney(totals.pending)}</b></span><span>Approved, unpaid <b>{fmtMoney(totals.approved)}</b></span><span>Paid <b>{fmtMoney(totals.paid)}</b></span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{["Operator", "Event", "Program · period", "Score", "Qualifying numbers", "Amount", "Status", ""].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{shown.map((b) => {
            const mt = b.metrics as { jobs_completed?: number; crates_delivered?: number; scan_compliance_pct?: number | null; on_time_pct?: number | null };
            return (
              <tr key={b.id} className="border-t border-border align-top">
                <td className="p-2 font-medium">{b.operator?.full_name}</td>
                <td className="p-2">{b.event?.name ?? "All events"}</td>
                <td className="p-2">{b.program?.name}<div className="text-xs text-muted-foreground">{b.period_start}{b.period_end !== b.period_start ? ` – ${b.period_end}` : ""}</div></td>
                <td className="p-2 font-mono font-semibold">{Math.round(Number(b.score))}</td>
                <td className="p-2 text-xs">{mt.jobs_completed} jobs · {mt.crates_delivered} crates · scans {fmtPct(mt.scan_compliance_pct)} · on time {fmtPct(mt.on_time_pct)} · {b.source_ticket_ids.length} source jobs
                  {b.ineligible_reasons.length > 0 && <div className="text-muted-foreground">{b.ineligible_reasons.join("; ")}</div>}
                  {b.review_note && <div className="text-muted-foreground">Note: {b.review_note}</div>}
                  {b.payment_reference && <div className="text-muted-foreground">Paid ref: {b.payment_reference}</div>}</td>
                <td className="p-2 font-mono">{fmtMoney(Number(b.amount))}</td>
                <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANT[b.status as BonusStatus]}`}>{BONUS_STATUS_LABEL[b.status as BonusStatus]}</span>
                  {b.reviewed_at && <div className="mt-1 text-[11px] text-muted-foreground">Reviewed {new Date(b.reviewed_at).toLocaleString()}</div>}
                  {b.paid_at && <div className="text-[11px] text-muted-foreground">Paid {new Date(b.paid_at).toLocaleDateString()}</div>}</td>
                <td className="p-2"><div className="flex flex-wrap justify-end gap-1">
                  {b.status === "pending_review" && <><Button size="sm" variant="teal" onClick={() => review(b.id, true)}><Check />Approve</Button><Button size="sm" variant="outline" onClick={() => review(b.id, false)}><X />Reject</Button></>}
                  {b.status === "approved" && <><Button size="sm" variant="outline" onClick={() => paid(b.id, true)}>Mark paid</Button><Button size="sm" variant="ghost" onClick={() => review(b.id, false)}>Reject</Button></>}
                  {b.status === "rejected" && <Button size="sm" variant="ghost" onClick={() => review(b.id, true)}>Approve</Button>}
                  {b.status === "paid" && <Button size="sm" variant="ghost" onClick={() => paid(b.id, false)}>Undo paid</Button>}
                  <Button size="sm" variant="ghost" aria-label="Bonus history" onClick={() => setAudit(b.id)}><History /></Button>
                </div></td>
              </tr>
            );
          })}{shown.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No bonuses yet. Choose a program and calculate.</td></tr>}</tbody>
        </table>
      </div>
      <Dialog open={!!audit} onOpenChange={(o) => !o && setAudit(null)}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Bonus history</DialogTitle></DialogHeader>{audit && <AuditList org={org} bonusId={audit} />}</DialogContent>
      </Dialog>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  calculated: "Calculated", recalculated: "Recalculated", approved: "Approved", rejected: "Rejected", marked_paid: "Marked paid",
  payment_undone: "Payment undone", weights_changed: "Score weights changed", program_created: "Program created", program_changed: "Program changed",
};
function AuditList({ org, bonusId }: { org: string; bonusId?: string }) {
  const { data: rows = [] } = useQuery({ queryKey: ["incentive", "audit", org, bonusId], queryFn: async () => {
    let q = supabase.from("bonus_audit_log").select("id, action, details, actor_id, created_at, operator:operators(full_name)").eq("organization_id", org).order("created_at", { ascending: false }).limit(200);
    if (bonusId) q = q.eq("bonus_id", bonusId);
    const { data, error } = await q; if (error) throw new Error(error.message); return data ?? [];
  } });
  return (
    <ol className="grid max-h-[60vh] gap-2 overflow-y-auto text-sm">
      {rows.map((r) => {
        const d = r.details as { old_score?: number; new_score?: number; score?: number; status?: string; note?: string; reference?: string };
        const extra = r.action === "recalculated" ? `Score ${d.old_score} → ${d.new_score}` : r.action === "calculated" ? `Score ${d.score}, ${String(d.status).replace("_", " ")}` : d.note ? `“${d.note}”` : d.reference ? `Ref ${d.reference}` : "";
        return (
          <li key={r.id} className="rounded-md border border-border p-3">
            <div className="flex justify-between gap-2"><b>{ACTION_LABEL[r.action] ?? r.action}{r.operator?.full_name ? ` · ${r.operator.full_name}` : ""}</b><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span></div>
            {extra && <div className="text-muted-foreground">{extra}</div>}
            <div className="text-xs text-muted-foreground">{r.actor_id ? "By a company admin" : "System"}</div>
          </li>
        );
      })}
      {rows.length === 0 && <li className="text-muted-foreground">No history yet.</li>}
    </ol>
  );
}

function Programs({ org }: { org: string }) {
  const qc = useQueryClient();
  const events = useEvents();
  const { data: programs = [] } = useQuery(programsQuery(org));
  const [edit, setEdit] = useState<Partial<Program> | null>(null);
  const save = async () => {
    if (!edit?.name?.trim()) { toast.error("Name the program"); return; }
    const row = { name: edit.name.trim(), period: edit.period ?? "daily", amount: Number(edit.amount ?? 0), min_score: Number(edit.min_score ?? 80),
      min_scan_compliance: Number(edit.min_scan_compliance ?? 95), min_jobs: Number(edit.min_jobs ?? 1), min_crates: Number(edit.min_crates ?? 0), min_shifts: Number(edit.min_shifts ?? 1),
      event_id: edit.event_id || null, starts_on: edit.starts_on || null, ends_on: edit.ends_on || null, requires_approval: edit.requires_approval ?? true, active: edit.active ?? true };
    const { error } = edit.id ? await supabase.from("incentive_programs").update(row).eq("id", edit.id) : await supabase.from("incentive_programs").insert({ ...row, organization_id: org });
    if (error) toast.error(error.message); else { toast.success("Program saved"); setEdit(null); qc.invalidateQueries({ queryKey: ["incentive"] }); }
  };
  const num = (k: keyof Program, label: string, step = "1") => (
    <div className="grid gap-1"><Label htmlFor={k}>{label}</Label><Input id={k} type="number" min={0} step={step} value={(edit?.[k] as number | undefined) ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
  );
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><Button variant="teal" onClick={() => setEdit({ period: "daily", amount: 20, min_score: 80, min_scan_compliance: 95, min_jobs: 1, min_crates: 0, min_shifts: 1, requires_approval: true, active: true })}><Plus />New program</Button></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {programs.map((p) => (
          <button key={p.id} onClick={() => setEdit(p)} className="grid gap-1 rounded-lg border border-border p-4 text-left transition hover:border-teal">
            <div className="flex items-center justify-between"><b>{p.name}</b>{!p.active && <Badge variant="secondary">Off</Badge>}</div>
            <div className="font-mono text-2xl font-bold">{fmtMoney(Number(p.amount))}</div>
            <div className="text-xs text-muted-foreground">{PERIOD_LABEL[p.period as IncentivePeriod]}{p.event_id ? ` · ${events.find((e) => e.id === p.event_id)?.name ?? ""}` : ""} · score ≥ {p.min_score} · scans ≥ {p.min_scan_compliance}% · {p.min_jobs}+ jobs · {p.min_crates}+ crates · {p.min_shifts}+ shifts{p.requires_approval ? " · needs approval" : " · auto-approved"}</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Amounts are examples you can change. Your company funds and pays every bonus; ExpoHaul only tracks it.</p>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit program" : "New bonus program"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label htmlFor="pn">Name</Label><Input id="pn" value={edit?.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Period</Label><Select value={edit?.period ?? "daily"} onValueChange={(v) => setEdit({ ...edit, period: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PERIOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              {num("amount", "Amount ($)", "0.01")}
              <div className="col-span-2 grid gap-1"><Label>Event {edit?.period === "event" ? "(required)" : "(optional)"}</Label><Select value={edit?.event_id ?? ALL} onValueChange={(v) => setEdit({ ...edit, event_id: v === ALL ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All events</SelectItem>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
              {num("min_score", "Minimum score (0–100)")}{num("min_scan_compliance", "Minimum scan compliance %")}
              {num("min_jobs", "Minimum jobs")}{num("min_crates", "Minimum crates")}{num("min_shifts", "Minimum shifts")}
              <div />
              <div className="grid gap-1"><Label htmlFor="ps">Eligible from</Label><Input id="ps" type="date" value={edit?.starts_on ?? ""} onChange={(e) => setEdit({ ...edit, starts_on: e.target.value })} /></div>
              <div className="grid gap-1"><Label htmlFor="pe">Eligible until</Label><Input id="pe" type="date" value={edit?.ends_on ?? ""} onChange={(e) => setEdit({ ...edit, ends_on: e.target.value })} /></div>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">Manager approval required<Switch checked={edit?.requires_approval ?? true} onCheckedChange={(v) => setEdit({ ...edit, requires_approval: v })} /></label>
            <label className="flex items-center justify-between gap-3 text-sm">Active<Switch checked={edit?.active ?? true} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /></label>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button variant="teal" onClick={save}>Save program</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeightsForm({ org }: { org: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["incentive", "settings", org], queryFn: async () => (await supabase.from("incentive_settings").select("*").eq("organization_id", org).maybeSingle()).data });
  const [w, setW] = useState<Weights>(DEFAULT_WEIGHTS);
  const [extra, setExtra] = useState({ daily_goal_crates: 10, on_time_minutes: 45, target_units_per_hour: 4 });
  useEffect(() => { if (data) {
    setW({ w_productivity: data.w_productivity, w_accuracy: data.w_accuracy, w_on_time: data.w_on_time, w_documentation: data.w_documentation, w_reliability: data.w_reliability });
    setExtra({ daily_goal_crates: data.daily_goal_crates, on_time_minutes: data.on_time_minutes, target_units_per_hour: Number(data.target_units_per_hour) });
  } }, [data]);
  const err = weightsError(w);
  const save = async () => {
    if (err) { toast.error(err); return; }
    const { error } = await supabase.from("incentive_settings").upsert({ organization_id: org, ...w, ...extra });
    if (error) toast.error(error.message); else { toast.success("Score settings saved"); qc.invalidateQueries({ queryKey: ["incentive"] }); }
  };
  return (
    <div className="grid max-w-xl gap-4">
      {(Object.keys(WEIGHT_LABEL) as (keyof Weights)[]).map((k) => (
        <div key={k} className="flex items-center justify-between gap-4"><Label htmlFor={k}>{WEIGHT_LABEL[k]}</Label><Input id={k} className="w-24 text-right" type="number" min={0} max={100} value={w[k]} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })} /></div>
      ))}
      <div className={`text-sm ${err ? "text-destructive" : "text-muted-foreground"}`}>{err ?? "Total 100 points."}</div>
      <div className="grid gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-4"><Label htmlFor="g">Driver daily goal (crates)</Label><Input id="g" className="w-24 text-right" type="number" min={1} value={extra.daily_goal_crates} onChange={(e) => setExtra({ ...extra, daily_goal_crates: Number(e.target.value) })} /></div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor="ot">On-time target per crate (minutes from assignment)</Label><Input id="ot" className="w-24 text-right" type="number" min={1} value={extra.on_time_minutes} onChange={(e) => setExtra({ ...extra, on_time_minutes: Number(e.target.value) })} /></div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor="u">Full productivity at (work units per hour)</Label><Input id="u" className="w-24 text-right" type="number" min={0.5} step={0.5} value={extra.target_units_per_hour} onChange={(e) => setExtra({ ...extra, target_units_per_hour: Number(e.target.value) })} /></div>
        <p className="text-xs text-muted-foreground">A work unit is 1 crate, plus ½ per job and 1 per ton moved. Bigger multi-crate jobs get extra on-time allowance. Hitting the target gives full productivity points, and going faster adds nothing.</p>
      </div>
      <div><Button variant="teal" onClick={save} disabled={!!err}>Save score settings</Button></div>
    </div>
  );
}
