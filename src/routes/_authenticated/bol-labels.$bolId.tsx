import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FreightLabelCard } from "@/components/app/freight-label-card";
import { toast } from "sonner";
import { DymoConnectPanel, DymoPrintButton, toCrateLabels } from "@/components/app/dymo-print";

const autoPrinted = new Set<string>();

export const Route = createFileRoute("/_authenticated/bol-labels/$bolId")({
  head: () => ({
    meta: [
      { title: "BOL crate labels — ExpoHaul" },
      { name: "description", content: "Print every individual crate label linked to a saved Bill of Lading." },
      { property: "og:title", content: "BOL crate labels — ExpoHaul" },
      { property: "og:description", content: "Batch-print unique QR labels for crates received on one Bill of Lading." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { autoprint?: number } => (s["autoprint"] ? { autoprint: 1 } : {}),
  component: BolLabelsPage,
});

function BolLabelsPage() {
  const { bolId } = Route.useParams();
  const { autoprint } = Route.useSearch();
  const { data, error } = useQuery({
    queryKey: ["bol-labels", bolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills_of_lading")
        .select("id, original_filename, freight:freight_items(id, bol_crate_number, freight_code, qr_token, booth_number, pieces, freight_type, event:events(name), exhibitor:exhibitors(company_name, contact_name))")
        .eq("id", bolId)
        .single();
      if (error) throw new Error(error.message);
      return { ...data, freight: [...data.freight].sort((a, b) => (a.bol_crate_number ?? 0) - (b.bol_crate_number ?? 0)) };
    },
  });

  useEffect(() => {
    if (!data?.freight.length || !autoprint || autoPrinted.has(bolId)) return;
    autoPrinted.add(bolId);
    void (async () => {
      try {
        const { printCrateLabels } = await import("@/lib/dymo");
        const n = await printCrateLabels(toCrateLabels(data.freight));
        toast.success(`Sent ${n} labels to the DYMO printer`);
      } catch (e) { toast.error(`Labels not printed: ${(e as Error).message}`); }
    })();
  }, [data, autoprint, bolId]);

  if (error) return <p className="text-sm text-muted-foreground">This Bill of Lading isn't available.</p>;
  if (!data) return null;

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link to="/freight" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Freight
        </Link>
        <div className="flex flex-wrap gap-2">
          <DymoPrintButton size="default" crates={data.freight}>Print labels ({data.freight.length})</DymoPrintButton>
          <Button variant="outline" onClick={() => window.print()} disabled={!data.freight.length}><Printer /> Browser print</Button>
        </div>
      </div>
      <div className="print:hidden"><DymoConnectPanel /></div>
      <div className="print-label-sheet grid min-w-0 gap-6">
        {data.freight.map((f) => (
          <FreightLabelCard key={f.id} freight={f} crateNumber={f.bol_crate_number} crateCount={data.freight.length} />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground print:hidden">
        {data.original_filename} is already saved. Canceling printing never removes the BOL or its crate records; return here to reprint.
      </p>
    </div>
  );
}
