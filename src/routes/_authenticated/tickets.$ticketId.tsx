import { TicketPhotos } from "@/components/app/ticket-photos";
import { AssignmentHistory, DeliveryUpdates } from "@/components/app/delivery-updates";
import { fmtMoney } from "@/lib/billing";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ScanLine } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/app/page-header";
import { ArrivalBadge, PriorityBadge, TicketStatusBadge } from "@/components/app/badges";
import { deliveryUpdatesQuery, isStaff, jobAssignmentsQuery, membershipQuery, ticketActivityQuery, ticketQuery } from "@/lib/queries";
import { ACTIVITY_LABEL, DELIVERY_UPDATE_LABEL, type DeliveryUpdateKind, type ActivityDetails, FREIGHT_TYPE_LABEL, SERVICE_LABEL, TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/labels";
import { fmtDateTime, fmtDims, fmtWeight } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tickets/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket details — ExpoHaul" },
      { name: "description", content: "Ticket details, attached freight, and complete activity history." },
      { property: "og:title", content: "Ticket details — ExpoHaul" },
      { property: "og:description", content: "Ticket details, attached freight, and activity history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([
      queryClient.ensureQueryData(ticketQuery(params.ticketId)),
      queryClient.ensureQueryData(ticketActivityQuery(params.ticketId)),
      queryClient.ensureQueryData(deliveryUpdatesQuery(params.ticketId)),
      queryClient.ensureQueryData(jobAssignmentsQuery(params.ticketId)),
    ]),
  component: TicketDetail,
});

function detailText(action: string, details: unknown) {
  const d = (details ?? {}) as ActivityDetails;
  if (action === "status_changed")
    return `${TICKET_STATUS_LABEL[d.from as TicketStatus] ?? d.from} → ${TICKET_STATUS_LABEL[d.to as TicketStatus] ?? d.to}`;
  if (action === "assigned") return [d.operator, d.equipment].filter(Boolean).join(" · ") || "Unassigned";
  if (action.startsWith("freight")) return d.freight_code ?? "";
  if (action === "delivery_update") {
    const x = d as unknown as { kind?: string; note?: string };
    return [DELIVERY_UPDATE_LABEL[x.kind as DeliveryUpdateKind], x.note].filter(Boolean).join(" — ");
  }
  if (action === "ticket_created" && d.service_type) return SERVICE_LABEL[d.service_type as keyof typeof SERVICE_LABEL];
  return "";
}

function TicketDetail() {
  const { ticketId } = Route.useParams();
  const { data: t } = useSuspenseQuery(ticketQuery(ticketId));
  const { data: activity } = useSuspenseQuery(ticketActivityQuery(ticketId));
  const { data: m } = useSuspenseQuery(membershipQuery());
  const canUpload = t.status !== "cancelled" && (isStaff(m) || (!!m.operatorId && t.assigned_operator_id === m.operatorId));
  const totalWeight = t.ticket_freight.reduce((s, tf) => s + Number(tf.freight?.weight_lbs ?? 0), 0);

  return (
    <div className="grid gap-6">
      <Link to="/tickets" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Tickets
      </Link>
      <PageHeader
        eyebrow={t.event?.name}
        title={`Ticket ${t.ticket_number}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {SERVICE_LABEL[t.service_type]} <PriorityBadge priority={t.priority} />
            <TicketStatusBadge status={t.status} />
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Request" bodyClassName="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
            <Item label="Exhibitor" value={t.exhibitor?.company_name} />
            <Item label="Booth" value={t.booth_number} mono />
            <Item label="Destination" value={t.destination} />
            <Item label="Requested" value={fmtDateTime(t.requested_at)} />
            <Item label="On-site contact" value={[t.exhibitor?.contact_name, t.exhibitor?.contact_phone].filter(Boolean).join(" · ")} />
            <Item label="Completed" value={fmtDateTime(t.completed_at)} />
            <Item label="Charge" value={t.status === "completed" ? fmtMoney(t.charge_amount) : "Calculated on completion"} />
            <Item label="Operator · Equipment" value={[t.operator?.full_name, t.equipment?.unit_number].filter(Boolean).join(" · ") || "Not assigned"} />
            <div className="sm:col-span-2">
              <Item label="Special instructions" value={t.special_instructions ?? "None"} />
            </div>
            {t.completion_notes && (
              <div className="sm:col-span-2">
                <Item label="Completion notes" value={t.completion_notes} />
              </div>
            )}
          </Panel>

          <Panel
            title={`Attached freight (${t.ticket_freight.length})`}
            action={<span className="text-xs text-muted-foreground">{fmtWeight(totalWeight)} total</span>}
          >
            {t.ticket_freight.length === 0 ? (
              <EmptyState title="No freight attached" description="This request is a labor or equipment service." />
            ) : (
              <ul className="divide-y divide-border">
                {t.ticket_freight.map((tf) =>
                  tf.freight ? (
                    <li key={tf.freight.id} className="grid gap-1 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-sm font-medium">{tf.freight.freight_code}</span>
                        <ArrivalBadge status={tf.freight.arrival_status} />
                      </div>
                      <div className="text-sm">{tf.freight.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {FREIGHT_TYPE_LABEL[tf.freight.freight_type]} · {tf.freight.pieces} pc · {fmtWeight(tf.freight.weight_lbs)} ·{" "}
                        {fmtDims(tf.freight.length_in, tf.freight.width_in, tf.freight.height_in)}
                        {tf.freight.storage_location ? ` · ${tf.freight.storage_location}` : ""}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {tf.scanned_at ? (
                          <>
                            <CheckCircle2 className="size-3.5 text-status-completed" />
                            <span className="text-status-completed">Scanned {fmtDateTime(tf.scanned_at)}</span>
                          </>
                        ) : (
                          <>
                            <ScanLine className="size-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Not yet scanned</span>
                          </>
                        )}
                      </div>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </Panel>
          <Panel title="Delivery updates & notes" bodyClassName="p-4">
            <DeliveryUpdates
              ticketId={t.id}
              canPost={canUpload}
              freight={t.ticket_freight.flatMap((tf) => (tf.freight ? [{ id: tf.freight.id, freight_code: tf.freight.freight_code }] : []))}
            />
          </Panel>
          <Panel title="Assignment history" bodyClassName="px-4 py-2">
            <AssignmentHistory ticketId={t.id} />
          </Panel>
          <Panel title="Photos" bodyClassName="p-4">
            <TicketPhotos ticketId={t.id} canUpload={canUpload} />
          </Panel>
        </div>

        <Panel title="Activity history">
          {activity.length === 0 ? (
            <EmptyState title="No activity recorded" />
          ) : (
            <ol className="relative px-4 py-4">
              {activity.map((a, i) => (
                <li key={a.id} className="relative grid grid-cols-[1rem_1fr] gap-3 pb-5 last:pb-0">
                  {i < activity.length - 1 && <span className="absolute left-[0.4375rem] top-4 h-full w-px bg-border" />}
                  <span className="mt-1.5 size-2 rounded-full bg-teal ring-4 ring-teal-soft" />
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{ACTIVITY_LABEL[a.action] ?? a.action}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {detailText(a.action, a.details)}
                      {detailText(a.action, a.details) ? " · " : ""}
                      {a.actor_name ?? "System"}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}
