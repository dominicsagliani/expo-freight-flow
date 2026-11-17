import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, FileScan, MapPin, FileText, Plus, QrCode as QrIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OpenFreightIssues, ReportFreightIssueDialog } from "@/components/app/freight-issues";
import { Button } from "@/components/ui/button";
import { FreightStatusEditor } from "@/components/app/freight-status-editor";
import { FreightFormDialog } from "@/components/app/freight-form-dialog";
import { BolFormDialog } from "@/components/app/bol-form-dialog";
import { BolList } from "@/components/app/bol-list";
import { StageCrateDialog, StagingSummary, useLatestStaging } from "@/components/app/freight-staging";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { ArrivalBadge } from "@/components/app/badges";
import { billsOfLadingQuery, eventExhibitorsQuery, eventsQuery, freightQuery, isStaff, membershipQuery } from "@/lib/queries";
import { FREIGHT_TYPE_LABEL } from "@/lib/labels";
import { fmtDateTime, fmtDims, fmtWeight } from "@/lib/format";

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
      queryClient.ensureQueryData(billsOfLadingQuery()),
    ]),
  component: FreightPage,
});

function FreightPage() {
  const { data: freight } = useSuspenseQuery(freightQuery());
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: booths } = useSuspenseQuery(eventExhibitorsQuery());
  const canRegister = isStaff(m) || (m.role === "exhibitor" && !!m.exhibitorId);
  const openEvents = events.filter((e) => e.status !== "closed");
  const operatorish = isStaff(m) || m.role === "operator";
  const staging = useLatestStaging(operatorish);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return freight;
    return freight.filter((f) =>
      [f.freight_code, f.exhibitor?.company_name, f.booth_number, f.description, f.storage_location, f.bol?.pro_number, f.bol?.carrier_name, f.event?.name, f.bol_id, staging.get(f.id)?.area, staging.get(f.id)?.landmark, staging.get(f.id)?.location_note]
        .some((v) => v?.toLowerCase().includes(t)),
    );
  }, [freight, q, staging]);
  const tile = "flex h-full w-full flex-col items-start gap-1 rounded-md border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-teal";
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader eyebrow="Freight identification" title="Freight Management" description="Every crate and pallet on file for your events."
        actions={
          <>
            {isStaff(m) && <BolFormDialog events={openEvents} booths={booths} trigger={<Button variant="teal"><FileScan /> BOL check-in</Button>} />}
            {canRegister && (
              <FreightFormDialog
                events={openEvents}
                booths={booths}
                lockedExhibitorId={m.role === "exhibitor" ? m.exhibitorId : null}
                canSetStatus={isStaff(m)}
                trigger={<Button variant="outline"><Plus /> Register freight</Button>}
              />
            )}
          </>
        }
      />
      {isStaff(m) && (
        <section aria-label="Receiving" className="grid gap-3 sm:grid-cols-3">
          <BolFormDialog events={openEvents} booths={booths} trigger={
            <button type="button" className={tile}><FileScan className="size-6 text-teal" /><span className="font-display text-base font-semibold">New freight check-in</span><span className="text-xs text-muted-foreground">Upload the BOL, create crates and print labels</span></button>
          } />
          <button type="button" className={tile} onClick={() => { searchRef.current?.focus(); searchRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>
            <Search className="size-6 text-teal" /><span className="font-display text-base font-semibold">Find existing freight</span><span className="text-xs text-muted-foreground">Search by exhibitor, booth, crate ID or PRO</span>
          </button>
          {m.organizationId && <ReportFreightIssueDialog freight={freight} orgId={m.organizationId} trigger={
            <button type="button" className={tile}><AlertTriangle className="size-6 text-destructive" /><span className="font-display text-base font-semibold">Report freight issue</span><span className="text-xs text-muted-foreground">Damage, missing pieces or wrong booth, with a photo</span></button>
          } />}
        </section>
      )}
      {operatorish && <OpenFreightIssues canResolve={isStaff(m)} />}
      {isStaff(m) && <BolList />}
      <Panel title={`Registered freight (${q ? `${shown.length} of ${freight.length}` : freight.length})`} className="min-w-0">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find my crate — exhibitor, booth, crate ID, PRO, location…" aria-label="Find freight" className="pl-8" />
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState title={q ? "No freight matches that search" : "No freight registered"} />
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
                {shown.map((f) => (
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
                      {f.bol_id && <div className="mt-1 flex items-center gap-1 text-xs text-status-progress"><FileText className="size-3" /> BOL attached{f.bol_crate_number ? ` · Crate ${f.bol_crate_number}` : ""}{f.bol?.pro_number ? ` · PRO ${f.bol.pro_number}` : ""}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtWeight(f.weight_lbs)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDims(f.length_in, f.width_in, f.height_in)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{f.storage_location ?? "—"}</div>
                      <StagingSummary row={staging.get(f.id)} />
                      {isStaff(m) && m.organizationId && <StageCrateDialog freightId={f.id} freightCode={f.freight_code} orgId={m.organizationId} trigger={<Button variant="outline" size="sm" className="mt-1"><MapPin />{staging.get(f.id) ? "Move" : "Stage"}</Button>} />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <ArrivalBadge status={f.arrival_status} />
                        {isStaff(m) && <FreightStatusEditor id={f.id} status={f.arrival_status} location={f.storage_location} />}
                      </div>
                      {f.arrived_at && <div className="mt-1 text-xs text-muted-foreground">Arrived {fmtDateTime(f.arrived_at)}</div>}
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
    </div>
  );
}
