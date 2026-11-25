import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FreightLabelCard } from "@/components/app/freight-label-card";
import { sortBoothLabels } from "@/lib/shipments";

const labelsQuery = (eventId: string) => queryOptions({
  queryKey: ["shipment-labels", eventId],
  queryFn: async () => {
    const { data, error } = await supabase.from("freight_items")
      .select("id, freight_code, qr_token, booth_number, pieces, freight_type, event:events(name), exhibitor:exhibitors(company_name, contact_name)")
      .eq("event_id", eventId);
    if (error) throw new Error(error.message);
    return sortBoothLabels(data ?? []);
  },
});

export const Route = createFileRoute("/_authenticated/shipment-labels")({
  validateSearch: (s: Record<string, unknown>) => ({ eventId: typeof s["eventId"] === "string" ? s["eventId"] : "" }),
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => queryClient.ensureQueryData(labelsQuery(deps.eventId)),
  head: () => ({ meta: [
    { title: "Batch freight labels — ExpoHaul" },
    { name: "description", content: "Print saved freight labels for an entire event in one print job." },
    { property: "og:title", content: "Batch freight labels — ExpoHaul" },
    { property: "og:description", content: "Unique crate tracking labels, ordered by booth." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ShipmentLabels,
});

function ShipmentLabels() {
  const { eventId } = Route.useSearch();
  const { data: freight } = useSuspenseQuery(labelsQuery(eventId));
  const sheet = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const timer = setInterval(() => {
      const images = sheet.current?.querySelectorAll("img");
      if (images?.length === freight.length && freight.length > 0 && [...images].every((img) => img.complete && img.naturalWidth > 0)) setReady(true);
    }, 100);
    return () => clearInterval(timer);
  }, [freight]);
  return <div className="grid min-w-0 gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="ghost" asChild><Link to="/shipments" search={{ eventId }}><ArrowLeft /> Shipments</Link></Button>
      <Button disabled={!ready} onClick={() => window.print()}><Printer /> {ready ? `Print all ${freight.length} labels` : freight.length ? "Preparing labels…" : "No freight labels"}</Button>
    </div>
    <div className="print:hidden"><h1 className="font-display text-2xl font-bold">{freight[0]?.event?.name ?? "Freight labels"}</h1><p className="text-sm text-muted-foreground">{freight.length} saved labels · 59 × 104 mm</p></div>
    <div ref={sheet} className="print-label-sheet grid min-w-0 gap-6">
      {freight.map((f) => <FreightLabelCard key={f.id} freight={f} />)}
    </div>
  </div>;
}