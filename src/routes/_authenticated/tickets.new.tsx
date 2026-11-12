import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/app/page-header";
import { ArrivalBadge } from "@/components/app/badges";
import { Field } from "@/components/app/event-form-dialog";
import { eventExhibitorsQuery, eventsQuery, freightQuery, membershipQuery, isStaff } from "@/lib/queries";
import { PRIORITY_LABEL, SERVICE_LABEL, type ServiceType, type TicketPriority } from "@/lib/labels";
import { validateTicketDraft } from "@/lib/ticket-rules";
import { fmtWeight } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tickets/new")({
  head: () => ({
    meta: [
      { title: "New ticket — DrayFlow" },
      { name: "description", content: "Create a material handling ticket and attach freight." },
      { property: "og:title", content: "New ticket — DrayFlow" },
      { property: "og:description", content: "Create a material handling ticket and attach freight." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(eventsQuery()),
      queryClient.ensureQueryData(eventExhibitorsQuery()),
      queryClient.ensureQueryData(freightQuery()),
    ]),
  component: NewTicket,
});

function NewTicket() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: booths } = useSuspenseQuery(eventExhibitorsQuery());
  const { data: freight } = useSuspenseQuery(freightQuery());

  const openEvents = events.filter((e) => e.status !== "closed");
  const lockedExhibitor = m.role === "exhibitor" ? m.exhibitorId : null;

  const [eventId, setEventId] = useState(openEvents[0]?.id ?? "");
  const [exhibitorId, setExhibitorId] = useState(lockedExhibitor ?? "");
  const [service, setService] = useState<ServiceType>("inbound_delivery");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [destination, setDestination] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const eventBooths = booths.filter((b) => b.event_id === eventId);
  const booth = eventBooths.find((b) => b.exhibitor_id === exhibitorId)?.booth_number ?? "";
  const availableFreight = useMemo(
    () => freight.filter((f) => f.event_id === eventId && f.exhibitor_id === exhibitorId),
    [freight, eventId, exhibitorId],
  );

  const create = useMutation({
    mutationFn: async () => {
      const problem = validateTicketDraft({
        eventId,
        exhibitorId,
        freightIds: selected,
        allowedFreightIds: availableFreight.map((f) => f.id),
      });
      if (problem) throw new Error(problem);
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          organization_id: events.find((e) => e.id === eventId)!.organization_id,
          event_id: eventId,
          exhibitor_id: exhibitorId,
          booth_number: booth || null,
          service_type: service,
          priority,
          destination: destination.trim() || (booth ? `Booth ${booth}` : null),
          special_instructions: instructions.trim() || null,
          ticket_number: "",
        })
        .select("id, ticket_number, organization_id")
        .single();
      if (error) throw error;
      if (selected.length) {
        const { error: e2 } = await supabase.from("ticket_freight").insert(
          selected.map((fid) => ({ ticket_id: data.id, freight_id: fid, organization_id: data.organization_id })),
        );
        if (e2) throw e2;
      }
      return data;
    },
    onSuccess: (t) => {
      toast.success(`Ticket ${t.ticket_number} created`);
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      navigate({ to: "/tickets/$ticketId", params: { ticketId: t.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="grid gap-6">
      <Link to="/tickets" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Tickets
      </Link>
      <PageHeader
        eyebrow="Ticket management"
        title="New material handling ticket"
        description="The ticket number and request time are assigned automatically when you submit."
      />

      <form
        className="grid gap-6 lg:grid-cols-[1fr_1fr]"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Panel title="Request details" bodyClassName="grid gap-4 p-4">
          <Field label="Event">
            <Select
              value={eventId}
              onValueChange={(v) => {
                setEventId(v);
                if (!lockedExhibitor) setExhibitorId("");
                setSelected([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {openEvents.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Exhibitor">
              <Select
                value={exhibitorId}
                onValueChange={(v) => {
                  setExhibitorId(v);
                  setSelected([]);
                }}
                disabled={!!lockedExhibitor || !eventId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exhibitor" />
                </SelectTrigger>
                <SelectContent>
                  {eventBooths.map((b) => (
                    <SelectItem key={b.exhibitor_id} value={b.exhibitor_id}>
                      {b.exhibitor?.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Booth">
              <Input value={booth} readOnly placeholder="—" className="bg-muted font-mono" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Requested service">
              <Select value={service} onValueChange={(v) => setService(v as ServiceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Destination" hint="Defaults to the exhibitor's booth when left blank.">
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={booth ? `Booth ${booth}` : "e.g. Dock B, Booth 1214"} />
          </Field>
          <Field label="Special instructions">
            <Textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} />
          </Field>
        </Panel>

        <div className="grid content-start gap-6">
          <Panel
            title="Attach freight"
            action={<span className="text-xs text-muted-foreground">{selected.length} selected</span>}
          >
            {!exhibitorId ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Select an exhibitor to see their freight.</p>
            ) : availableFreight.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No freight registered for this exhibitor at this event.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {availableFreight.map((f) => (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/50">
                      <Checkbox checked={selected.includes(f.id)} onCheckedChange={() => toggle(f.id)} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-medium">{f.freight_code}</span>
                          <ArrivalBadge status={f.arrival_status} />
                        </span>
                        <span className="mt-0.5 block text-sm">{f.description}</span>
                        <span className="block text-xs text-muted-foreground">
                          {f.pieces} pc · {fmtWeight(f.weight_lbs)}
                          {f.storage_location ? ` · ${f.storage_location}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline" type="button">
              <Link to="/tickets">Cancel</Link>
            </Button>
            <Button type="submit" variant="teal" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create ticket"}
            </Button>
          </div>
          {!isStaff(m) && m.role !== "exhibitor" && (
            <p className="text-right text-xs text-muted-foreground">Your role may not be permitted to create tickets.</p>
          )}
        </div>
      </form>
    </div>
  );
}
