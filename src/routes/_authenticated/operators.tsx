import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, ComingNext } from "@/components/app/page-header";
import { equipmentQuery, operatorsQuery } from "@/lib/queries";
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
    Promise.all([queryClient.ensureQueryData(operatorsQuery()), queryClient.ensureQueryData(equipmentQuery())]),
  component: OperatorsPage,
});

const OP_STATUS = { available: "Available", on_job: "On job", off_shift: "Off shift" } as const;
const EQ_STATUS = { available: "Available", in_use: "In use", maintenance: "Maintenance" } as const;

function OperatorsPage() {
  const { data: operators } = useSuspenseQuery(operatorsQuery());
  const { data: equipment } = useSuspenseQuery(equipmentQuery());
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Workforce" title="Operators" description="Certified forklift operators and the equipment fleet." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Operators (${operators.length})`}>
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
              </li>
            ))}
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
      <ComingNext
        phase="Phase 3"
        title="Operator portal"
        items={["Mobile job list for each operator", "Scan freight QR codes to confirm identity", "Start and complete jobs with notes", "Upload completion photos"]}
      />
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
