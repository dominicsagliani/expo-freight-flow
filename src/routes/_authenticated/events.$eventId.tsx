import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { EventStatusBadge } from "@/components/app/badges";
import { EventFormDialog, Field } from "@/components/app/event-form-dialog";
import { eventQuery, exhibitorsQuery, freightQuery, isAdmin, isStaff, membershipQuery, ticketsQuery } from "@/lib/queries";
import { fmtDate, fmtDateRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event details — DrayFlow" },
      { name: "description", content: "Event schedule, venue, and participating exhibitors." },
      { property: "og:title", content: "Event details — DrayFlow" },
      { property: "og:description", content: "Event schedule, venue, and participating exhibitors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([
      queryClient.ensureQueryData(eventQuery(params.eventId)),
      queryClient.ensureQueryData(exhibitorsQuery()),
      queryClient.ensureQueryData(ticketsQuery()),
      queryClient.ensureQueryData(freightQuery()),
    ]),
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: event } = useSuspenseQuery(eventQuery(eventId));
  const { data: exhibitors } = useSuspenseQuery(exhibitorsQuery());
  const { data: tickets } = useSuspenseQuery(ticketsQuery());
  const { data: freight } = useSuspenseQuery(freightQuery());

  const evTickets = tickets.filter((t) => t.event_id === eventId);
  const evFreight = freight.filter((f) => f.event_id === eventId);
  const participating = new Set(event.event_exhibitors.map((e) => e.exhibitor_id));
  const available = exhibitors.filter((x) => !participating.has(x.id));

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_exhibitors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exhibitor removed from event");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["exhibitors"] });
      qc.invalidateQueries({ queryKey: ["event_exhibitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const booths = [...event.event_exhibitors].sort((a, b) =>
    a.booth_number.localeCompare(b.booth_number, undefined, { numeric: true }),
  );

  return (
    <div className="grid gap-6">
      <Link to="/events" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Events
      </Link>
      <PageHeader
        eyebrow={event.venue}
        title={event.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Show {fmtDateRange(event.start_date, event.end_date)} <EventStatusBadge status={event.status} />
          </span>
        }
        actions={
          isAdmin(m) && m.organizationId ? (
            <EventFormDialog
              organizationId={m.organizationId}
              event={event}
              trigger={
                <Button variant="outline">
                  <Pencil /> Edit event
                </Button>
              }
            />
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Location" value={[event.city, event.address].filter(Boolean).join(" · ") || "—"} />
        <Info label="Move-in" value={fmtDate(event.move_in_date)} />
        <Info label="Move-out" value={fmtDate(event.move_out_date)} />
        <Info
          label="Activity"
          value={`${evTickets.length} tickets · ${evFreight.length} freight items`}
        />
      </div>

      {event.notes && (
        <Panel title="Operational notes" bodyClassName="px-4 py-3 text-sm text-muted-foreground">
          {event.notes}
        </Panel>
      )}

      <Panel
        title={`Participating exhibitors (${booths.length})`}
        action={
          isStaff(m) ? (
            <AddExhibitorDialog eventId={eventId} organizationId={event.organization_id} options={available} />
          ) : null
        }
      >
        {booths.length === 0 ? (
          <EmptyState title="No exhibitors assigned" description="Add exhibitors and their booth numbers for this event." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-2.5 font-semibold">Booth</th>
                  <th className="px-4 py-2.5 font-semibold">Exhibitor</th>
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Freight</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tickets</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {booths.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono text-sm font-medium">{b.booth_number}</td>
                    <td className="px-4 py-3 font-medium">{b.exhibitor?.company_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{b.exhibitor?.contact_name ?? "—"}</div>
                      <div className="text-xs">{b.exhibitor?.contact_email}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {evFreight.filter((f) => f.exhibitor_id === b.exhibitor_id).length}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {evTickets.filter((t) => t.exhibitor_id === b.exhibitor_id).length}
                    </td>
                    <td className="px-2 py-3">
                      {isStaff(m) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove from event"
                          onClick={() => {
                            if (confirm(`Remove ${b.exhibitor?.company_name} from this event?`)) remove.mutate(b.id);
                          }}
                        >
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function AddExhibitorDialog({
  eventId,
  organizationId,
  options,
}: {
  eventId: string;
  organizationId: string;
  options: { id: string; company_name: string }[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [exhibitorId, setExhibitorId] = useState("");
  const [booth, setBooth] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!exhibitorId) throw new Error("Choose an exhibitor");
      if (!booth.trim()) throw new Error("Booth number is required");
      const { error } = await supabase.from("event_exhibitors").insert({
        event_id: eventId,
        exhibitor_id: exhibitorId,
        booth_number: booth.trim(),
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exhibitor added to event");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["exhibitors"] });
      qc.invalidateQueries({ queryKey: ["event_exhibitors"] });
      setOpen(false);
      setExhibitorId("");
      setBooth("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus /> Add exhibitor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add exhibitor to event</DialogTitle>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every exhibitor is already assigned. Create a new exhibitor from the{" "}
            <Link to="/exhibitors" className="font-medium text-foreground underline">
              Exhibitors
            </Link>{" "}
            page.
          </p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Field label="Exhibitor">
              <Select value={exhibitorId} onValueChange={setExhibitorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exhibitor" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Booth number">
              <Input value={booth} onChange={(e) => setBooth(e.target.value)} placeholder="e.g. 1420" />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? "Adding…" : "Add to event"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
