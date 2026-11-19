import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, Camera, CheckCircle2, ClipboardList, ExternalLink, FileText, History,
  LoaderCircle, MapPin, Package, PackageCheck, RotateCcw, ScanLine, Truck, type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrivalBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/page-header";
import { getFreightHistory } from "@/utils/freight-history.functions";
import type { FreightHistoryEvent } from "@/lib/freight-history";
import type { ArrivalStatus } from "@/lib/labels";
import { FREIGHT_TYPE_LABEL } from "@/lib/labels";
import { fmtDateTime, fmtWeight } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_META: Record<FreightHistoryEvent["kind"], { icon: LucideIcon; className: string }> = {
  received: { icon: PackageCheck, className: "bg-teal-soft text-status-progress" },
  staging: { icon: MapPin, className: "bg-status-assigned-soft text-status-assigned" },
  dispatch: { icon: ClipboardList, className: "bg-teal-soft text-status-progress" },
  assignment: { icon: Truck, className: "bg-status-assigned-soft text-status-assigned" },
  pickup: { icon: ScanLine, className: "bg-status-progress-soft text-status-progress" },
  delivery: { icon: CheckCircle2, className: "bg-status-completed-soft text-status-completed" },
  issue: { icon: AlertTriangle, className: "bg-status-hold-soft text-destructive" },
  resolution: { icon: CheckCircle2, className: "bg-status-completed-soft text-status-completed" },
  correction: { icon: RotateCcw, className: "bg-status-requested-soft text-status-requested" },
  note: { icon: FileText, className: "bg-muted text-muted-foreground" },
  status: { icon: Package, className: "bg-muted text-muted-foreground" },
};

export function FreightCodeHistoryLink({ freightId, freightCode, className }: { freightId: string; freightCode: string; className?: string }) {
  return (
    <FreightHistoryDialog
      freightId={freightId}
      freightCode={freightCode}
      trigger={
        <button
          type="button"
          aria-label={`View ${freightCode} chain of custody`}
          title="View chain of custody"
          className={cn("inline-flex max-w-full items-center gap-1 break-all text-left font-mono text-xs font-medium text-teal hover:underline", className)}
        >
          {freightCode}<History className="size-3 shrink-0" />
        </button>
      }
    />
  );
}

export function FreightHistoryDialog({ freightId, freightCode, trigger }: { freightId: string; freightCode?: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const fetchHistory = useServerFn(getFreightHistory);
  const history = useQuery({
    queryKey: ["freight-history", freightId],
    queryFn: () => fetchHistory({ data: { freightId } }),
    enabled: open,
    staleTime: 30_000,
  });
  const data = history.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[min(52rem,calc(100dvh-2rem))] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-3rem)]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 text-left sm:px-6">
          <div className="eyebrow mb-1 flex items-center gap-1.5"><History className="size-3.5" /> Chain of custody</div>
          <DialogTitle className="font-mono text-xl">{data?.freight.freight_code ?? freightCode ?? "Crate history"}</DialogTitle>
          <DialogDescription>
            {data ? `${data.freight.exhibitor_name} · ${data.freight.event_name}` : "Receiving, staging, handling and delivery in chronological order."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {history.isLoading && (
            <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Loading crate history…</div>
          )}
          {history.isError && (
            <EmptyState
              title="Could not load crate history"
              description={(history.error as Error).message}
              action={<Button variant="outline" onClick={() => void history.refetch()}><RotateCcw /> Try again</Button>}
            />
          )}
          {data && (
            <>
              <section className="grid gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words font-medium">{data.freight.description}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {FREIGHT_TYPE_LABEL[data.freight.freight_type]} · {data.freight.pieces} {data.freight.pieces === 1 ? "piece" : "pieces"} · {fmtWeight(data.freight.weight_lbs)}
                    </div>
                  </div>
                  <ArrivalBadge status={data.freight.arrival_status} />
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="eyebrow">Booth</dt><dd className="mt-1 font-mono">{data.freight.booth_number ?? "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="eyebrow">Current location</dt><dd className="mt-1 break-words">{data.freight.storage_location ?? "Not recorded"}</dd></div>
                </dl>
                {data.freight.bol && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>{data.freight.bol.carrier_name ?? "Carrier not entered"}{data.freight.bol.pro_number ? ` · PRO ${data.freight.bol.pro_number}` : ""}</span>
                    {data.freight.bol.document?.url && (
                      <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                        <a href={data.freight.bol.document.url} target="_blank" rel="noreferrer"><ExternalLink /> Open BOL</a>
                      </Button>
                    )}
                  </div>
                )}
              </section>

              <section className="px-5 py-5 sm:px-6" aria-label="Crate timeline">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold">Crate timeline</h3>
                  <span className="text-xs text-muted-foreground">{data.events.length} {data.events.length === 1 ? "entry" : "entries"}</span>
                </div>
                {data.events.length === 0 ? <EmptyState title="No handling history recorded yet" /> : (
                  <ol>
                    {data.events.map((event, index) => <TimelineEntry key={event.id} event={event} last={index === data.events.length - 1} />)}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimelineEntry({ event, last }: { event: FreightHistoryEvent; last: boolean }) {
  const meta = KIND_META[event.kind] ?? KIND_META.status;
  const Icon = meta.icon;
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
      {!last && <span className="absolute left-[0.9375rem] top-8 h-[calc(100%-2rem)] w-px bg-border" aria-hidden="true" />}
      <span className={`relative z-10 flex size-8 items-center justify-center rounded-full ${meta.className}`}><Icon className="size-4" /></span>
      <div className="min-w-0 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h4 className="break-words text-sm font-semibold">{event.title}</h4>
          <time className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(event.occurred_at)}</time>
        </div>
        {event.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{event.description}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {event.actor_name && <span>{event.actor_name}</span>}
          {event.location && <span>{event.location}</span>}
          {event.ticket_number && <span className="font-mono">{event.ticket_number}</span>}
        </div>
        {event.photos.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {event.photos.map((photo) => photo.url ? (
              <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="group relative block aspect-square overflow-hidden rounded-md border border-border bg-muted">
                <img src={photo.url} alt={`${event.title} photo`} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                <span className="absolute bottom-1 right-1 rounded bg-primary/80 p-1 text-primary-foreground"><Camera className="size-3" /></span>
              </a>
            ) : <span key={photo.id} className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground">Photo unavailable</span>)}
          </div>
        )}
      </div>
    </li>
  );
}

export type BoothFreightRow = {
  freight_id: string;
  freight_code: string;
  description: string;
  arrival_status: ArrivalStatus;
};

export function BoothFreightDialog({ boothNumber, exhibitorName, crates, trigger }: { boothNumber: string; exhibitorName: string; crates: BoothFreightRow[]; trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle>Booth {boothNumber} crates</DialogTitle>
          <DialogDescription>{exhibitorName} · Select a crate ID for its full chain of custody.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          {crates.length === 0 ? <EmptyState title="No crates registered for this booth" /> : (
            <ul className="divide-y divide-border">
              {crates.map((crate) => (
                <li key={crate.freight_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <FreightCodeHistoryLink freightId={crate.freight_id} freightCode={crate.freight_code} />
                    <div className="mt-1 break-words text-sm text-muted-foreground">{crate.description}</div>
                  </div>
                  <ArrivalBadge status={crate.arrival_status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
