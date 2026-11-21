import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";

const autoPrinted = new Set<string>();
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toCrateLabels } from "@/components/app/dymo-print";
import { FreightLabelCard } from "@/components/app/freight-label-card";

export const Route = createFileRoute("/_authenticated/labels/$freightId")({
  head: () => ({
    meta: [
      { title: "Freight label — ExpoHaul" },
      { name: "description", content: "Printable QR label for a freight item." },
      { property: "og:title", content: "Freight label — ExpoHaul" },
      { property: "og:description", content: "Printable QR label for a freight item." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { autoprint?: number } => (s["autoprint"] ? { autoprint: 1 } : {}),
  component: LabelPage,
});

function LabelPage() {
  const { freightId } = Route.useParams();
  const { data: f, error } = useQuery({
    queryKey: ["freight-label", freightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_items")
        .select("freight_code, qr_token, booth_number, pieces, freight_type, event:events(name), exhibitor:exhibitors(company_name, contact_name)")
        .eq("id", freightId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const { autoprint } = Route.useSearch();
  useEffect(() => {
    if (!f || !autoprint || autoPrinted.has(freightId)) return;
    autoPrinted.add(freightId);
    const timer = setTimeout(() => void import("@/lib/print-1x3").then((m) => m.print1x3Labels(toCrateLabels([f]))), 400);
    return () => clearTimeout(timer);
  }, [f, autoprint, freightId]);
  if (error) return <p className="text-sm text-muted-foreground">This freight item isn't available.</p>;
  if (!f) return null;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/freight" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Freight
        </Link>
        <Button variant="teal" onClick={() => void import("@/lib/print-1x3").then((m) => m.print1x3Labels(toCrateLabels([f])))}><Printer /> Print label</Button>
      </div>
      <FreightLabelCard freight={f} />
      <p className="text-center text-xs text-muted-foreground print:hidden">
        The label prints the event, company, booth and contact name. The QR code holds a random code that only works for signed-in staff.
      </p>
    </div>
  );
}
