import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { exhibitorsQuery, eventsQuery, isAdmin, isStaff, membershipQuery, rateCardsQuery, ticketsQuery } from "@/lib/queries";
import { SERVICE_LABEL } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { RATE_UNIT_LABEL, fmtMoney, toCsv, type RateUnit } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Reports — ExpoHaul" },
      { name: "description", content: "Rate cards, calculated service charges, event revenue, and billing exports." },
      { property: "og:title", content: "Billing & Reports — ExpoHaul" },
      { property: "og:description", content: "Rate cards, service charges, and billing exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(ticketsQuery()),
      queryClient.ensureQueryData(eventsQuery()),
      queryClient.ensureQueryData(rateCardsQuery()),
      queryClient.ensureQueryData(exhibitorsQuery()),
    ]),
  component: Billing,
});

const ALL = "__all";

function Billing() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: tickets } = useSuspenseQuery(ticketsQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: cards } = useSuspenseQuery(rateCardsQuery());
  const { data: exhibitors } = useSuspenseQuery(exhibitorsQuery());
  const [eventId, setEventId] = useState(ALL);
  const [exhibitorId, setExhibitorId] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(
    () =>
      tickets
        .filter((t) => t.status === "completed" && t.completed_at)
        .filter((t) => eventId === ALL || t.event_id === eventId)
        .filter((t) => exhibitorId === ALL || t.exhibitor_id === exhibitorId)
        .filter((t) => !from || t.completed_at!.slice(0, 10) >= from)
        .filter((t) => !to || t.completed_at!.slice(0, 10) <= to)
        .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!)),
    [tickets, eventId, exhibitorId, from, to],
  );
  const total = rows.reduce((s, t) => s + Number(t.charge_amount ?? 0), 0);
  const group = (key: (t: (typeof rows)[number]) => string) => {
    const map = new Map<string, { count: number; sum: number }>();
    for (const t of rows) {
      const k = key(t);
      const g = map.get(k) ?? { count: 0, sum: 0 };
      g.count++; g.sum += Number(t.charge_amount ?? 0);
      map.set(k, g);
    }
    return [...map.entries()].sort((a, b) => b[1].sum - a[1].sum);
  };

  const download = () => {
    const csv = toCsv([
      ["Ticket", "Event", "Exhibitor", "Booth", "Service", "Completed", "Labor hours", "Calculated", "Charge", "Adjustment reason"],
      ...rows.map((t) => [t.ticket_number, t.event?.name, t.exhibitor?.company_name, t.booth_number, SERVICE_LABEL[t.service_type], t.completed_at, t.labor_hours, t.calculated_charge == null ? "" : Number(t.calculated_charge).toFixed(2), Number(t.charge_amount ?? 0).toFixed(2), t.charge_adjustment_reason]),
      ["", "", "", "", "", "", "", "Total", total.toFixed(2), ""],
    ]);
    const ex = exhibitors.find((e) => e.id === exhibitorId);
    const slug = ex ? `-${ex.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `expohaul-billing${slug}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Billing" title="Billing & Reports"
        description={isStaff(m) ? "Charges calculated from each event's rate card when a job is completed." : "Charges for your completed services."}
        actions={<Button variant="teal" onClick={download} disabled={rows.length === 0}><Download /> Export CSV</Button>} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Event</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All events</SelectItem>
              {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isStaff(m) && (
          <div className="grid gap-1.5">
            <Label>Exhibitor</Label>
            <Select value={exhibitorId} onValueChange={setExhibitorId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All exhibitors</SelectItem>
                {exhibitors.map((e) => <SelectItem key={e.id} value={e.id}>{e.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Revenue" value={fmtMoney(total)} />
        <Stat label="Completed services" value={String(rows.length)} />
        <Stat label="Average charge" value={fmtMoney(rows.length ? total / rows.length : 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Totals title="By event" rows={group((t) => t.event?.name ?? "—")} />
        <Totals title="By exhibitor" rows={group((t) => t.exhibitor?.company_name ?? "—")} />
      </div>

      <Panel title={`Completed services (${rows.length})`}>
        {rows.length === 0 ? <EmptyState title="No completed services" description="Charges appear here when operators complete jobs." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-2.5 font-semibold">Ticket</th>
                  <th className="px-4 py-2.5 font-semibold">Exhibitor · Booth</th>
                  <th className="px-4 py-2.5 font-semibold">Service</th>
                  <th className="px-4 py-2.5 font-semibold">Completed</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Hours</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Charge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-mono text-xs"><Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="hover:underline">{t.ticket_number}</Link></td>
                    <td className="px-4 py-3"><div className="font-medium">{t.exhibitor?.company_name}</div><div className="text-xs text-muted-foreground">{t.event?.name} · Booth {t.booth_number ?? "—"}</div></td>
                    <td className="px-4 py-3">{SERVICE_LABEL[t.service_type]}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDateTime(t.completed_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{t.labor_hours ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtMoney(t.charge_amount)}{t.charge_adjusted_at && <div className="text-xs font-normal text-muted-foreground" title={t.charge_adjustment_reason ?? ""}>Adjusted</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {isStaff(m) && <RateCards cards={cards} events={events} editable={isAdmin(m)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Totals({ title, rows }: { title: string; rows: [string, { count: number; sum: number }][] }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? <EmptyState title="No charges" /> : (
        <ul className="divide-y divide-border">
          {rows.map(([k, g]) => (
            <li key={k} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1 truncate font-medium">{k}</span>
              <span className="text-xs text-muted-foreground">{g.count} jobs</span>
              <span className="w-28 text-right font-semibold tabular-nums">{fmtMoney(g.sum)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

type Card = Awaited<ReturnType<NonNullable<ReturnType<typeof rateCardsQuery>["queryFn"]>>>[number];

function RateCards({ cards, events, editable }: { cards: Card[]; events: { id: string; name: string }[]; editable: boolean }) {
  const qc = useQueryClient();
  const def = cards.find((c) => c.is_default && !c.event_id);
  const missing = events.filter((e) => !cards.some((c) => c.event_id === e.id));
  const [newEvent, setNewEvent] = useState("");

  const createEventCard = async () => {
    const ev = events.find((e) => e.id === newEvent);
    if (!ev || !def) return;
    const { data, error } = await supabase.from("rate_cards")
      .insert({ name: `${ev.name} rates`, event_id: ev.id, is_default: false, organization_id: def.organization_id })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    const { error: e2 } = await supabase.from("service_rates").insert(
      def.service_rates.map((r) => ({ rate_card_id: data.id, organization_id: def.organization_id, service_type: r.service_type, unit: r.unit, rate: r.rate, minimum_charge: r.minimum_charge })),
    );
    if (e2) { toast.error(e2.message); return; }
    toast.success("Event rate card created from the default rates");
    setNewEvent("");
    qc.invalidateQueries({ queryKey: ["rate_cards"] });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rate cards</h2>
          <p className="text-sm text-muted-foreground">An event's own card is used first; otherwise the default card applies. New rates affect jobs completed afterwards.</p>
        </div>
        {editable && def && missing.length > 0 && (
          <div className="flex gap-2">
            <Select value={newEvent} onValueChange={setNewEvent}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Event-specific card for…" /></SelectTrigger>
              <SelectContent>{missing.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" disabled={!newEvent} onClick={createEventCard}>Create</Button>
          </div>
        )}
      </div>
      {cards.map((c) => (
        <Panel key={c.id} title={<>{c.name} <span className="ml-2 text-xs font-normal text-muted-foreground">{c.event ? c.event.name : c.is_default ? "Default" : ""}</span></>}
          action={editable ? <HourlyRate card={c} /> : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-2.5 font-semibold">Service</th>
                  <th className="px-4 py-2.5 font-semibold">Unit</th>
                  <th className="px-4 py-2.5 font-semibold">Rate</th>
                  <th className="px-4 py-2.5 font-semibold">Minimum</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {c.service_rates.map((r) => <RateRow key={r.id} r={r} editable={editable} />)}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function RateRow({ r, editable }: { r: Card["service_rates"][number]; editable: boolean }) {
  const qc = useQueryClient();
  const [unit, setUnit] = useState<RateUnit>(r.unit);
  const [rate, setRate] = useState(String(r.rate));
  const [min, setMin] = useState(String(r.minimum_charge));
  const dirty = unit !== r.unit || Number(rate) !== Number(r.rate) || Number(min) !== Number(r.minimum_charge);
  const save = async () => {
    if (!(Number(rate) >= 0) || !(Number(min) >= 0)) { toast.error("Rates must be zero or more"); return; }
    const { error } = await supabase.from("service_rates").update({ unit, rate: Number(rate), minimum_charge: Number(min) }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rate saved");
    qc.invalidateQueries({ queryKey: ["rate_cards"] });
  };
  if (!editable)
    return (
      <tr><td className="px-4 py-2.5">{SERVICE_LABEL[r.service_type]}</td><td className="px-4 py-2.5">{RATE_UNIT_LABEL[r.unit]}</td>
        <td className="px-4 py-2.5 tabular-nums">{fmtMoney(r.rate)}</td><td className="px-4 py-2.5 tabular-nums">{fmtMoney(r.minimum_charge)}</td></tr>
    );
  return (
    <tr>
      <td className="px-4 py-2">{SERVICE_LABEL[r.service_type]}</td>
      <td className="px-4 py-2">
        <Select value={unit} onValueChange={(v) => setUnit(v as RateUnit)}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(RATE_UNIT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2"><Input className="h-8 w-28" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Rate" /></td>
      <td className="px-4 py-2"><Input className="h-8 w-28" type="number" min="0" step="0.01" value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minimum charge" /></td>
      <td className="px-4 py-2 text-right"><Button size="sm" variant="outline" disabled={!dirty} onClick={save}>Save</Button></td>
    </tr>
  );
}

function HourlyRate({ card }: { card: Card }) {
  const qc = useQueryClient();
  const hourly = card.service_rates.filter((r) => r.unit === "per_hour");
  const [rate, setRate] = useState(hourly[0] ? String(hourly[0].rate) : "");
  const apply = async () => {
    const n = Number(rate);
    if (rate === "" || !(n >= 0)) { toast.error("Enter an hourly rate of zero or more"); return; }
    if (hourly.length === 0) { toast.error("No services on this card are billed per hour. Change a service's unit to 'per hour' first."); return; }
    const { error } = await supabase.from("service_rates").update({ rate: n }).in("id", hourly.map((r) => r.id));
    if (error) { toast.error(error.message); return; }
    toast.success(`Hourly rate set to ${fmtMoney(n)} for ${hourly.length} service${hourly.length > 1 ? "s" : ""}`);
    qc.invalidateQueries({ queryKey: ["rate_cards"] });
  };
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={`hr-${card.id}`} className="text-xs font-normal text-muted-foreground">Hourly labor rate</Label>
      <Input id={`hr-${card.id}`} className="h-8 w-24" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
      <Button size="sm" variant="outline" className="h-8" onClick={apply}>Apply</Button>
    </div>
  );
}
