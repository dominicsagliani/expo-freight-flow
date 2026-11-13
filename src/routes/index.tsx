import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Package, Receipt, Route as RouteIcon, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import heroImg from "@/assets/hero-forklift-hall.jpg";
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


function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background">
        <Link to="/plans" className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-5 py-2 text-center text-xs font-medium text-foreground hover:text-teal sm:text-sm">
          <Sparkles className="size-4 text-teal" />
          Founding Contractor Pilot: 30 days at $0 for the first 3 contractors <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Wordmark />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#platform" className="hover:text-foreground">Platform</a>
            <a href="#platform" className="hover:text-foreground">Live dispatch</a>
            <a href="#platform" className="hover:text-foreground">Forklift Mode</a>
            <Link to="/plans" className="hover:text-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth" search={{}}>Sign in</Link></Button>
            <Button asChild size="sm" className="rounded-full"><Link to="/auth" search={{}}>Request pilot</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy text-navy-foreground">
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <h1 className="text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
              The <span className="text-teal">forklift dispatch OS</span> smart exhibition teams are turning to
            </h1>
            <p className="mt-6 max-w-xl text-lg text-sidebar-foreground">
              With ExpoHaul, exhibition contractors cut paperwork, stop losing crates, keep every driver moving, and bill
              accurately straight from the dock.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="teal" size="lg" className="rounded-full">
                <Link to="/dashboard">Open live demo <ArrowRight /></Link>
              </Button>
              <Button asChild variant="inverse" size="lg" className="rounded-full">
                <Link to="/plans">See pricing</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-sidebar-foreground">Digital tickets · QR freight tracking · Live auto-dispatch</p>
          </div>

          <div className="relative">
            <img src={heroImg} alt="Forklift operator moving a crate in an exhibition hall" width={1280} height={1024}
              className="aspect-[5/4] w-full rounded-[32px] object-cover shadow-2xl" />
            <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur sm:right-auto">
              <span className="size-2.5 rounded-full bg-teal" />
              <span className="font-mono text-xs text-muted-foreground">MH-10003</span>
              <span className="text-sm font-medium">Delivered to Booth 842 · FL-02</span>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-6xl px-5 py-20">
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
