import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Package, Receipt, Route as RouteIcon, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/app/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExpoHaul — The operating system for material handling" },
      {
        name: "description",
        content:
          "Digitize forklift ticketing, freight QR identification, dispatch, service completion, and billing for trade shows and exhibition contractors.",
      },
      { property: "og:title", content: "ExpoHaul — The operating system for material handling" },
      {
        property: "og:description",
        content: "Forklift tickets, freight tracking, dispatch, and billing for convention centers and exhibition contractors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const modules = [
  { icon: ClipboardList, title: "Material handling tickets", text: "Exhibitors and dispatchers raise requests with freight attached." },
  { icon: ScanLine, title: "Freight identification", text: "Every crate and pallet carries a non-guessable QR label." },
  { icon: RouteIcon, title: "Dispatch board", text: "Assign operators and equipment; watch jobs move to done." },
  { icon: Package, title: "Operator portal", text: "Mobile-first job flow: scan, start, complete, photograph." },
  { icon: Receipt, title: "Rate-card billing", text: "Charges calculated from event rates and completed services." },
  { icon: ShieldCheck, title: "Isolated by design", text: "Role-based access with company and exhibitor data separation." },
];

const board = [
  { n: "MH-10003", c: "Cascade Hydraulics", b: "842", s: "In progress", tone: "bg-status-progress-soft text-status-progress" },
  { n: "MH-10001", c: "Northwind Robotics", b: "1214", s: "Assigned", tone: "bg-status-assigned-soft text-status-assigned" },
  { n: "MH-10009", c: "Ironclad Safety Gear", b: "618", s: "Pending", tone: "bg-status-requested-soft text-status-requested" },
  { n: "MH-10007", c: "Summit Conveyor Co.", b: "1507", s: "Completed", tone: "bg-status-completed-soft text-status-completed" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-brand-gradient text-navy-foreground">
        <div className="absolute inset-0 grid-lines" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Wordmark inverse />
          <Button asChild variant="inverse" size="sm">
            <Link to="/auth" search={{}}>Sign in</Link>
          </Button>
        </header>
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <div className="eyebrow mb-5 text-sidebar-primary">For exhibition contractors & convention centers</div>
            <h1 className="text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
              The operating system for material handling.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-sidebar-foreground">
              ExpoHaul replaces paper forklift tickets with one connected workflow — from freight arrival at the dock to
              delivery at the booth and the final invoice.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="teal" size="lg">
                <Link to="/dashboard">
                  Open workspace <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="inverse" size="lg">
                <Link to="/auth" search={{}}>Create an account</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-sidebar-border bg-card p-4 text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="eyebrow">Live dispatch</div>
                <div className="font-display text-sm font-semibold">Pacific Manufacturing & Automation Expo</div>
              </div>
              <span className="rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium text-status-progress">Move-in</span>
            </div>
            <ul className="divide-y divide-border">
              {board.map((r) => (
                <li key={r.n} className="flex items-center gap-3 py-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{r.n}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.c}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">Booth {r.b}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.tone}`}>{r.s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="eyebrow mb-3">Platform</div>
        <h2 className="max-w-2xl text-3xl font-semibold">Everything between the loading dock and the invoice.</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div key={m.title} className="bg-card p-6">
              <m.icon className="size-5 text-teal" />
              <h3 className="mt-4 text-base font-semibold">{m.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{m.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-sm text-muted-foreground">
          <span>© 2026 ExpoHaul</span>
          <span>The operating system for material handling.</span>
        </div>
      </footer>
    </div>
  );
}
