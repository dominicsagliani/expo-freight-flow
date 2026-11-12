import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader, Panel, ComingNext } from "@/components/app/page-header";
import { equipmentQuery, operatorsQuery } from "@/lib/queries";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/operators")({
  head: () => ({
    meta: [
      { title: "Operators — ExpoHaul" },
      { name: "description", content: "Forklift operators, certifications, and equipment fleet." },
      { property: "og:title", content: "Operators — ExpoHaul" },
      { property: "og:description", content: "Forklift operators, certifications, and equipment fleet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(operatorsQuery()), queryClient.ensureQueryData(equipmentQuery())]),
  component: OperatorsPage,
});

const OP_STATUS = { available: "Available", on_job: "On job", off_shift: "Off shift" } as const;
const EQ_STATUS = { available: "Available", in_use: "In use", maintenance: "Maintenance" } as const;

function OperatorsPage() {
  const { data: operators } = useSuspenseQuery(operatorsQuery());
  const { data: equipment } = useSuspenseQuery(equipmentQuery());
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Workforce" title="Operators" description="Certified forklift operators and the equipment fleet." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Operators (${operators.length})`}>
          <ul className="divide-y divide-border">
            {operators.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`size-2 rounded-full ${o.status === "available" ? "bg-status-completed" : o.status === "on_job" ? "bg-status-progress" : "bg-status-cancelled"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{o.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.certification_number} · cert. expires {fmtDate(o.certification_expires)}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{OP_STATUS[o.status]}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`Equipment (${equipment.length})`}>
          <ul className="divide-y divide-border">
            {equipment.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-12 font-mono text-sm font-medium">{e.unit_number}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{e.description}</div>
                  <div className="text-xs text-muted-foreground">{e.capacity_lbs?.toLocaleString()} lb capacity</div>
                </div>
                <span className="text-xs text-muted-foreground">{EQ_STATUS[e.status]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <ComingNext
        phase="Phase 3"
        title="Operator portal"
        items={["Mobile job list for each operator", "Scan freight QR codes to confirm identity", "Start and complete jobs with notes", "Upload completion photos"]}
      />
    </div>
  );
}
