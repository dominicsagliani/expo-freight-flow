import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, CalendarDays, CheckCircle2, ClipboardList, Package, PackageCheck, Receipt, Route as RouteIcon, ScanLine, ShieldCheck, Sparkles, Warehouse } from "lucide-react";
import heroImg from "@/assets/hero-forklift-hall.jpg";
import dispatchImg from "@/assets/live-dispatch.jpg";
import forkliftImg from "@/assets/forklift-mode.jpg";
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


const audiences = [
  {
    icon: Warehouse,
    title: "Material-handling contractor",
    num: "01",
    primary: true,
    line: "They manage receiving, dispatch, forklift operators, and freight movement.",
    wants: ["Operational efficiency", "Job tracking", "Labor accountability", "Accurate billing"],
  },
  {
    icon: Building2,
    title: "Convention center / venue",
    num: "02",
    line: "They want to know what is happening inside their building.",
    wants: ["Visibility into freight operations", "Accountability", "Safety", "Better coordination"],
  },
  {
    icon: CalendarDays,
    title: "Trade show organizer",
    num: "03",
    line: "They want to know that exhibitors are receiving their freight where and when expected.",
    wants: ["Exhibitor satisfaction", "Fewer freight complaints", "Event oversight", "Reporting"],
  },
  {
    icon: PackageCheck,
    title: "Exhibitor",
    num: "04",
    line: "They want to know where their shipment is and whether it reached their booth.",
    wants: ["Confirmation freight arrived", "Delivery visibility", "Fewer missing crates"],
  },
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
            <a href="#live-dispatch" className="hover:text-foreground">Live dispatch</a>
            <a href="#forklift-mode" className="hover:text-foreground">Forklift Mode</a>
            <a href="#who-we-serve" className="hover:text-foreground">Who we serve</a>
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

      {[
        { id: "live-dispatch", img: dispatchImg, eyebrow: "Live dispatch", title: "Mission control for every forklift on the floor.",
          text: "When an exhibitor calls in or walks up to the desk, your dispatcher opens a ticket in seconds and it goes straight to the next available forklift that can lift the load.",
          points: ["Call-in and walk-in tickets in one tap", "First-truck-in dock queue by exhibitor", "Live view of every forklift: available, on a job, or on break"], flip: false },
        { id: "forklift-mode", img: forkliftImg, eyebrow: "Forklift Mode", title: "A delivery-driver app, built for forklifts.",
          text: "Mount a tablet in the cab, pick the forklift and go online. Jobs arrive automatically, scanning a crate starts the clock and scanning it out at the booth stops it and bills the exhibitor.",
          points: ["No logins or PINs — sign in by forklift", "Scan in starts the timer, scan out stops it", "Charges added to the exhibitor's account automatically"], flip: true },
      ].map((f) => (
        <section key={f.id} id={f.id} className="scroll-mt-20 border-t border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2">
            <img src={f.img} alt={f.title} width={1280} height={960} loading="lazy"
              className={`aspect-[4/3] w-full rounded-[28px] object-cover shadow-xl ${f.flip ? "lg:order-2" : ""}`} />
            <div>
              <div className="eyebrow mb-3">{f.eyebrow}</div>
              <h2 className="text-3xl font-semibold">{f.title}</h2>
              <p className="mt-4 text-muted-foreground">{f.text}</p>
              <ul className="mt-6 space-y-3">
                {f.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" />{pt}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}

      <section id="who-we-serve" className="scroll-mt-20 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <div className="eyebrow mb-3">Who we serve</div>
            <h2 className="text-3xl font-semibold">Built for everyone who touches the freight.</h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              ExpoHaul starts at the loading dock, but the same record keeps the venue, the organizer, and the exhibitor
              looking at the same truth.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full bg-teal" />
              Primary focus: material-handling contractors
            </div>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {audiences.map((a) => (
              <div key={a.title} className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-teal-soft text-teal">
                    <a.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{a.title}</h3>
                      {a.primary && (
                        <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-foreground">
                          Primary target
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{a.line}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.wants.map((w) => (
                        <span key={w} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="ml-auto hidden font-mono text-xs text-muted-foreground sm:block">{a.num}</span>
                </div>
              </div>
            ))}
          </div>
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
