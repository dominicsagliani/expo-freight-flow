import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Forklift, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { equipmentQuery, membershipQuery, isStaff } from "@/lib/queries";
import { EQUIPMENT_CLASSES, FUEL_TYPES } from "@/lib/fleet";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export const Route = createFileRoute("/_authenticated/equipment")({
  head: () => ({ meta: [
    { title: "Fleet inventory — ExpoHaul" },
    { name: "description", content: "Manage material handling machines, capacities and availability." },
    { property: "og:title", content: "Fleet inventory — ExpoHaul" },
    { property: "og:description", content: "Your ExpoHaul forklift and equipment inventory." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context: { queryClient } }) => Promise.all([queryClient.ensureQueryData(equipmentQuery()), queryClient.ensureQueryData(membershipQuery())]),
  component: FleetPage,
});

function FleetPage() {
  const { data: fleet } = useSuspenseQuery(equipmentQuery());
  const { data: membership } = useSuspenseQuery(membershipQuery());
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Tables<"equipment"> | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const { data: drivers = [] } = useQuery({ queryKey: ["queue-drivers"], queryFn: async () => {
    const { data, error } = await supabase.from("queue_drivers").select("equipment_id, ready, heartbeat_at, operator:operators(full_name)");
    if (error) throw new Error(error.message); return data ?? [];
  }, refetchInterval: 15_000 });
  useRealtimeRefresh(["equipment", "queue_drivers"], [["equipment"], ["queue-drivers"]]);
  const visible = fleet.filter(e => !e.retired_at);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membership.organizationId || !isStaff(membership)) return;
    const form = new FormData(event.currentTarget);
    const patch = { unit_number: String(form.get("unit_number")).trim(), model: String(form.get("model")).trim() || null,
      description: String(form.get("description")).trim() || null, equipment_class: String(form.get("equipment_class")), fuel_type: String(form.get("fuel_type")),
      capacity_lbs: form.get("capacity_lbs") ? Number(form.get("capacity_lbs")) : null,
      status: String(form.get("status")) as Tables<"equipment">["status"] };
    setSaving(true);
    const { error } = edit ? await supabase.from("equipment").update(patch).eq("id", edit.id)
      : await supabase.from("equipment").insert({ ...patch, organization_id: membership.organizationId });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Machine saved"); setEdit(undefined); qc.invalidateQueries({ queryKey: ["equipment"] });
  };
  return <div className="grid gap-6">
    <PageHeader eyebrow="Equipment" title="Fleet inventory" description={`${visible.length} machines · ${visible.filter(e => e.status === "available").length} available`}
      actions={isStaff(membership) && <Button onClick={() => setEdit(null)}><Plus />Add machine</Button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map(e => {
        const driver = drivers.find(d => d.equipment_id === e.id && new Date(d.heartbeat_at).getTime() > Date.now() - 60000);
        return <article key={e.id} className="grid gap-3 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3"><Forklift className="size-7 text-primary" /><h2 className="flex-1 font-mono text-lg font-semibold">{e.unit_number}</h2>
            {isStaff(membership) && <Button variant="ghost" size="icon" aria-label={`Edit ${e.unit_number}`} onClick={() => setEdit(e)}><Pencil /></Button>}</div>
          <div><p className="font-medium">{e.model || e.description || EQUIPMENT_CLASSES[e.equipment_class as keyof typeof EQUIPMENT_CLASSES]}</p>
            <p className="text-sm text-muted-foreground">{EQUIPMENT_CLASSES[e.equipment_class as keyof typeof EQUIPMENT_CLASSES]} · {FUEL_TYPES[e.fuel_type as keyof typeof FUEL_TYPES]}</p></div>
          <p className="text-xl font-semibold">{e.capacity_lbs?.toLocaleString() ?? "Unknown"} <span className="text-sm font-normal text-muted-foreground">lb capacity</span></p>
          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm"><span>{e.status === "maintenance" ? "Maintenance" : driver ? "Reserved" : e.status === "in_use" ? "In use" : "Available"}</span><span className="text-muted-foreground">{driver?.operator?.full_name}</span></div>
        </article>;
      })}
      {!visible.length && <p className="text-muted-foreground">No machines registered.</p>}
    </div>
    <Dialog open={edit !== undefined} onOpenChange={open => !open && setEdit(undefined)}><DialogContent><DialogHeader><DialogTitle>{edit ? "Edit machine" : "Add machine"}</DialogTitle></DialogHeader>
      <form key={edit?.id ?? "new"} onSubmit={save} className="grid gap-4">
        <label className="grid gap-1 text-sm">Unit number<Input name="unit_number" required defaultValue={edit?.unit_number} /></label>
        <label className="grid gap-1 text-sm">Model<Input name="model" defaultValue={edit?.model ?? ""} /></label>
        <label className="grid gap-1 text-sm">Description<Input name="description" defaultValue={edit?.description ?? ""} /></label>
        <div className="grid grid-cols-2 gap-3">{([['equipment_class', 'Type', EQUIPMENT_CLASSES], ['fuel_type', 'Fuel', FUEL_TYPES]] as const).map(([key, label, values]) => <label key={key} className="grid gap-1 text-sm">{label}<select name={key} defaultValue={edit?.[key]} className="h-10 rounded-md border border-input bg-background px-2">{Object.entries(values).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>)}</div>
        <label className="grid gap-1 text-sm">Capacity (lb)<Input name="capacity_lbs" type="number" min="1" step="1" defaultValue={edit?.capacity_lbs ?? ""} /></label>
        <label className="grid gap-1 text-sm">Status<select name="status" defaultValue={edit?.status ?? "available"} className="h-10 rounded-md border border-input bg-background px-2"><option value="available">Available</option><option value="in_use">In use</option><option value="maintenance">Maintenance</option></select></label>
        <div className="flex justify-between gap-3">{edit && <Button type="button" variant="outline" disabled={saving} onClick={async () => {
          if (!confirm(`Retire ${edit.unit_number}? Its history will be preserved.`)) return;
          const { error } = await supabase.from("equipment").update({ retired_at: new Date().toISOString() }).eq("id", edit.id);
          if (error) toast.error(error.message); else { setEdit(undefined); qc.invalidateQueries({ queryKey: ["equipment"] }); }
        }}>Retire machine</Button>}<Button className="ml-auto" disabled={saving}>{saving ? "Saving…" : "Save machine"}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}