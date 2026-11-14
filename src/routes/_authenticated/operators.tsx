import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel } from "@/components/app/page-header";
import { workersQuery, membershipQuery, isAdmin } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/operators")({
  head: () => ({ meta: [
    { title: "Worker list — ExpoHaul" },
    { name: "description", content: "Manage your company's forklift workers and driver availability." },
    { property: "og:title", content: "Worker list — ExpoHaul" },
    { property: "og:description", content: "Company worker roster and forklift driver availability." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context: { queryClient } }) => Promise.all([
    queryClient.ensureQueryData(workersQuery()), queryClient.ensureQueryData(membershipQuery()),
  ]),
  component: WorkersPage,
});

function WorkersPage() {
  const { data: workers } = useSuspenseQuery(workersQuery());
  const { data: membership } = useSuspenseQuery(membershipQuery());
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tables<"operators"> | "new" | null>(null);
  const [removing, setRemoving] = useState<Tables<"operators"> | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = isAdmin(membership);
  const remove = async () => {
    if (!removing || !membership.organizationId) return;
    setBusy(true);
    const { error } = await supabase.rpc("manage_worker", { _org: membership.organizationId, _worker: removing.id, _remove: true });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Worker removed"); setRemoving(null);
    await qc.invalidateQueries({ queryKey: ["workers"] });
    await qc.invalidateQueries({ queryKey: ["driver-roster"] });
  };
  return <div className="grid gap-6">
    <PageHeader eyebrow="Workforce" title="Worker list" actions={canEdit ? <Button onClick={() => setEditing("new")}><Plus className="size-4" />Add worker</Button> : undefined} />
    <Panel title={`Workers (${workers.length})`}>
      <ul className="divide-y divide-border">
        {workers.map(w => <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
          <Users className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 break-words text-sm font-medium">{w.full_name}</div>
          <span className="text-xs text-muted-foreground">{w.status === "on_job" ? "On job" : w.status === "off_shift" ? "Off shift" : "Available"}</span>
          {canEdit && <div className="flex gap-1">
            <Button variant="ghost" size="icon" title={`Edit ${w.full_name}`} aria-label={`Edit ${w.full_name}`} onClick={() => setEditing(w)}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" title={`Delete ${w.full_name}`} aria-label={`Delete ${w.full_name}`} onClick={() => setRemoving(w)}><Trash2 className="size-4 text-destructive" /></Button>
          </div>}
        </li>)}
        {!workers.length && <li className="px-4 py-8 text-sm text-muted-foreground">No workers yet.</li>}
      </ul>
    </Panel>
    {editing && membership.organizationId && <WorkerDialog worker={editing === "new" ? null : editing} orgId={membership.organizationId} onClose={() => setEditing(null)} />}
    <Dialog open={!!removing} onOpenChange={o => !o && setRemoving(null)}><DialogContent><DialogHeader><DialogTitle>Delete {removing?.full_name}?</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Past jobs and billing records will be kept. Online workers must finish their jobs and go offline first.</p>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={remove}>Delete worker</Button></div>
    </DialogContent></Dialog>
  </div>;
}

function WorkerDialog({ worker, orgId, onClose }: { worker: Tables<"operators"> | null; orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [first, setFirst] = useState(worker?.first_name ?? "");
  const [last, setLast] = useState(worker?.last_name ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    const { error } = await supabase.rpc("manage_worker", { _org: orgId, _first: first, _last: last, ...(worker ? { _worker: worker.id } : {}) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(worker ? "Worker updated" : "Worker added");
    await Promise.all([qc.invalidateQueries({ queryKey: ["workers"] }), qc.invalidateQueries({ queryKey: ["operators"] }), qc.invalidateQueries({ queryKey: ["driver-roster"] })]);
    onClose();
  };
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{worker ? "Edit worker" : "Add worker"}</DialogTitle></DialogHeader>
    <form onSubmit={save} className="grid gap-4">
      <label className="grid gap-1 text-sm">First name<Input value={first} onChange={e => setFirst(e.target.value)} required maxLength={100} /></label>
      <label className="grid gap-1 text-sm">Last name<Input value={last} onChange={e => setLast(e.target.value)} required maxLength={100} /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{worker ? "Save worker" : "Add worker"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
