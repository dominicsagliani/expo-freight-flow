import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MyPerformance } from "@/components/app/operator-performance";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Camera, CheckCircle2, ClipboardCheck, Package, Pause, Play, ScanLine, X, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "@/components/app/qr-scanner";
import { PriorityBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseScanToken } from "@/lib/scan-token";
import { SERVICE_LABEL } from "@/lib/labels";
import { fmtDuration, ISSUE_TYPES, PAUSE_REASONS, sessionSeconds, type IssueType } from "@/lib/work-session";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { EQUIPMENT_CLASSES, FUEL_TYPES } from "@/lib/fleet";
import { useAutoInvoice } from "@/components/app/service-payment";
import { driverRosterQuery } from "@/lib/queries";
import { EquipmentPhoto } from "@/components/app/equipment-photo";

export const Route = createFileRoute("/_authenticated/forklift")({
  head: () => ({
    meta: [
      { title: "Forklift Mode — ExpoHaul" },
      { name: "description", content: "Full-screen forklift operator mode: jobs, freight scanning, timers and delivery confirmation." },
      { property: "og:title", content: "Forklift Mode — ExpoHaul" },
      { property: "og:description", content: "Full-screen forklift operator mode for trade show material handling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForkliftMode,
});

const JOB_SELECT = `id, ticket_number, status, priority, service_type, booth_number, destination, special_instructions,
  assigned_operator_id, completed_at, request_source, service_only, estimated_weight_lbs,
  event:events(name), exhibitor:exhibitors(company_name),
  ticket_freight(freight_id, picked_up_at, delivered_at, flag,
    freight:freight_items(id, freight_code, description, pieces, freight_type, booth_number, storage_location)),
  work_sessions(id, equipment_id, operator_id, status, started_at, ended_at, paused_at, paused_seconds)`;

type View = "home" | "scan" | "freight" | "issue" | "pause";
type ScanResult = { ok: boolean; error?: string; action?: string; freight_code?: string; description?: string; exhibitor?: string; booth?: string; ticket_number?: string; timer_stopped?: boolean; job_completed?: boolean };

async function uploadPhoto(ticketId: string, file: File, extra: { freight_id?: string; delivery_update_id?: string }) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("ticket-photos").upload(path, file, { contentType: file.type });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from("ticket_photos").insert({
    ticket_id: ticketId, storage_path: path, organization_id: "00000000-0000-0000-0000-000000000000", ...extra,
  });
  if (error) throw new Error(error.message);
}

function ForkliftMode() {
  const autoInvoice = useAutoInvoice();
  const qc = useQueryClient();
  const [forklift, setForklift] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>("home");
  const [scanTicket, setScanTicket] = useState<string | null>(null);
  const [tab, setTab] = useState<"current" | "next" | "done" | "perf">("current");
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  useRealtimeRefresh(["tickets", "work_sessions", "ticket_freight"], [["forklift-jobs"]]);

  const { data: me } = useQuery({
    queryKey: ["forklift-me"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("forklift_current");
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => ({ id: d.operator_id, full_name: d.full_name, event_id: d.event_id }));
    },
  });
  const switchOperator = async () => {
    const { error } = await supabase.rpc("fleet_release");
    if (error) { toast.error(error.message); return; }
    await supabase.rpc("forklift_lock");
    setForklift(null);
    setSelected(null); setView("home");
    qc.invalidateQueries({ queryKey: ["forklift-me"] });
    qc.removeQueries({ queryKey: ["forklift-jobs"] });
    qc.removeQueries({ queryKey: ["forklift-queue"] });
  };
  const { data: equipment = [] } = useQuery({
    queryKey: ["forklift-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").is("retired_at", null).order("unit_number");
      if (error) throw new Error(error.message); return data ?? [];
    },
    refetchInterval: 15_000,
  });
  const { data: queueState } = useQuery({
    queryKey: ["forklift-queue", me?.[0]?.id], enabled: !!me?.[0]?.id,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase.from("queue_drivers").select("equipment_id, ready, operator_id").eq("user_id", auth.user.id).maybeSingle();
      if (error) throw new Error(error.message); return data;
    },
  });
  useEffect(() => { setForklift(queueState?.equipment_id ?? null); }, [queueState]);
  useEffect(() => {
    if (!forklift || !me?.[0]?.id) return;
    let active = true;
    const poll = async () => {
      const { error } = await supabase.rpc("queue_poll", {});
      if (!active) return;
      if (error) { toast.error(error.message); return; }
      qc.invalidateQueries({ queryKey: ["forklift-jobs"] });
    };
    void poll(); const interval = setInterval(poll, 10_000);
    return () => { active = false; clearInterval(interval); };
  }, [forklift, me?.[0]?.id, qc]);
  const myIds = useMemo(() => (me ?? []).map((m) => m.id), [me]);
  const { data: jobs = [] } = useQuery({
    queryKey: ["forklift-jobs", myIds],
    enabled: myIds.length > 0,
    queryFn: async () => {
      const { data: crew } = await supabase.from("ticket_crew").select("ticket_id").in("operator_id", myIds);
      const ids = (crew ?? []).map((c) => c.ticket_id);
      const filter = `assigned_operator_id.in.(${myIds.join(",")})${ids.length ? `,id.in.(${ids.join(",")})` : ""}`;
      const { data, error } = await supabase.from("tickets").select(JOB_SELECT).or(filter)
        .eq("event_id", me?.[0]?.event_id ?? "")
        .in("status", ["assigned", "in_progress", "completed"]).order("requested_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const today = new Date().toDateString();
  const open = jobs.filter((j) => j.status !== "completed");
  const done = jobs.filter((j) => j.status === "completed" && j.completed_at && new Date(j.completed_at).toDateString() === today);
  const current = open.find((j) => j.id === selected) ?? open.find((j) => j.status === "in_progress") ?? open[0];
  const scanJob = jobs.find((j) => j.id === scanTicket) ?? current;
  const next = open.filter((j) => j.id !== current?.id);
  const mySession = current?.work_sessions.find((s) => s.status !== "completed" && s.equipment_id === forklift);
  const tf = current?.ticket_freight ?? [];
  const picked = tf.filter((x) => x.picked_up_at).length;
  const delivered = tf.filter((x) => x.delivered_at).length;
  const forkliftName = equipment.find((e) => e.id === forklift)?.unit_number;
  const refresh = () => qc.invalidateQueries({ queryKey: ["forklift-jobs"] });
  const notified = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const job of jobs) {
      if (job.status === "assigned" && !notified.current.has(job.id)) {
        notified.current.add(job.id);
        toast.success(`New dispatch: ${job.ticket_number} · ${job.destination ?? job.booth_number ?? ""}`, { duration: 8000 });
        setTab("current");
      }
    }
  }, [jobs]);
  const callIn = current?.request_source !== "standard" && tf.length === 0;

  const rpc = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await fn();
    if (error) { toast.error(error.message); return false; }
    toast.success(ok); refresh(); return true;
  };

  const accept = async () => {
    if (!current) return;
    if (current.status === "assigned" && myIds.includes(current.assigned_operator_id ?? "")) {
      await rpc(() => supabase.rpc("operator_start_job", { _ticket: current.id }), "Job accepted");
    } else toast.message("Job open — scan your first pickup to start the timer");
  };
  const completeDelivery = async () => {
    if (!current) return;
    if (callIn) {
      if (!confirm(`Complete request ${current.ticket_number}?`)) return;
      if (await rpc(() => supabase.rpc("op_complete_call_in", { _ticket: current.id }), "Request completed")) { autoInvoice(current.id); setSelected(null); refresh(); }
      return;
    }
    setScanTicket(current.id);
    setView("scan");
  };

  if (!me || me.length === 0 || !forklift) {
    return <Shell onExit><GoOnline equipment={equipment} onOnline={(id) => {
      setForklift(id);
      qc.invalidateQueries({ queryKey: ["forklift-me"] }); qc.invalidateQueries({ queryKey: ["forklift-queue"] });
    }} /></Shell>;
  }

  const ready = !!queueState?.ready;
  const header = (
    <div className="flex flex-wrap items-center gap-3 border-b border-primary-foreground/10 bg-primary-foreground/[0.03] px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="grid size-14 place-items-center rounded-2xl bg-accent font-mono text-lg font-black text-accent-foreground shadow-lg">{(forkliftName ?? "FL").replace(/^FL-?/i, "") || "FL"}</div>
        <div className="min-w-0 max-w-[60vw] sm:max-w-none">
          <div className="font-mono text-xl font-bold leading-tight">{forkliftName ?? "Forklift"}</div>
          <div className="truncate text-base text-primary-foreground/70">{me[0]?.full_name} · {current?.event?.name ?? "No active event"}</div>
        </div>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full bg-status-completed px-3 py-1.5 text-sm font-bold uppercase tracking-wider text-primary-foreground">
        <span className="size-2.5 animate-pulse rounded-full bg-primary-foreground" />Online
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        <button type="button" onClick={async () => {
          const { error } = await supabase.rpc("queue_poll", { _ready: !ready });
          if (error) toast.error(error.message);
          qc.invalidateQueries({ queryKey: ["forklift-queue"] }); refresh();
        }} className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-bold ${ready ? "bg-primary-foreground/10" : "bg-status-requested text-primary-foreground"}`}>
          {ready ? <Pause className="size-5" /> : <Play className="size-5" />}{ready ? "Take a break" : "On break · Resume"}
        </button>
        <button type="button" onClick={switchOperator} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-destructive px-5 text-base font-bold uppercase tracking-wide text-destructive-foreground">
          <XCircle className="size-5" />Offline
        </button>
      </div>
    </div>
  );

  if (view === "scan" && scanJob) {
    return <Shell onBack={() => { setScanTicket(null); setView("home"); }}>{header}<ScanScreen key={scanJob.id} job={scanJob} forklift={forklift} onDone={refresh} onCompleted={() => { setScanTicket(null); setSelected(null); setView("home"); refresh(); }} /></Shell>;
  }
  if (view === "freight" && current) {
    return (
      <Shell onBack={() => setView("home")}>{header}
        <div className="grid gap-3 p-5">
          <h2 className="text-2xl font-bold">Freight on {current.ticket_number}</h2>
          {tf.map((x) => (
            <div key={x.freight_id} className="flex items-center justify-between gap-4 rounded-xl bg-primary-foreground/5 p-4">
              <div>
                <div className="font-mono text-xl font-bold">{x.freight?.freight_code}</div>
                <div className="text-lg">{x.freight?.pieces} × {x.freight?.freight_type} · {x.freight?.description}</div>
                <div className="text-primary-foreground/70">From {x.freight?.storage_location ?? "—"} → Booth {x.freight?.booth_number ?? current.booth_number ?? "—"}</div>
              </div>
              <StatusPill tf={x} />
            </div>
          ))}
        </div>
      </Shell>
    );
  }
  if (view === "issue" && current) {
    return <Shell onBack={() => setView("home")}>{header}<IssueScreen ticketId={current.id} onDone={() => setView("home")} /></Shell>;
  }
  if (view === "pause" && mySession) {
    return (
      <Shell onBack={() => setView("home")}>{header}
        <div className="grid gap-4 p-5">
          <h2 className="text-2xl font-bold">Why are you pausing?</h2>
          <div className="grid grid-cols-2 gap-4">
            {PAUSE_REASONS.map((r) => (
              <BigButton key={r} onClick={async () => {
                if (await rpc(() => supabase.rpc("op_pause_session", { _session: mySession.id, _reason: r }), "Timer paused")) setView("home");
              }}>{r}</BigButton>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  const nextStep = !current ? null
    : current.status === "assigned" ? { label: "Accept job", hint: "Confirm you're heading to pickup", icon: <ClipboardCheck className="size-10" />, tone: "light" as const, run: accept, disabled: false }
    : callIn ? (!mySession
        ? { label: "Start work", hint: "Starts the billable timer", icon: <Play className="size-10" />, tone: "accent" as const, run: () => rpc(() => supabase.rpc("op_start_session", { _ticket: current.id, _equipment: forklift }), "Work timer started"), disabled: false }
        : { label: "Complete request", hint: "Stops the timer and bills the job", icon: <CheckCircle2 className="size-10" />, tone: "success" as const, run: completeDelivery, disabled: false })
    : { label: picked > delivered ? "Scan out at booth" : "Scan freight in", hint: picked > delivered ? `Deliver to Booth ${current.booth_number ?? "—"}` : "Scan the crate QR at pickup to start the timer", icon: <ScanLine className="size-10" />, tone: picked > delivered ? "success" as const : "accent" as const, run: () => { setScanTicket(current.id); setView("scan"); }, disabled: false };
  const stepIdx = !current ? 0 : current.status === "assigned" ? 0 : delivered > 0 && delivered >= tf.length && tf.length > 0 ? 3 : picked > 0 || mySession ? 2 : 1;
  const steps = ["Assigned", "En route", "On forks", "Delivered"];
  const tones = { light: "bg-primary-foreground text-primary", accent: "bg-accent text-accent-foreground", success: "bg-status-completed text-primary-foreground" };

  return (
    <Shell onExit>
      {header}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        {([["current", "Current job"], ["next", `Up next · ${next.length}`], ["done", `Done today · ${done.length}`], ["perf", "My performance"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`min-h-12 rounded-full px-5 text-lg font-semibold transition-colors ${tab === k ? "bg-primary-foreground text-primary" : "bg-primary-foreground/10 hover:bg-primary-foreground/15"}`}>{l}</button>
        ))}
      </div>

      {tab === "perf" && me?.[0]?.id && <MyPerformance operatorId={me[0].id} />}
      {tab === "next" && (
        <div className="grid gap-3 p-5 md:grid-cols-2">
          {next.length === 0 && <EmptyState title="Nothing else queued" body="New jobs appear here the moment dispatch sends them." />}
          {next.map((j, i) => (
            <button key={j.id} onClick={() => { setSelected(j.id); setTab("current"); }}
              className="grid gap-2 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5 text-left transition hover:bg-primary-foreground/10">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-primary-foreground/10 font-bold">{i + 1}</span><span className="font-mono text-xl font-bold">{j.ticket_number}</span><PriorityBadge priority={j.priority} /></div>
              <div className="text-xl font-semibold">{j.exhibitor?.company_name}</div>
              <div className="text-lg text-primary-foreground/70">Booth {j.booth_number ?? "—"} · {j.ticket_freight.length} {j.ticket_freight.length === 1 ? "crate" : "crates"}</div>
            </button>
          ))}
        </div>
      )}
      {tab === "done" && (
        <div className="grid gap-3 p-5">
          {done.length === 0 && <EmptyState title="No deliveries yet today" body="Completed jobs land here." />}
          {done.map((j) => (
            <div key={j.id} className="flex items-center gap-4 rounded-2xl bg-primary-foreground/5 p-4 text-lg">
              <CheckCircle2 className="size-8 shrink-0 text-status-completed" />
              <div><span className="font-mono font-bold">{j.ticket_number}</span> · {j.exhibitor?.company_name} · Booth {j.booth_number ?? "—"}</div>
            </div>
          ))}
        </div>
      )}
      {tab === "current" && !current && (
        <div className="grid place-items-center gap-4 px-5 py-16 text-center">
          <div className="relative grid size-32 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            <span className="relative grid size-24 place-items-center rounded-full bg-accent/20"><Package className="size-12 text-accent" /></span>
          </div>
          <div className="text-3xl font-bold">{ready ? "Waiting for your next job" : "You're on break"}</div>
          <p className="max-w-md text-xl text-primary-foreground/70">{ready ? "Stay on this screen. Dispatch will send the next job straight to this forklift." : "Tap Resume at the top when you're ready for jobs."}</p>
        </div>
      )}
      {tab === "current" && current && nextStep && (
        <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid content-start gap-5">
            <div className="overflow-hidden rounded-3xl bg-primary-foreground text-primary shadow-2xl">
              <div className="flex flex-wrap items-center gap-3 bg-primary-foreground px-6 pt-5">
                <span className="font-mono text-lg font-bold text-primary/60">{current.ticket_number}</span>
                <PriorityBadge priority={current.priority} />
                <span className="text-base text-primary/60">{SERVICE_LABEL[current.service_type]}</span>
              </div>
              <div className="grid gap-1 px-6 pb-4 pt-2">
                <div className="text-sm font-bold uppercase tracking-widest text-primary/50">Deliver to</div>
                <div className="flex items-baseline gap-3"><span className="text-6xl font-black leading-none">{current.booth_number ?? "—"}</span><span className="text-xl font-semibold text-primary/60">Booth</span></div>
                <div className="text-2xl font-semibold">{current.exhibitor?.company_name}</div>
                {current.destination && <div className="text-lg text-primary/70">{current.destination}</div>}
              </div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 border-t border-primary/10 px-6 py-4 text-lg">
                <span className="text-sm font-bold uppercase tracking-widest text-primary/50">Pickup</span>
                <span className="font-semibold">{[...new Set(tf.map((x) => x.freight?.storage_location).filter(Boolean))].join(", ") || "—"}</span>
                <span className="text-sm font-bold uppercase tracking-widest text-primary/50">Crates</span>
                <span className="font-semibold">{tf.length} · {picked} on forks · {delivered} delivered</span>
              </div>
              {current.special_instructions && (
                <div className="mx-6 mb-5 rounded-xl border-2 border-accent bg-accent/10 p-3 text-lg"><b>Instructions:</b> {current.special_instructions}</div>
              )}
              <div className="flex gap-1 px-6 pb-6">
                {steps.map((label, i) => (
                  <div key={label} className="grid flex-1 gap-1.5">
                    <div className={`h-2 rounded-full ${i <= stepIdx ? "bg-status-completed" : "bg-primary/15"}`} />
                    <span className={`text-sm font-semibold ${i <= stepIdx ? "text-primary" : "text-primary/40"}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={nextStep.run} disabled={nextStep.disabled}
              className={`flex min-h-28 items-center gap-5 rounded-3xl px-7 text-left shadow-xl transition active:scale-[0.99] disabled:opacity-40 ${tones[nextStep.tone]}`}>
              {nextStep.icon}
              <span className="grid"><span className="text-2xl font-black uppercase tracking-wide sm:text-3xl">{nextStep.label}</span><span className="text-lg opacity-80">{nextStep.hint}</span></span>
            </button>
            {next[0] && (
              <button type="button" onClick={() => setTab("next")} className="flex items-center gap-3 rounded-2xl bg-primary-foreground/5 px-5 py-4 text-left text-lg">
                <span className="text-sm font-bold uppercase tracking-widest text-primary-foreground/50">Up next</span>
                <span className="font-mono font-bold">{next[0].ticket_number}</span>
                <span className="truncate text-primary-foreground/70">{next[0].exhibitor?.company_name} · Booth {next[0].booth_number ?? "—"}</span>
              </button>
            )}
          </div>
          <div className="grid content-start gap-4">
            <div className={`rounded-3xl p-6 text-center ${mySession?.status === "paused" ? "bg-status-requested" : mySession ? "bg-accent text-accent-foreground" : "bg-primary-foreground/10"}`}>
              <div className="flex items-center justify-center gap-2 text-base font-bold uppercase tracking-widest">
                {mySession && mySession.status !== "paused" && <span className="size-2.5 animate-pulse rounded-full bg-current" />}
                {mySession ? (mySession.status === "paused" ? "Paused" : "Timer running") : "Timer not started"}
              </div>
              <div className="font-mono text-7xl font-bold tabular-nums">{fmtDuration(mySession ? sessionSeconds(mySession, now) : 0)}</div>
              {current.work_sessions.filter((s) => s.status !== "completed").length > 1 && (
                <div className="mt-1 text-base">{current.work_sessions.filter((s) => s.status !== "completed").length} forklifts on this job</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <BigButton onClick={() => setView("freight")}><Package className="size-8" />Crates</BigButton>
              {mySession?.status === "paused" ? (
                <BigButton onClick={() => rpc(() => supabase.rpc("op_resume_session", { _session: mySession.id }), "Timer resumed")}><Play className="size-8" />Resume</BigButton>
              ) : (
                <BigButton onClick={() => setView("pause")} disabled={!mySession}><Pause className="size-8" />Pause</BigButton>
              )}
              {!callIn && current.status !== "assigned" && nextStep.label !== "Scan freight in" && (
                <BigButton onClick={() => { setScanTicket(current.id); setView("scan"); }}><ScanLine className="size-8" />Scan</BigButton>
              )}
              <BigButton tone="danger" onClick={() => setView("issue")}><AlertTriangle className="size-8" />Issue</BigButton>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function ScanScreen({ job, forklift, onDone, onCompleted }: { job: { id: string; booth_number: string | null }; forklift: string; onDone: () => void; onCompleted: () => void }) {
  const autoInvoice = useAutoInvoice();
  const [mode, setMode] = useState<"pickup" | "deliver">("pickup");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [wedge, setWedge] = useState("");
  const [busy, setBusy] = useState(false);
  const wedgeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { wedgeRef.current?.focus(); }, [mode, result, pending]);

  const submit = async (token: string, extra: { booth_ok?: boolean; flag?: string | null; note?: string; photo?: File | null } = {}) => {
    setBusy(true);
    const args: { _token: string; _ticket: string; _action: string; _equipment: string; _booth_ok?: boolean; _flag?: string; _note?: string } =
      { _token: token, _ticket: job.id, _action: mode, _equipment: forklift };
    if (extra.booth_ok !== undefined) args._booth_ok = extra.booth_ok;
    if (extra.flag) args._flag = extra.flag;
    if (extra.note) args._note = extra.note;
    const { data, error } = await supabase.rpc("op_scan_freight", args);
    setBusy(false);
    if (error) { setResult({ ok: false, error: error.message }); return; }
    const r = data as unknown as ScanResult & { freight_id?: string };
    if (r.ok && extra.photo && r.freight_id) {
      try { await uploadPhoto(job.id, extra.photo, { freight_id: r.freight_id }); } catch (e) { toast.error((e as Error).message); }
    }
    setPending(null); setResult(r);
    if (r.ok && r.job_completed) autoInvoice(job.id);
    if (!r.job_completed) onDone();
  };
  const onScan = (raw: string) => {
    if (busy || result || pending) return;
    const token = parseScanToken(raw);
    if (!token) { setResult({ ok: false, error: "Not an ExpoHaul freight label" }); return; }
    if (mode === "deliver") setPending(token); else submit(token);
  };

  if (result) {
    return (
      <div className={`m-5 grid place-items-center gap-4 rounded-2xl p-10 text-center ${result.ok ? "bg-status-completed" : "bg-destructive"} text-primary-foreground`}>
        {result.ok ? <CheckCircle2 className="size-24" /> : <XCircle className="size-24" />}
        <div className="text-4xl font-bold">{result.ok ? (result.action === "pickup" ? "SCANNED IN" : "SCANNED OUT") : result.error}</div>
        {result.ok && <div className="text-xl">{result.job_completed ? "Job completed · Charge added to customer account" : result.timer_stopped ? "Driver timer stopped" : "Driver timer running"}</div>}
        {result.freight_code && <div className="font-mono text-2xl">{result.freight_code}</div>}
        {result.description && <div className="text-xl">{result.description}</div>}
        {(result.exhibitor || result.booth) && <div className="text-xl">{result.exhibitor} · Booth {result.booth ?? "—"}{result.ticket_number ? ` · ${result.ticket_number}` : ""}</div>}
        <BigButton onClick={() => result.job_completed ? onCompleted() : setResult(null)}>{result.job_completed ? "Next job" : "Scan next"}</BigButton>
      </div>
    );
  }
  if (pending) return <DeliverConfirm booth={job.booth_number} busy={busy} onCancel={() => setPending(null)} onConfirm={(x) => submit(pending, x)} />;

  return (
    <div className="grid gap-4 p-5">
      <div className="grid grid-cols-2 gap-3">
        {(["pickup", "deliver"] as const).map((m) => (
          <Button variant="inverse" key={m} onClick={() => setMode(m)}
            className={`min-h-16 rounded-xl text-2xl font-bold ${mode === m ? "bg-accent text-accent-foreground" : "bg-primary-foreground/10"}`}>
            {m === "pickup" ? "SCAN IN" : "SCAN OUT"}
          </Button>
        ))}
      </div>
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-background text-foreground"><QrScanner onResult={onScan} /></div>
      <form className="mx-auto flex w-full max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); onScan(wedge); setWedge(""); }}>
        <Input ref={wedgeRef} value={wedge} onChange={(e) => setWedge(e.target.value)} placeholder="Hardware scanner / type code"
          className="h-14 bg-background text-lg text-foreground" aria-label="Scanner input" />
        <Button type="submit" size="lg" variant="secondary" className="h-14">Go</Button>
      </form>
    </div>
  );
}

function DeliverConfirm({ booth, busy, onCancel, onConfirm }: {
  booth: string | null; busy: boolean; onCancel: () => void;
  onConfirm: (x: { booth_ok: boolean; flag: string | null; note: string; photo: File | null }) => void;
}) {
  const [boothOk, setBoothOk] = useState(true);
  const [flag, setFlag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  return (
    <div className="grid gap-4 p-5">
      <h2 className="text-3xl font-bold">Confirm delivery</h2>
      <div className="grid grid-cols-2 gap-3">
        <Toggle on={boothOk} onClick={() => setBoothOk(true)}>At booth {booth ?? "—"} ✓</Toggle>
        <Toggle on={!boothOk} onClick={() => setBoothOk(false)}>Booth doesn't match</Toggle>
        <Toggle on={flag === "damaged"} onClick={() => setFlag(flag === "damaged" ? null : "damaged")}>Damaged</Toggle>
        <Toggle on={flag === "missing"} onClick={() => setFlag(flag === "missing" ? null : "missing")}>Pieces missing</Toggle>
      </div>
      <label className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-xl bg-primary-foreground/10 text-xl font-semibold">
        <Camera className="size-7" /> {photo ? "Photo added ✓" : "Take delivery photo"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </label>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="bg-background text-lg text-foreground" />
      <div className="grid grid-cols-2 gap-3">
        <BigButton onClick={onCancel}><X className="size-8" />Cancel</BigButton>
        <BigButton tone="success" disabled={busy || !boothOk} onClick={() => onConfirm({ booth_ok: boothOk, flag, note, photo })}><CheckCircle2 className="size-8" />Confirm scan-out</BigButton>
      </div>
    </div>
  );
}

function IssueScreen({ ticketId, onDone }: { ticketId: string; onDone: () => void }) {
  const [type, setType] = useState<IssueType | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!type) return;
    setBusy(true);
    const { data, error } = await supabase.from("delivery_updates").insert({
      ticket_id: ticketId, kind: "issue", issue_type: type, note: note.trim() || null,
      organization_id: "00000000-0000-0000-0000-000000000000",
    }).select("id").single();
    if (!error && photo && data) {
      try { await uploadPhoto(ticketId, photo, { delivery_update_id: data.id }); } catch (e) { toast.error((e as Error).message); }
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Issue sent to dispatch");
    onDone();
  };
  return (
    <div className="grid gap-4 p-5">
      <h2 className="text-3xl font-bold">Report an issue</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {ISSUE_TYPES.map((i) => <Toggle key={i.key} on={type === i.key} onClick={() => setType(i.key)}>{i.label}</Toggle>)}
      </div>
      <label className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-xl bg-primary-foreground/10 text-xl font-semibold">
        <Camera className="size-7" /> {photo ? "Photo added ✓" : "Attach photo"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </label>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="bg-background text-lg text-foreground" />
      <BigButton tone="danger" disabled={!type || busy} onClick={send}><AlertTriangle className="size-8" />Send to dispatch</BigButton>
    </div>
  );
}

function StatusPill({ tf }: { tf: { picked_up_at: string | null; delivered_at: string | null; flag: string | null } }) {
  const [label, cls] = tf.delivered_at ? ["Delivered", "bg-status-completed"] : tf.picked_up_at ? ["Picked up", "bg-accent text-accent-foreground"] : ["Waiting", "bg-primary-foreground/15"];
  return <span className={`shrink-0 rounded-lg px-4 py-2 text-lg font-bold ${cls}`}>{label}{tf.flag ? ` · ${tf.flag}` : ""}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-primary-foreground/10 p-3"><div className="text-4xl font-bold tabular-nums">{value}</div><div className="text-base">{label}</div></div>;
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`min-h-20 rounded-xl border-2 px-3 text-xl font-semibold ${on ? "border-accent bg-accent text-accent-foreground" : "border-primary-foreground/20 bg-primary-foreground/5"}`}>
      {children}
    </button>
  );
}

function BigButton({ children, onClick, disabled, tone }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "accent" | "success" | "danger" }) {
  const toneCls = tone === "accent" ? "bg-accent text-accent-foreground" : tone === "success" ? "bg-status-completed text-primary-foreground"
    : tone === "danger" ? "bg-destructive text-destructive-foreground" : "bg-primary-foreground text-primary";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl px-3 transition active:scale-[0.98] text-xl font-bold uppercase tracking-wide disabled:opacity-35 ${toneCls}`}>
      {children}
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="col-span-full grid gap-1 rounded-2xl border border-dashed border-primary-foreground/20 p-8 text-center"><div className="text-2xl font-bold">{title}</div><div className="text-lg text-primary-foreground/70">{body}</div></div>;
}

function Shell({ children, onBack, onExit }: { children: React.ReactNode; onBack?: () => void; onExit?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-primary text-primary-foreground">
      <div className="flex items-center justify-between bg-sidebar px-5 py-2 text-sidebar-foreground">
        {onBack ? <button onClick={onBack} className="flex min-h-12 items-center gap-2 text-xl font-semibold"><ArrowLeft className="size-6" />Back</button>
          : <span className="text-lg font-bold tracking-wide">EXPOHAUL · FORKLIFT</span>}
        {onExit && <Link to="/operator" className="text-base underline">Exit forklift mode</Link>}
      </div>
      {children}
    </div>
  );
}

function GoOnline({ equipment, onOnline }: { equipment: { id: string; unit_number: string; model: string | null; description: string | null; equipment_class: string; fuel_type: string; capacity_lbs: number | null; status: string; photo_path: string | null }[]; onOnline: (id: string) => void }) {
  const [eventId, setEventId] = useState("");
  const [driverId, setDriverId] = useState("");
  const { data: drivers = [], error: rosterError } = useQuery(driverRosterQuery(eventId));
  const [busy, setBusy] = useState<string | null>(null);
  const { data: events = [] } = useQuery({
    queryKey: ["forklift-events"],
    queryFn: async () => (await supabase.from("events").select("id, name, status").neq("status", "closed").order("start_date")).data ?? [],
  });
  useEffect(() => { if (!eventId && events[0]) setEventId(events[0].id); }, [events, eventId]);
  const go = async (id: string) => {
    if (!eventId || !drivers.some(d => d.id === driverId)) { toast.error("Choose your event and name first"); return; }
    setBusy(id);
    const { error } = await supabase.rpc("driver_go_online", { _event: eventId, _equipment: id, _driver: driverId });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("You're online — jobs will come to this forklift");
    onOnline(id);
  };
  return (
    <div className="grid min-w-0 gap-6 p-4 sm:p-6">
      <h1 className="text-3xl font-bold">Driver sign-in</h1>
      <label className="grid w-full min-w-0 max-w-md gap-2 text-lg">Event
        <select value={eventId} onChange={(e) => { setEventId(e.target.value); setDriverId(""); }}
          className="h-14 w-full min-w-0 rounded-lg bg-primary-foreground px-3 text-lg text-primary">
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      <label className="grid w-full min-w-0 max-w-md gap-2 text-lg">Driver
        <select aria-label="Driver" value={driverId} onChange={e => setDriverId(e.target.value)} className="h-14 w-full min-w-0 rounded-lg bg-primary-foreground px-3 text-lg text-primary">
          <option value="">Select your name</option>
          {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
      </label>
      {rosterError && <p role="alert" className="text-lg">{rosterError.message}</p>}
      {!rosterError && !!eventId && !drivers.length && <p className="text-lg">No workers registered. Contact your company admin.</p>}
      <h2 className="text-2xl font-bold">Choose your forklift</h2>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {equipment.map((e) => {
          const blocked = e.status !== "available";
          return (
            <Button key={e.id} disabled={blocked || !!busy || !driverId} onClick={() => go(e.id)} variant="outline"
              className="h-auto min-h-36 w-full min-w-0 flex-col items-start whitespace-normal rounded-lg border-2 border-primary-foreground/20 bg-primary-foreground/5 p-4 text-left text-xl font-bold text-primary-foreground disabled:opacity-40">
              <EquipmentPhoto photoPath={e.photo_path} unitNumber={e.unit_number} className="h-40 w-full rounded-md" />
              {e.unit_number}
              <div className="text-base font-normal">{e.model || e.description}</div>
              <div className="text-sm font-normal">{EQUIPMENT_CLASSES[e.equipment_class as keyof typeof EQUIPMENT_CLASSES]} · {FUEL_TYPES[e.fuel_type as keyof typeof FUEL_TYPES]}</div>
              <div className="text-base">{e.capacity_lbs?.toLocaleString() ?? "Unknown"} lb</div>
              <span className={`mt-1 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-lg font-bold uppercase tracking-wide ${
                busy === e.id ? "bg-status-completed/60 text-primary-foreground"
                  : blocked ? "bg-primary-foreground/10 text-primary-foreground/50"
                  : "bg-status-completed text-primary-foreground"
              }`}>
                {blocked ? <XCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
                {busy === e.id ? "Going online…" : e.status === "maintenance" ? "Maintenance" : e.status === "in_use" ? "In use" : "Online"}
              </span>
              {!blocked && busy !== e.id && <div className="text-base font-normal text-primary-foreground/70">Tap to take this lift online</div>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
