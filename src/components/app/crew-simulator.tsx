import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Eye, FlaskConical, Package, Play, Plus, Power, RotateCcw, Truck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { equipmentQuery, operatorsQuery, freightQuery } from "@/lib/queries";
import { dispatchSimulation, emptySimulation, moveSimulation, pairCrew, type SimState } from "@/lib/crew-simulator";
import { fmtMoney } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import forkliftPhoto from "@/assets/hero-forklift-hall.jpg";

export function CrewSimulator({ eventId, organizationId }: { eventId: string; organizationId: string }) {
  const qc = useQueryClient();
  const { data: operators } = useSuspenseQuery(operatorsQuery());
  const { data: equipment } = useSuspenseQuery(equipmentQuery());
  const { data: freight } = useSuspenseQuery(freightQuery());
  const [selected, setSelected] = useState("");
  const [crate, setCrate] = useState("sample");
  const [rate, setRate] = useState("130");
  const [auto, setAuto] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const key = ["crew-simulation", eventId];
  const { data: state, isLoading, error } = useQuery({ queryKey: key, queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Sign in to test your crew.");
    const { data, error } = await supabase.from("crew_simulations").select("state").eq("event_id", eventId).eq("owner_id", auth.user.id).maybeSingle();
    if (error) throw error;
    return data ? data.state as unknown as SimState : emptySimulation();
  } });
  const workers = operators.filter(o => o.organization_id === organizationId && !o.retired_at && !o.equipment_id);
  const lifts = equipment.filter(e => e.organization_id === organizationId);
  const crates = freight.filter(f => f.event_id === eventId);
  const persist = async (next: SimState) => {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sign in to test your crew.");
      const updated = dispatchSimulation(next, lifts);
      const { error } = await supabase.from("crew_simulations").upsert({ event_id: eventId, organization_id: organizationId, owner_id: auth.user.id, state: JSON.parse(JSON.stringify(updated)), updated_at: new Date().toISOString() }, { onConflict: "event_id,owner_id" });
      if (error) throw error;
      qc.setQueryData(key, updated);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save test crew"); }
    finally { saving.current = false; setBusy(false); }
  };
  const pair = (operatorId: string, equipmentId: string) => {
    if (!state || !workers.some(w => w.id === operatorId)) return;
    try { void persist(pairCrew(state, operatorId, equipmentId)); setSelected(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Pairing failed"); }
  };
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!auto || !state || busy) return;
    const timer = setInterval(() => {
      let next = state;
      for (const job of state.jobs) {
        if (job.status === "assigned") next = moveSimulation(next, job.id, "pickup", Date.now());
        else if (job.status === "working" && job.startedAt !== undefined && Date.now() - job.startedAt >= 30000) next = moveSimulation(next, job.id, "delivery", Date.now());
      }
      if (next !== state) void persist(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [auto, state, busy]);
  if (isLoading) return <p className="text-muted-foreground">Loading test crew…</p>;
  if (error || !state) return <p role="alert" className="text-destructive">{error?.message ?? "Test crew unavailable"}</p>;
  const addJob = () => {
    const item = crates.find(f => f.id === crate);
    if (!Number.isFinite(Number(rate)) || Number(rate) < 0) { toast.error("Enter a valid test hourly rate."); return; }
    if (item && state.jobs.some(j => j.freightId === item.id && j.status !== "done")) { toast.error("This crate already has an open test job."); return; }
    void persist({ ...state, next: state.next + 1, jobs: [...state.jobs, { id: `TEST-${state.next}`, freightId: item?.id ?? null, label: item?.freight_code ?? `Sample crate ${state.next}`, booth: item?.booth_number ?? "104", weight: item ? Number(item.weight_lbs) : 1000, equipmentClass: "forklift", status: "waiting", hourlyRate: Number(rate) }] });
  };
  const activeView = state.crews.find(c => c.equipmentId === view);
  const renderJob = (equipmentId: string) => {
    const job = state.jobs.find(j => j.equipmentId === equipmentId && ["assigned", "working"].includes(j.status));
    if (!job) return <p className="text-sm text-muted-foreground">At dock · ready for the next test job</p>;
    return <div className="grid gap-3">
      <div><p className="font-mono text-xs text-teal">{job.id}</p><p className="font-semibold">{job.label} → Booth {job.booth}</p><p className="text-xs text-muted-foreground">{job.weight.toLocaleString()} lb · {job.status === "working" ? `${Math.floor((now - (job.startedAt ?? now)) / 1000)}s elapsed` : "Assigned · timer not started"}</p></div>
      <Button variant="teal" disabled={busy} onClick={() => void persist(moveSimulation(state, job.id, job.status === "assigned" ? "pickup" : "delivery", Date.now()))}><Package />{job.status === "assigned" ? "Simulate pickup" : "Simulate delivery"}</Button>
    </div>;
  };
  return <section aria-label="Solo crew simulator" className="grid min-w-0 gap-5 border-b border-border pb-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><FlaskConical className="size-5 text-teal" />Solo crew simulator</h2><span className="rounded border border-status-requested px-2 py-1 text-xs font-semibold text-status-requested">TEST ONLY · No customer invoices</span></header>
    <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><Switch checked={auto} onCheckedChange={setAuto} aria-label="Auto-run test jobs" /><Play className="size-4" />Auto-run (30s)</label><Button variant="outline" size="sm" disabled={busy} onClick={() => { if (confirm("Clear only your simulated crew and test jobs? Real work stays unchanged.")) { setAuto(false); void persist(emptySimulation()); } }}><RotateCcw />Reset simulation</Button></div>
    <div className="flex min-w-0 flex-wrap gap-2" aria-label="Test driver roster">{workers.map(w => <Button key={w.id} variant={selected === w.id ? "teal" : "outline"} draggable={!busy} disabled={busy} onDragStart={e => e.dataTransfer.setData("text/plain", w.id)} onClick={() => setSelected(selected === w.id ? "" : w.id)} aria-pressed={selected === w.id}><UserRound />{w.full_name}</Button>)}{!workers.length && <p className="text-sm text-muted-foreground">No active workers in this company.</p>}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lifts.map(lift => {
      const crew = state.crews.find(c => c.equipmentId === lift.id);
      const worker = workers.find(w => w.id === crew?.operatorId);
      const job = state.jobs.find(j => j.equipmentId === lift.id && ["assigned", "working"].includes(j.status));
      return <article key={lift.id} aria-label={`Test lift ${lift.unit_number}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && lift.status !== "maintenance") pair(e.dataTransfer.getData("text/plain"), lift.id); }} className={`min-w-0 overflow-hidden rounded-md border bg-card ${crew ? "border-teal" : "border-border"}`}>
        <img src={forkliftPhoto} alt="Forklift inside an exhibition hall" className="h-28 w-full object-cover" />
        <div className="grid gap-3 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-mono font-bold">{lift.unit_number}</h3><span className={`text-xs font-semibold ${crew ? "text-teal" : "text-destructive"}`}>{crew ? job?.status === "working" ? "WORKING" : job ? "ASSIGNED" : "ONLINE" : "OFFLINE"}</span></div><p className="text-xs text-muted-foreground">{lift.capacity_lbs?.toLocaleString() ?? "Unknown"} lb capacity · {lift.equipment_class}</p>
        {crew ? <><p className="break-words font-semibold">{worker?.full_name ?? "Driver"}</p>{renderJob(lift.id)}<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setView(lift.id)}><Eye />View as driver</Button><Button variant="ghost" size="sm" disabled={busy || !!job} onClick={() => void persist({ ...state, crews: state.crews.filter(c => c.equipmentId !== lift.id) })}><Power />Offline</Button></div></> : <Button variant="outline" disabled={!selected || busy || lift.status === "maintenance"} onClick={() => pair(selected, lift.id)}><Truck />{lift.status === "maintenance" ? "Maintenance" : selected ? "Pair selected driver" : "Choose a driver"}</Button>}
        </div></article>;
    })}</div>
    <div className="flex flex-wrap items-end gap-3"><div className="grid min-w-0 gap-1"><label className="text-xs font-medium">Test crate</label><Select value={crate} onValueChange={setCrate}><SelectTrigger aria-label="Test crate" className="w-64 max-w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sample">Sample crate · 1,000 lb</SelectItem>{crates.map(f => <SelectItem key={f.id} value={f.id}>{f.freight_code} · {f.weight_lbs} lb</SelectItem>)}</SelectContent></Select></div><label className="grid gap-1 text-xs font-medium">Test hourly rate ($)<Input aria-label="Test hourly rate" className="w-28" type="number" min="0" value={rate} onChange={e => setRate(e.target.value)} /></label><Button disabled={busy} variant="teal" onClick={addJob}><Plus />Add test job</Button></div>
    <div className="flex flex-wrap gap-4 text-sm"><span>{state.crews.length} online</span><span>{state.jobs.filter(j => j.status === "waiting").length} waiting</span><span>{state.jobs.filter(j => j.status === "done").length} delivered</span><span className="font-semibold">Test charges: {fmtMoney(state.jobs.reduce((sum, j) => sum + (j.charge ?? 0), 0))}</span></div>
    {state.jobs.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="py-2">Test job</th><th>Driver</th><th>Status</th><th className="text-right">Test charge</th></tr></thead><tbody>{state.jobs.map(j => <tr key={j.id} className="border-t border-border"><td className="py-2 pr-3">{j.id} · {j.label}</td><td className="pr-3">{workers.find(w => w.id === j.operatorId)?.full_name ?? "Waiting"}</td><td className="pr-3">{j.status}</td><td className="text-right">{j.charge === undefined ? "—" : fmtMoney(j.charge)}</td></tr>)}</tbody></table></div>}
    <Dialog open={!!view} onOpenChange={open => { if (!open) setView(null); }}><DialogContent><DialogHeader><DialogTitle>{workers.find(w => w.id === activeView?.operatorId)?.full_name} · {lifts.find(l => l.id === view)?.unit_number}</DialogTitle><DialogDescription>Simulated driver view · test work only</DialogDescription></DialogHeader>{view && renderJob(view)}<h3 className="text-sm font-semibold">Done today</h3>{state.jobs.filter(j => j.equipmentId === view && j.status === "done").map(j => <p key={j.id} className="text-sm">{j.label} · Booth {j.booth} · {fmtMoney(j.charge ?? 0)}</p>)}</DialogContent></Dialog>
  </section>;
}