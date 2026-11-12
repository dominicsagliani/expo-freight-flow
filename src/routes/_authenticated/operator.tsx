import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/app/page-header";
import { PriorityBadge, TicketStatusBadge } from "@/components/app/badges";
import { QrScanner } from "@/components/app/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SERVICE_LABEL, OPEN_STATUSES } from "@/lib/labels";
import { parseScanToken } from "@/lib/scan-token";

export const Route = createFileRoute("/_authenticated/operator")({
  head: () => ({
    meta: [
      { title: "My jobs — ExpoHaul operator" },
      { name: "description", content: "Assigned forklift jobs and freight QR scanning." },
      { property: "og:title", content: "My jobs — ExpoHaul operator" },
      { property: "og:description", content: "Assigned forklift jobs and freight QR scanning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OperatorPage,
});

function OperatorPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [bad, setBad] = useState<string | null>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["operator-jobs"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: roles } = await supabase
        .from("user_roles").select("operator_id").eq("user_id", u.user?.id ?? "").eq("role", "operator");
      const ids = (roles ?? []).map((r) => r.operator_id).filter(Boolean) as string[];
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_number, booth_number, status, priority, service_type, destination, exhibitor:exhibitors(company_name)")
        .in("assigned_operator_id", ids)
        .in("status", OPEN_STATUSES)
        .order("requested_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const go = (raw: string) => {
    const token = parseScanToken(raw);
    if (!token) { setBad("That code isn't an ExpoHaul freight label."); return; }
    setOpen(false);
    navigate({ to: "/scan/$token", params: { token } });
  };

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageHeader eyebrow="Operator" title="My jobs" description="Scan a freight label to confirm what you're moving." />
      <Button size="lg" className="h-14 text-base" onClick={() => { setBad(null); setOpen(true); }}>
        <ScanLine className="mr-2 size-5" /> Scan freight QR
      </Button>
      <Panel bodyClassName="divide-y">
        {jobs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No open jobs assigned to you.</p>}
        {jobs.map((j) => (
          <Link key={j.id} to="/tickets/$ticketId" params={{ ticketId: j.id }} className="block p-4 hover:bg-muted/50">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold">{j.ticket_number}</span>
              <TicketStatusBadge status={j.status} />
            </div>
            <div className="mt-1 text-sm">{j.exhibitor?.company_name} · Booth {j.booth_number ?? "—"}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <PriorityBadge priority={j.priority} /> {SERVICE_LABEL[j.service_type]}{j.destination ? ` → ${j.destination}` : ""}
            </div>
          </Link>
        ))}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Scan freight label</DialogTitle></DialogHeader>
          {open && <QrScanner onResult={go} />}
          {bad && <p className="text-sm text-destructive">{bad}</p>}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(manual); }}>
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or paste label code" />
            <Button type="submit" variant="outline">Open</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
