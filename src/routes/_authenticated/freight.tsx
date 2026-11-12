import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, QrCode as QrIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FreightFormDialog } from "@/components/app/freight-form-dialog";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader, Panel, ComingNext, EmptyState } from "@/components/app/page-header";
import { ArrivalBadge } from "@/components/app/badges";
import { eventExhibitorsQuery, eventsQuery, freightQuery, isStaff, membershipQuery } from "@/lib/queries";
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
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(freightQuery()),
      queryClient.ensureQueryData(eventsQuery()),
      queryClient.ensureQueryData(eventExhibitorsQuery()),
    ]),
  component: FreightPage,
});

function FreightPage() {
  const { data: freight } = useSuspenseQuery(freightQuery());
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: booths } = useSuspenseQuery(eventExhibitorsQuery());
  const canRegister = isStaff(m) || (m.role === "exhibitor" && !!m.exhibitorId);
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Freight identification" title="Freight Management" description="Every crate and pallet on file for your events."
        actions={
          canRegister ? (
            <FreightFormDialog
              events={events.filter((e) => e.status !== "closed")}
              booths={booths}
              lockedExhibitorId={m.role === "exhibitor" ? m.exhibitorId : null}
              canSetStatus={isStaff(m)}
              trigger={<Button variant="teal"><Plus /> Register freight</Button>}
            />
          ) : null
        }
      />
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
                  <th className="px-4 py-2.5 font-semibold">Label</th>
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
                    <td className="px-4 py-3">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/labels/$freightId" params={{ freightId: f.id }}><QrIcon /> Print</Link>
                      </Button>
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
        title="Freight updates & scanning"
        items={[
          "Update arrival status and storage location",
          "Camera QR scanning inside the operator portal",
        ]}
      />
    </div>
  );
}
