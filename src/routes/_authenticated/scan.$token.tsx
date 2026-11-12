import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/app/page-header";
import { ArrivalBadge } from "@/components/app/badges";
import { FREIGHT_TYPE_LABEL } from "@/lib/labels";
import { fmtDims, fmtWeight } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/scan/$token")({
  head: () => ({
    meta: [
      { title: "Scanned freight — ExpoHaul" },
      { name: "description", content: "Freight identified from a QR label." },
      { property: "og:title", content: "Scanned freight — ExpoHaul" },
      { property: "og:description", content: "Freight identified from a QR label." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const { token } = Route.useParams();
  const { data: f, isLoading } = useQuery({
    queryKey: ["scan", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_items")
        .select("*, exhibitor:exhibitors(company_name), event:events(name)")
        .eq("qr_token", token)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  if (isLoading) return null;
  if (!f)
    return (
      <Panel bodyClassName="p-8 text-center">
        <p className="font-medium">Freight not found</p>
        <p className="mt-1 text-sm text-muted-foreground">This label doesn't exist or you don't have access to it.</p>
        <Link to="/freight" className="mt-4 inline-block text-sm font-medium text-status-progress hover:underline">Go to freight</Link>
      </Panel>
    );
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Freight identified" title={f.freight_code} description={f.event?.name} />
      <Panel bodyClassName="grid gap-4 p-4 sm:grid-cols-2">
        <Row label="Exhibitor" value={f.exhibitor?.company_name} />
        <Row label="Booth" value={f.booth_number} />
        <Row label="Description" value={f.description} />
        <Row label="Type · Pieces" value={`${FREIGHT_TYPE_LABEL[f.freight_type]} · ${f.pieces}`} />
        <Row label="Weight" value={fmtWeight(f.weight_lbs)} />
        <Row label="Dimensions" value={fmtDims(f.length_in, f.width_in, f.height_in)} />
        <Row label="Storage location" value={f.storage_location} />
        <div><div className="eyebrow">Status</div><div className="mt-1"><ArrivalBadge status={f.arrival_status} /></div></div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return <div><div className="eyebrow">{label}</div><div className="mt-0.5 text-sm">{value || "—"}</div></div>;
}
