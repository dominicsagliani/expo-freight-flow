import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingNext } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch — ExpoHaul" },
      { name: "description", content: "Dispatch board for pending, assigned, in-progress, and completed jobs." },
      { property: "og:title", content: "Dispatch — ExpoHaul" },
      { property: "og:description", content: "Dispatch board for material handling jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="grid gap-6">
      <PageHeader eyebrow="Dispatch" title="Dispatch board" description="Assign operators and equipment and monitor every job." />
      <ComingNext
        phase="Phase 2"
        title="Dispatch board"
        items={["Columns for pending, assigned, in-progress, and completed jobs", "Assign available operators and equipment", "Reassign or update requests", "Every change recorded in activity history"]}
      />
    </div>
  ),
});
