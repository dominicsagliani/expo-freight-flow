import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode } from "@/components/app/qr-code";
import { qrPayload } from "@/lib/freight-label";
import { buildShipmentDescription, SHIP_DESTINATIONS, type ShipDestination } from "@/lib/ship-labels";

export const Route = createFileRoute("/_authenticated/ship-labels")({
  head: () => ({
    meta: [
      { title: "Inbound shipping labels — ExpoHaul" },
      { name: "description", content: "Exhibitors create pre-advised inbound shipping labels with QR codes for each piece." },
      { property: "og:title", content: "Inbound shipping labels — ExpoHaul" },
      { property: "og:description", content: "Create QR shipping labels before freight leaves your warehouse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShipLabelsPage,
});

type Created = { id: string; freight_code: string; qr_token: string; booth_number: string | null };

function ShipLabelsPage() {
  const qc = useQueryClient();
  const { data: slots = [] } = useQuery({
    queryKey: ["ship-label-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_exhibitors")
        .select("event_id, exhibitor_id, booth_number, event:events(name, venue, address, city), exhibitor:exhibitors(company_name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const [slotKey, setSlotKey] = useState("");
  const [destination, setDestination] = useState<ShipDestination>("advance_warehouse");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [pieces, setPieces] = useState(1);
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);

  const slot = slots.find((s) => `${s.event_id}:${s.exhibitor_id}` === slotKey) ?? slots[0];

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    if (pieces < 1 || pieces > 50) { toast.error("Pieces must be between 1 and 50."); return; }
    setBusy(true);
    const description = buildShipmentDescription({ destination, fromName, fromAddress, carrier, tracking, contact });
    const rows = Array.from({ length: pieces }, () => ({
      event_id: slot.event_id,
      exhibitor_id: slot.exhibitor_id,
      booth_number: slot.booth_number,
      description,
      pieces: 1,
      freight_type: "crate" as const,
      arrival_status: "expected" as const,
    }));
    const { data, error } = await supabase.from("freight_items").insert(rows as never).select("id, freight_code, qr_token, booth_number");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCreated((data ?? []) as Created[]);
    qc.invalidateQueries({ queryKey: ["freight"] });
    toast.success(`${data?.length ?? 0} labels ready to print`);
  }

  if (created.length && slot) {
    const dest = SHIP_DESTINATIONS[destination];
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-sm text-muted-foreground">Print one label per piece and tape it to the side of each crate.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCreated([])}>New shipment</Button>
            <Button variant="teal" onClick={() => window.print()}><Printer /> Print labels</Button>
          </div>
        </div>
        {created.map((c, i) => (
          <div key={c.id} className="mx-auto w-full max-w-[4in] break-after-page rounded-md border-2 border-foreground bg-card p-4 text-foreground print:h-[6in] print:rounded-none">
            <div className="flex items-center justify-between border-b-2 border-foreground pb-2">
              <span className="font-display text-sm font-bold">ExpoHaul</span>
              <span className="rounded bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase text-background">{dest.label}</span>
            </div>
            <div className="mt-2 text-xs font-semibold leading-tight">{slot.event?.name}</div>
            <div className="text-[10px] leading-tight">{slot.event?.venue}{slot.event?.address ? `, ${slot.event.address}` : ""}</div>
            <div className="mt-3 flex items-center gap-3">
              <QrCode value={qrPayload(window.location.origin, c.qr_token)} size={140} />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase">Booth</div>
                <div className="font-display text-4xl font-bold leading-none">{c.booth_number ?? "—"}</div>
                <div className="mt-2 text-[10px] font-semibold uppercase">Piece</div>
                <div className="font-display text-2xl font-bold leading-none">{i + 1} of {created.length}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-1 border-t border-foreground pt-2 text-xs">
              <div><b>Exhibitor:</b> {slot.exhibitor?.company_name}</div>
              <div><b>From:</b> {fromName}{fromAddress ? `, ${fromAddress}` : ""}</div>
              <div><b>Carrier:</b> {carrier}{tracking ? ` · ${tracking}` : ""}</div>
              {contact && <div><b>On-site contact:</b> {contact}</div>}
              <div className="font-mono font-bold">{c.freight_code}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Tag className="size-6" /> Inbound shipping labels</h1>
        <p className="text-sm text-muted-foreground">Fill this out before you ship. Each piece gets its own QR label, and the dock sees your shipment coming.</p>
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">You aren't booked into any event yet. Ask the show contractor to add your booth.</p>
      ) : (
        <form onSubmit={generate} className="grid gap-4 rounded-lg border bg-card p-5">
          <div className="grid gap-1.5">
            <Label htmlFor="slot">Event & booth</Label>
            <select id="slot" className="h-9 rounded-md border bg-background px-2 text-sm" value={slot ? `${slot.event_id}:${slot.exhibitor_id}` : ""} onChange={(e) => setSlotKey(e.target.value)}>
              {slots.map((s) => (
                <option key={`${s.event_id}:${s.exhibitor_id}`} value={`${s.event_id}:${s.exhibitor_id}`}>
                  {s.event?.name} — {s.exhibitor?.company_name} — Booth {s.booth_number}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Ship to</Label>
            <div className="flex gap-2">
              {(Object.keys(SHIP_DESTINATIONS) as ShipDestination[]).map((k) => (
                <Button key={k} type="button" variant={destination === k ? "teal" : "outline"} onClick={() => setDestination(k)}>{SHIP_DESTINATIONS[k].label}</Button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="fn">Shipping from (company)</Label><Input id="fn" required value={fromName} onChange={(e) => setFromName(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="fa">From address</Label><Input id="fa" required placeholder="Street, city, state, zip" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="ca">Carrier</Label><Input id="ca" required placeholder="e.g. Old Dominion" value={carrier} onChange={(e) => setCarrier(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="tr">Tracking / PRO # (optional)</Label><Input id="tr" value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="pc">Number of pieces</Label><Input id="pc" type="number" min={1} max={50} required value={pieces} onChange={(e) => setPieces(Number(e.target.value))} /></div>
            <div className="grid gap-1.5"><Label htmlFor="ct">On-site contact (optional)</Label><Input id="ct" placeholder="Name & mobile" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
          </div>
          <Button type="submit" variant="teal" disabled={busy}>{busy ? "Creating…" : `Create ${pieces} label${pieces === 1 ? "" : "s"}`}</Button>
        </form>
      )}
    </div>
  );
}
