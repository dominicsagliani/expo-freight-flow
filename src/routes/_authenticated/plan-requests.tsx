import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { membershipQuery, salesRequestsQuery } from "@/lib/queries";
import { reviewSalesRequest } from "@/utils/payments.functions";

export const Route = createFileRoute("/_authenticated/plan-requests")({
  head: () => ({
    meta: [
      { title: "Pilot & Enterprise Requests — ExpoHaul" },
      { name: "description", content: "Review Founding Contractor Pilot and Enterprise requests." },
      { property: "og:title", content: "Pilot & Enterprise Requests — ExpoHaul" },
      { property: "og:description", content: "Approve or decline pilot and Enterprise requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(membershipQuery()),
      queryClient.ensureQueryData(salesRequestsQuery()),
    ]),
  component: RequestsPage,
});

function RequestsPage() {
  const { data: m } = useSuspenseQuery(membershipQuery());
  const { data } = useSuspenseQuery(salesRequestsQuery());
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  if (!m.isPlatformOwner) {
    return <p className="text-sm text-muted-foreground">Only the platform owner can view this page.</p>;
  }

  const review = async (requestId: string, decision: "approve" | "decline") => {
    setBusy(requestId);
    const result = await reviewSalesRequest({ data: { requestId, decision } });
    setBusy(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approve" ? "Approved." : "Declined.");
    queryClient.invalidateQueries({ queryKey: ["sales-requests"] });
    queryClient.invalidateQueries({ queryKey: ["entitlement"] });
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Platform"
        title="Pilot & Enterprise requests"
        description={`Founding Contractor Pilot spots used: ${data.grants.length} of 3. Approving a pilot gives that company 30 days and one event.`}
      />
      <Panel title="Requests" bodyClassName="divide-y divide-border">
        {data.requests.length === 0 && <p className="p-4 text-sm text-muted-foreground">No requests yet.</p>}
        {data.requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                {r.company_name} <span className="text-xs uppercase text-muted-foreground">· {r.kind}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {r.contact_email} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
              </div>
              {r.message && <p className="mt-1 text-sm">{r.message}</p>}
            </div>
            {r.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === r.id} onClick={() => review(r.id, "approve")}>
                  {r.kind === "pilot" ? "Approve pilot" : "Mark handled"}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => review(r.id, "decline")}>
                  Decline
                </Button>
              </div>
            ) : (
              <span className="text-sm capitalize text-muted-foreground">{r.status}</span>
            )}
          </div>
        ))}
      </Panel>
      <Link to="/plans" className="text-sm text-teal underline">Back to Plans & Billing</Link>
    </div>
  );
}
