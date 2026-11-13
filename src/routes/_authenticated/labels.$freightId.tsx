import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/app/qr-code";
import { FREIGHT_TYPE_LABEL, type FreightType } from "@/lib/labels";
import { labelFields, qrPayload } from "@/lib/freight-label";

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
  if (error) return <p className="text-sm text-muted-foreground">This freight item isn't available.</p>;
  if (!f) return null;
  const l = labelFields(f);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/freight" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Freight
        </Link>
        <Button variant="teal" onClick={() => window.print()}><Printer /> Print label</Button>
      </div>
      <div className="print-label mx-auto w-[4in] rounded-md border-2 border-foreground bg-card p-4 text-foreground">
        <div className="flex items-start justify-between border-b-2 border-foreground pb-2">
          <span className="font-display text-sm font-bold">ExpoHaul</span>
          <span className="text-right text-[10px] leading-tight">{l.event}</span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <QrCode value={qrPayload(window.location.origin, f.qr_token)} size={150} />
          <div className="grid min-w-0 gap-1.5">
            <div><div className="text-[10px] font-semibold uppercase">Company</div><div className="font-display text-sm font-bold leading-tight break-words">{l.company}</div></div>
            <div><div className="text-[10px] font-semibold uppercase">Booth</div><div className="font-display text-3xl font-bold leading-none">{l.booth}</div></div>
            <div><div className="text-[10px] font-semibold uppercase">Contact</div><div className="text-xs font-medium leading-tight">{l.contact}</div></div>
            <div><div className="text-[10px] font-semibold uppercase">Freight ID</div><div className="font-mono text-base font-bold leading-tight">{l.code}</div></div>
            <div className="text-xs">{FREIGHT_TYPE_LABEL[l.type as FreightType]} · {l.pieces} pc</div>
          </div>
        </div>
        <p className="mt-3 border-t border-foreground pt-2 text-[9px]">Scan with the ExpoHaul app. Full details visible to authorized staff only.</p>
      </div>
      <p className="text-center text-xs text-muted-foreground print:hidden">
        The label prints the event, company, booth and contact name. The QR code holds a random code that only works for signed-in staff.
      </p>
    </div>
  );
}
