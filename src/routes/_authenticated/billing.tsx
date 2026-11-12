import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingNext } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Reports — ExpoHaul" },
      { name: "description", content: "Rate cards, calculated service charges, and billing exports." },
      { property: "og:title", content: "Billing & Reports — ExpoHaul" },
      { property: "og:description", content: "Rate cards, service charges, and billing exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="grid gap-6">
      <PageHeader eyebrow="Billing" title="Billing & Reports" description="Charges calculated from the event rate card and completed services." />
      <ComingNext
        phase="Phase 3"
        title="Billing & reports"
        items={["Configurable service rates per event", "Automatic charges for completed tickets", "Management review of billing records", "Export billing to CSV"]}
      />
    </div>
  ),
});
