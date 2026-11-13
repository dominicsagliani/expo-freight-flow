import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Trash2, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { TicketStatusBadge } from "@/components/app/badges";
import { FloorPlanViewer, type ViewerMarker } from "@/components/app/floor-plan-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  eventExhibitorsQuery,
  eventsQuery,
  freightQuery,
  isAdmin,
  membershipQuery,
  operatorsQuery,
  ticketsQuery,
} from "@/lib/queries";
import {
  BOOTH_STATUS_META,
  FLOOR_PLAN_ACCEPT,
  boothMarkersQuery,
  boothStatus,
  floorPlanFileQuery,
  floorPlansQuery,
  openIssuesQuery,
  type BoothMarker,
  type BoothStatus,
} from "@/lib/floor-plan";
import { DELIVERY_UPDATE_LABEL, OPEN_STATUSES } from "@/lib/labels";
import type { TicketStatus } from "@/lib/labels";
import { fmtAgo } from "@/lib/format";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export const Route = createFileRoute("/_authenticated/floor-plan")({
  head: () => ({
    meta: [
      { title: "Interactive floor plan — ExpoHaul" },
      { name: "description", content: "Live booth map of the show floor with job statuses, freight, and delivery history per booth." },
      { property: "og:title", content: "Interactive floor plan — ExpoHaul" },
      { property: "og:description", content: "Live booth map of the show floor with job statuses and delivery history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(eventsQuery()),
      queryClient.ensureQueryData(eventExhibitorsQuery()),
      queryClient.ensureQueryData(ticketsQuery()),
      queryClient.ensureQueryData(freightQuery()),
      queryClient.ensureQueryData(operatorsQuery()),
      queryClient.ensureQueryData(membershipQuery()),
    ]),
  component: FloorPlanPage,
});

const ALL = "__all";

function FloorPlanPage() {
  const qc = useQueryClient();
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: membership } = useSuspenseQuery(membershipQuery());
  const { data: tickets } = useSuspenseQuery({ ...ticketsQuery(), refetchInterval: 20_000 });
  const { data: freight } = useSuspenseQuery(freightQuery());
  const { data: eventExhibitors } = useSuspenseQuery(eventExhibitorsQuery());
  const { data: operators } = useSuspenseQuery(operatorsQuery());
  const admin = isAdmin(membership);

  const [eventId, setEventId] = useState(events.find((e) => e.status !== "closed")?.id ?? events[0]?.id ?? "");
  const [planId, setPlanId] = useState<string>("");
  const [manageMode, setManageMode] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [placement, setPlacement] = useState<{ x: number; y: number } | null>(null);
  const [editingMarker, setEditingMarker] = useState<BoothMarker | null>(null);
  const [fStatus, setFStatus] = useState(ALL);
  const [fHall, setFHall] = useState(ALL);
  const [fExhibitor, setFExhibitor] = useState(ALL);
  const [fOperator, setFOperator] = useState(ALL);

  const { data: plans = [] } = useSuspenseQuery(floorPlansQuery(eventId));
  const plan = plans.find((p) => p.id === planId) ?? plans[0] ?? null;
  const { data: markers = [] } = useSuspenseQuery(boothMarkersQuery(plan?.id ?? ""));
  const { data: fileUrl } = useQuery(floorPlanFileQuery(plan?.storage_path ?? ""));
  const { data: openIssues = [] } = useSuspenseQuery(openIssuesQuery(eventId));

  useRealtimeRefresh(
    ["tickets", "booth_markers", "delivery_updates", "floor_plans"],
    [["tickets"], ["booth_markers"], ["delivery_updates"], ["floor_plans"], ["open_issues"]],
  );

  const eventTickets = useMemo(() => tickets.filter((t) => t.event_id === eventId), [tickets, eventId]);
  const issueExhibitors = useMemo(
    () => new Set(openIssues.map((i) => i.ticket?.exhibitor_id).filter(Boolean) as string[]),
    [openIssues],
  );
  const roster = useMemo(() => eventExhibitors.filter((ee) => ee.event_id === eventId), [eventExhibitors, eventId]);
  const halls = useMemo(
    () => [...new Set(markers.map((m) => m.hall).filter((h): h is string => !!h))].sort(),
    [markers],
  );

  const ticketsFor = (exhibitorId: string | null) =>
    exhibitorId ? eventTickets.filter((t) => t.exhibitor_id === exhibitorId) : [];

  const statusOf = (m: BoothMarker): BoothStatus =>
    boothStatus(ticketsFor(m.exhibitor_id), !!m.exhibitor_id && issueExhibitors.has(m.exhibitor_id));

  const matches = (m: BoothMarker) => {
    if (fStatus !== ALL && statusOf(m) !== fStatus) return false;
    if (fHall !== ALL && m.hall !== fHall) return false;
    if (fExhibitor !== ALL && m.exhibitor_id !== fExhibitor) return false;
    if (fOperator !== ALL && !ticketsFor(m.exhibitor_id).some((t) => t.assigned_operator_id === fOperator)) return false;
    return true;
  };

  const viewerMarkers: ViewerMarker[] = markers.map((m) => ({
    id: m.id,
    x: Number(m.x_pct),
    y: Number(m.y_pct),
    label: m.booth_number,
    colorClass: BOOTH_STATUS_META[statusOf(m)].dot,
    dimmed: !matches(m),
  }));

  const selected = markers.find((m) => m.id === selectedMarkerId) ?? null;
  const selectedTickets = selected ? ticketsFor(selected.exhibitor_id) : [];
  const selectedFreight = selected?.exhibitor_id
    ? freight.filter((f) => f.event_id === eventId && f.exhibitor_id === selected.exhibitor_id)
    : [];

  const { data: history = [] } = useQuery({
    queryKey: ["delivery_updates", "booth", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const ids = selectedTickets.map((t) => t.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("delivery_updates")
        .select("id, kind, note, location, created_at, ticket_id")
        .in("ticket_id", ids)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const invalidatePlan = () => {
    void qc.invalidateQueries({ queryKey: ["floor_plans"] });
    void qc.invalidateQueries({ queryKey: ["booth_markers"] });
  };

  const onMarkerClick = (id: string) => {
    const marker = markers.find((m) => m.id === id);
    if (!marker) return;
    if (manageMode) setEditingMarker(marker);
    else setSelectedMarkerId(id === selectedMarkerId ? null : id);
  };

  const deletePlan = async () => {
    if (!plan) return;
    if (!window.confirm(`Delete floor plan "${plan.name}" and all its booth markers?`)) return;
    const { error } = await supabase.from("floor_plans").delete().eq("id", plan.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from("floor-plans").remove([plan.storage_path]);
    setPlanId("");
    setSelectedMarkerId(null);
    invalidatePlan();
    toast.success("Floor plan deleted");
  };

  const event = events.find((e) => e.id === eventId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Interactive floor plan"
        description="Live booth map of the show floor. Click a booth for its jobs, freight, and delivery history."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={eventId} onValueChange={(v) => { setEventId(v); setPlanId(""); setSelectedMarkerId(null); }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select event" /></SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {admin && plan && (
              <Button variant={manageMode ? "default" : "outline"} onClick={() => setManageMode(!manageMode)}>
                <Pencil className="size-4" /> {manageMode ? "Done editing" : "Manage booths"}
              </Button>
            )}
            {admin && (
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" /> Upload plan
              </Button>
            )}
          </div>
        }
      />

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {plans.length > 1 && (
          <Select value={plan?.id ?? ""} onValueChange={setPlanId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Floor plan" /></SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Job status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {Object.entries(BOOTH_STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fHall} onValueChange={setFHall}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Hall" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All halls</SelectItem>
            {halls.map((h) => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fExhibitor} onValueChange={setFExhibitor}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Exhibitor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All exhibitors</SelectItem>
            {roster.map((r) => (
              <SelectItem key={r.exhibitor_id} value={r.exhibitor_id}>{r.exhibitor?.company_name ?? "Unknown"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fOperator} onValueChange={setFOperator}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Forklift" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All forklifts</SelectItem>
            {operators.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(BOOTH_STATUS_META).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`inline-block size-2.5 rounded-full ${v.dot}`} /> {v.label}
            </span>
          ))}
        </div>
      </div>

      {/* Map + detail panel */}
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-w-0 flex-1" style={{ height: "calc(100vh - 220px)" }}>
          {!plan ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
              <MapPin className="size-10 text-muted-foreground/40" />
              <p className="max-w-sm text-sm text-muted-foreground">
                No floor plan uploaded for {event?.name ?? "this event"} yet.
                {admin ? " Upload a PDF, PNG, or JPG of the show floor to start mapping booths." : " Ask an admin to upload the show floor plan."}
              </p>
              {admin && (
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload className="size-4" /> Upload floor plan
                </Button>
              )}
            </div>
          ) : !fileUrl ? (
            <div className="flex h-full items-center justify-center rounded-lg border text-sm text-muted-foreground">
              Loading floor plan…
            </div>
          ) : (
            <FloorPlanViewer
              fileUrl={fileUrl}
              mimeType={plan.mime_type}
              markers={viewerMarkers}
              selectedId={selectedMarkerId}
              editMode={manageMode}
              onMarkerClick={onMarkerClick}
              onMapClick={(x, y) => setPlacement({ x, y })}
            />
          )}
          {plan && admin && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {manageMode
                  ? "Manage mode: click anywhere on the plan to place a booth marker, or click a marker to edit it."
                  : `${markers.length} booth${markers.length === 1 ? "" : "s"} mapped · scroll to zoom, drag to pan`}
              </span>
              <button type="button" onClick={deletePlan} className="flex items-center gap-1 text-destructive hover:underline">
                <Trash2 className="size-3" /> Delete plan
              </button>
            </div>
          )}
        </div>

        {selected && !manageMode && (
          <aside className="w-80 shrink-0 overflow-y-auto rounded-lg border bg-card p-4" style={{ height: "calc(100vh - 220px)" }}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="font-display text-lg font-bold">Booth {selected.booth_number}</div>
                <div className="text-sm text-muted-foreground">
                  {selected.exhibitor?.company_name ?? "No exhibitor assigned"}
                  {selected.hall ? ` · ${selected.hall}` : ""}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setSelectedMarkerId(null)} aria-label="Close panel">
                <X className="size-4" />
              </Button>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white ${BOOTH_STATUS_META[statusOf(selected)].dot}`}>
              {BOOTH_STATUS_META[statusOf(selected)].label}
            </span>
            {selected.exhibitor?.contact_name && (
              <p className="mt-3 text-xs text-muted-foreground">
                Contact: {selected.exhibitor.contact_name}
                {selected.exhibitor.contact_phone ? ` · ${selected.exhibitor.contact_phone}` : ""}
              </p>
            )}

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding jobs</h3>
            <JobList tickets={selectedTickets.filter((t) => OPEN_STATUSES.includes(t.status))} empty="No outstanding jobs" />

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed jobs</h3>
            <JobList tickets={selectedTickets.filter((t) => t.status === "completed")} empty="Nothing completed yet" />

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Freight ({selectedFreight.length})
            </h3>
            <ul className="mt-1 space-y-1 text-sm">
              {selectedFreight.slice(0, 8).map((f) => (
                <li key={f.id} className="flex justify-between gap-2">
                  <span className="truncate">{f.freight_code} — {f.description}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{f.pieces} pc</span>
                </li>
              ))}
              {selectedFreight.length === 0 && <li className="text-xs text-muted-foreground">No freight registered</li>}
            </ul>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery history</h3>
            <ul className="mt-1 space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="border-l-2 border-border pl-2">
                  <div className="text-xs font-medium">{DELIVERY_UPDATE_LABEL[h.kind] ?? h.kind}</div>
                  {h.note && <div className="text-xs text-muted-foreground">{h.note}</div>}
                  <div className="text-[11px] text-muted-foreground/70">{fmtAgo(h.created_at)}</div>
                </li>
              ))}
              {history.length === 0 && <li className="text-xs text-muted-foreground">No delivery updates yet</li>}
            </ul>
          </aside>
        )}
      </div>

      <UploadPlanDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        eventId={eventId}
        orgId={membership.organizationId ?? ""}
        onDone={(id) => { invalidatePlan(); setPlanId(id); }}
      />
      {placement && plan && (
        <MarkerFormDialog
          planId={plan.id}
          orgId={membership.organizationId ?? ""}
          roster={roster}
          initial={{ x: placement.x, y: placement.y }}
          onClose={() => setPlacement(null)}
          onDone={() => { setPlacement(null); invalidatePlan(); }}
        />
      )}
      {editingMarker && (
        <MarkerFormDialog
          planId={editingMarker.floor_plan_id}
          orgId={membership.organizationId ?? ""}
          roster={roster}
          marker={editingMarker}
          onClose={() => setEditingMarker(null)}
          onDone={() => { setEditingMarker(null); invalidatePlan(); }}
        />
      )}
    </div>
  );
}

function JobList({ tickets, empty }: { tickets: { id: string; ticket_number: string; status: TicketStatus }[]; empty: string }) {
  if (tickets.length === 0) return <p className="mt-1 text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-1 space-y-1">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
            <span className="font-medium">{t.ticket_number}</span>
            <TicketStatusBadge status={t.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function UploadPlanDialog({
  open,
  onOpenChange,
  eventId,
  orgId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  orgId: string;
  onDone: (planId: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a PDF, PNG, or JPG file first");
      return;
    }
    if (!name.trim()) {
      toast.error("Give the floor plan a name");
      return;
    }
    setBusy(true);
    try {
      const path = `${orgId}/${eventId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("floor-plans").upload(path, file);
      if (upErr) throw new Error(upErr.message);
      const { data, error } = await supabase
        .from("floor_plans")
        .insert({ event_id: eventId, name: name.trim(), storage_path: path, mime_type: file.type || "application/pdf", organization_id: orgId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      toast.success("Floor plan uploaded");
      setName("");
      onOpenChange(false);
      onDone(data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload floor plan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="plan-name">Plan name</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hall A — main floor" />
          </div>
          <div>
            <Label htmlFor="plan-file">Floor plan file (PDF, PNG, or JPG)</Label>
            <Input id="plan-file" ref={fileRef} type="file" accept={FLOOR_PLAN_ACCEPT} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MarkerFormDialog({
  planId,
  orgId,
  roster,
  initial,
  marker,
  onClose,
  onDone,
}: {
  planId: string;
  orgId: string;
  roster: { exhibitor_id: string; booth_number: string; exhibitor: { company_name: string } | null }[];
  initial?: { x: number; y: number };
  marker?: BoothMarker;
  onClose: () => void;
  onDone: () => void;
}) {
  const [exhibitorId, setExhibitorId] = useState(marker?.exhibitor_id ?? "");
  const [booth, setBooth] = useState(marker?.booth_number ?? "");
  const [hall, setHall] = useState(marker?.hall ?? "");
  const [busy, setBusy] = useState(false);

  const pickExhibitor = (id: string) => {
    setExhibitorId(id);
    const r = roster.find((x) => x.exhibitor_id === id);
    if (r && !marker) setBooth(r.booth_number);
  };

  const save = async () => {
    if (!booth.trim()) {
      toast.error("Booth number is required");
      return;
    }
    setBusy(true);
    try {
      if (marker) {
        const { error } = await supabase
          .from("booth_markers")
          .update({ booth_number: booth.trim(), hall: hall.trim() || null, exhibitor_id: exhibitorId || null })
          .eq("id", marker.id);
        if (error) throw new Error(error.message);
        toast.success("Booth marker updated");
      } else {
        const { error } = await supabase.from("booth_markers").insert({
          floor_plan_id: planId,
          organization_id: orgId,
          exhibitor_id: exhibitorId || null,
          booth_number: booth.trim(),
          hall: hall.trim() || null,
          x_pct: initial!.x,
          y_pct: initial!.y,
        });
        if (error) throw new Error(error.message);
        toast.success(`Booth ${booth.trim()} placed on the map`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!marker) return;
    setBusy(true);
    const { error } = await supabase.from("booth_markers").delete().eq("id", marker.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Booth marker removed");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{marker ? `Edit booth ${marker.booth_number}` : "Place booth marker"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Exhibitor</Label>
            <Select value={exhibitorId || ALL} onValueChange={(v) => pickExhibitor(v === ALL ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No exhibitor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>No exhibitor (empty booth)</SelectItem>
                {roster.map((r) => (
                  <SelectItem key={r.exhibitor_id} value={r.exhibitor_id}>
                    {r.exhibitor?.company_name ?? "Unknown"} — booth {r.booth_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mk-booth">Booth number</Label>
              <Input id="mk-booth" value={booth} onChange={(e) => setBooth(e.target.value)} placeholder="1202" />
            </div>
            <div>
              <Label htmlFor="mk-hall">Hall / section</Label>
              <Input id="mk-hall" value={hall} onChange={(e) => setHall(e.target.value)} placeholder="Hall A" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy} className="flex-1">{busy ? "Saving…" : marker ? "Save changes" : "Place marker"}</Button>
            {marker && (
              <Button variant="destructive" onClick={remove} disabled={busy}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
