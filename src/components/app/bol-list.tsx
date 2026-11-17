import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Printer, QrCode } from "lucide-react";
import { billsOfLadingQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { ArrivalBadge } from "@/components/app/badges";
import { EmptyState, Panel } from "@/components/app/page-header";

export function BolList() {
  const { data: bols } = useSuspenseQuery(billsOfLadingQuery());
  return (
    <Panel title={`Bills of lading (${bols.length})`} className="min-w-0">
      {bols.length === 0 ? (
        <EmptyState title="No BOL shipments received" description="Use BOL check-in to attach one document to multiple individual crates." />
      ) : (
        <div className="divide-y divide-border">
          {bols.map((bol) => (
            <article key={bol.id} data-bol-id={bol.id} className="grid gap-4 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-teal-soft text-status-progress"><FileText className="size-5" /></span>
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold">{bol.original_filename}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {bol.exhibitor?.company_name} · Booth {bol.booth_number ?? "—"} · {bol.event?.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {bol.carrier_name ?? "Carrier not entered"}{bol.pro_number ? ` · PRO ${bol.pro_number}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" disabled={!bol.documentUrl}>
                    <a href={bol.documentUrl ?? undefined} target="_blank" rel="noreferrer"><ExternalLink /> Open BOL</a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/bol-labels/$bolId" params={{ bolId: bol.id }}><Printer /> Reprint all</Link>
                  </Button>
                </div>
              </div>
              <details className="rounded-md border border-border bg-surface px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium">{bol.freight.length} individual {bol.freight.length === 1 ? "crate" : "crates"} · view status and labels</summary>
                <div className="mt-2 divide-y divide-border border-t border-border">
                  {bol.freight.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <span className="w-14 text-xs text-muted-foreground">Crate {f.bol_crate_number ?? "—"}</span>
                      <span className="min-w-28 flex-1 font-mono text-xs font-medium">{f.freight_code}</span>
                      <ArrivalBadge status={f.arrival_status} />
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/labels/$freightId" params={{ freightId: f.id }}><QrCode /> Reprint</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
