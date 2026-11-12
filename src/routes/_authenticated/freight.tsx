import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader, Panel, ComingNext, EmptyState } from "@/components/app/page-header";
import { ArrivalBadge } from "@/components/app/badges";
import { freightQuery } from "@/lib/queries";
import { FREIGHT_TYPE_LABEL } from "@/lib/labels";
import { fmtDims, fmtWeight } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/freight")({
  head: () => ({
    meta: [
      { title: "Freight Management — ExpoHaul" },
      { name: "description", content: "Crates and pallets registered for your events, with arrival status and storage location." },
      { property: "og:title", content: "Freight Management — ExpoHaul" },
      { property: "og:description", content: "Registered freight with arrival status and storage location." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(freightQuery()),
  component: FreightPage,
});

function FreightPage() {
  const { data: freight } = useSuspenseQuery(freightQuery());
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Freight identification" title="Freight Management" description="Every crate and pallet on file for your events." />
      <Panel title={`Registered freight (${freight.length})`}>
        {freight.length === 0 ? (
          <EmptyState title="No freight registered" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-2.5 font-semibold">Freight ID</th>
                  <th className="px-4 py-2.5 font-semibold">Exhibitor · Booth</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Weight</th>
                  <th className="px-4 py-2.5 font-semibold">Dimensions</th>
                  <th className="px-4 py-2.5 font-semibold">Location</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {freight.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{f.freight_code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{f.exhibitor?.company_name}</div>
                      <div className="text-xs text-muted-foreground">Booth {f.booth_number ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{f.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {FREIGHT_TYPE_LABEL[f.freight_type]} · {f.pieces} pc
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtWeight(f.weight_lbs)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDims(f.length_in, f.width_in, f.height_in)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.storage_location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <ArrivalBadge status={f.arrival_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ComingNext
        phase="Phase 2"
        title="Freight registration & QR labels"
        items={[
          "Register crates and pallets with weight and dimensions",
          "Generate and print QR labels per freight item",
          "Update arrival status and storage location",
          "Scan-to-identify with private details kept behind sign-in",
        ]}
      />
    </div>
  );
}
