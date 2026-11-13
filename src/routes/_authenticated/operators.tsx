import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Forklift, Smartphone } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/app/page-header";
import { ResetDriversButton } from "@/components/app/admin-reset-actions";
import { equipmentQuery, operatorsQuery, membershipQuery, isStaff, isAdmin } from "@/lib/queries";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/operators")({
  head: () => ({
    meta: [
      { title: "Operators — ExpoHaul" },
      { name: "description", content: "Forklift operators, certifications, and equipment fleet." },
      { property: "og:title", content: "Operators — ExpoHaul" },
      { property: "og:description", content: "Forklift operators, certifications, and equipment fleet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(operatorsQuery()), queryClient.ensureQueryData(equipmentQuery()), queryClient.ensureQueryData(membershipQuery())]),
  component: OperatorsPage,
});

const OP_STATUS = { available: "Available", on_job: "On job", off_shift: "Off shift" } as const;
const EQ_STATUS = { available: "Available", in_use: "In use", maintenance: "Maintenance" } as const;

function OperatorsPage() {
  const { data: operators } = useSuspenseQuery(operatorsQuery());
  const { data: equipment } = useSuspenseQuery(equipmentQuery());
  const { data: membership } = useSuspenseQuery(membershipQuery());
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tables<"operators"> | "new" | null>(null);
  const canEdit = isStaff(membership);
  const canDelete = isAdmin(membership);
  const remove = async (o: Tables<"operators">) => {
    if (!confirm(`Delete ${o.full_name}? This cannot be undone.`)) return;
    await supabase.from("event_operators").delete().eq("operator_id", o.id);
    const { error, count } = await supabase.from("operators").delete({ count: "exact" }).eq("id", o.id);
    if (error) {
      toast.error(error.code === "23503"
        ? `${o.full_name} has job history, so they can't be deleted. Set them to "Off shift" instead.`
        : error.message);
    } else if (!count) toast.error("Only company admins can delete operators.");
    else toast.success(`${o.full_name} deleted`);
    qc.invalidateQueries({ queryKey: ["operators"] });
    qc.invalidateQueries({ queryKey: ["event-operators"] });
  };
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Workforce" title="Operators" description="Certified forklift operators and the equipment fleet."
        actions={canDelete && membership.organizationId ? <ResetDriversButton organizationId={membership.organizationId} /> : undefined} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Operators (${operators.length})`} action={canEdit ? <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> Add operator</Button> : undefined}>
          <ul className="divide-y divide-border">
            {operators.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`size-2 rounded-full ${o.status === "available" ? "bg-status-completed" : o.status === "on_job" ? "bg-status-progress" : "bg-status-cancelled"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{o.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.certification_number} · cert. expires {fmtDate(o.certification_expires)}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{OP_STATUS[o.status]}</span>
                {canEdit && <button aria-label={`Edit ${o.full_name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(o)}><Pencil className="size-4" /></button>}
                {canDelete && <button aria-label={`Delete ${o.full_name}`} className="text-muted-foreground hover:text-destructive" onClick={() => remove(o)}><Trash2 className="size-4" /></button>}
              </li>
            ))}
            {operators.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No operators yet.</li>}
          </ul>
        </Panel>
        <ForkliftAccess operators={operators} />
        <Panel title={`Equipment (${equipment.length})`}>
          <ul className="divide-y divide-border">
            {equipment.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-12 font-mono text-sm font-medium">{e.unit_number}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{e.description}</div>
                  <div className="text-xs text-muted-foreground">{e.capacity_lbs?.toLocaleString()} lb capacity</div>
                </div>
                <span className="text-xs text-muted-foreground">{EQ_STATUS[e.status]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Operator portal">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Link to="/forklift" className="flex gap-3 rounded-lg border border-border p-4 hover:border-primary">
            <Forklift className="size-6 shrink-0 text-teal" />
            <div>
              <div className="font-medium">Forklift Mode (shared tablet)</div>
              <p className="text-sm text-muted-foreground">Drivers pick their name, enter their 6-digit PIN, choose a machine and receive live queue jobs, scan freight, pause and complete.</p>
            </div>
          </Link>
          <Link to="/operator" className="flex gap-3 rounded-lg border border-border p-4 hover:border-primary">
            <Smartphone className="size-6 shrink-0 text-teal" />
            <div>
              <div className="font-medium">My jobs (personal phone)</div>
              <p className="text-sm text-muted-foreground">Job list for operators with their own login: scan freight QR codes, start and complete jobs with notes, upload completion photos.</p>
            </div>
          </Link>
        </div>
      </Panel>
      {editing && membership.organizationId && (
        <OperatorDialog op={editing === "new" ? null : editing} orgId={membership.organizationId} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ForkliftAccess({ operators }: { operators: { id: string; full_name: string }[] }) {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const { data: events = [] } = useQuery({
    queryKey: ["op-events"],
    queryFn: async () => (await supabase.from("events").select("id, name").neq("status", "closed").order("start_date")).data ?? [],
  });
  const ev = eventId || events[0]?.id || "";
  const { data: registered = [] } = useQuery({
    queryKey: ["event-operators", ev],
    enabled: !!ev,
    queryFn: async () => ((await supabase.from("event_operators").select("operator_id").eq("event_id", ev)).data ?? []).map((r) => r.operator_id),
  });
  const { data: pins = [] } = useQuery({
    queryKey: ["operator-pins"],
    queryFn: async () => ((await supabase.rpc("operator_pin_status")).data ?? []).filter((r) => r.has_pin).map((r) => r.operator_id),
  });
  const toggle = async (id: string, on: boolean) => {
    const { error } = on
      ? await supabase.from("event_operators").insert({ event_id: ev, operator_id: id, organization_id: "00000000-0000-0000-0000-000000000000" })
      : await supabase.from("event_operators").delete().eq("event_id", ev).eq("operator_id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["event-operators", ev] });
  };
  const reset = async (id: string, name: string) => {
    if (!confirm(`Reset ${name}'s PIN? They will create a new one next time they sign in to Forklift Mode.`)) return;
    const { error } = await supabase.rpc("reset_operator_pin", { _operator: id });
    if (error) toast.error(error.message); else toast.success("PIN reset");
    qc.invalidateQueries({ queryKey: ["operator-pins"] });
  };
  return (
    <Panel title="Forklift Mode access">
      <div className="grid gap-3 p-4">
        <label className="grid gap-1 text-sm">Event
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={ev} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">Checked operators appear in the Forklift Mode sign-in list for this event.</p>
        <ul className="divide-y divide-border">
          {operators.map((o) => {
            const on = registered.includes(o.id);
            const hasPin = pins.includes(o.id);
            return (
              <li key={o.id} className="flex items-center gap-3 py-2">
                <input type="checkbox" aria-label={`Register ${o.full_name} for this event`} checked={on} disabled={!ev}
                  onChange={(e) => toggle(o.id, e.target.checked)} className="size-4 accent-primary" />
                <span className="flex-1 text-sm">{o.full_name}</span>
                <span className="text-xs text-muted-foreground">{hasPin ? "PIN set" : "No PIN yet"}</span>
                {hasPin && <button className="text-xs text-primary underline" onClick={() => reset(o.id, o.full_name)}>Reset PIN</button>}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

function OperatorDialog({ op, orgId, onClose }: { op: Tables<"operators"> | null; orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    full_name: op?.full_name ?? "", phone: op?.phone ?? "",
    certification_number: op?.certification_number ?? "", certification_expires: op?.certification_expires ?? "",
    status: op?.status ?? ("available" as Tables<"operators">["status"]),
  });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.full_name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    const patch = { ...f, full_name: f.full_name.trim(), phone: f.phone || null, certification_number: f.certification_number || null, certification_expires: f.certification_expires || null };
    const { error } = op
      ? await supabase.from("operators").update(patch).eq("id", op.id)
      : await supabase.from("operators").insert({ ...patch, organization_id: orgId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(op ? "Operator updated" : "Operator added");
    qc.invalidateQueries({ queryKey: ["operators"] });
    onClose();
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{op ? "Edit operator" : "Add operator"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <label className="grid gap-1 text-sm">Full name<Input value={f.full_name} onChange={set("full_name")} required /></label>
          <label className="grid gap-1 text-sm">Phone<Input value={f.phone} onChange={set("phone")} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Certification #<Input value={f.certification_number} onChange={set("certification_number")} /></label>
            <label className="grid gap-1 text-sm">Cert. expires<Input type="date" value={f.certification_expires} onChange={set("certification_expires")} /></label>
          </div>
          <label className="grid gap-1 text-sm">Status
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={f.status} onChange={set("status")}>
              {Object.entries(OP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">New operators create their own 6-digit PIN the first time they sign in to Forklift Mode. Register them for an event below.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{op ? "Save" : "Add operator"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
