import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { inviteShipmentExhibitors } from "@/utils/shipment-access.functions";

export function ShipmentInvitations({ eventId, contacts }: { eventId: string; contacts: number }) {
  const invite = useServerFn(inviteShipmentExhibitors);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const send = async () => {
    setBusy(true);
    try {
      const result = await invite({ data: { eventId } });
      toast.success(`${result.sent} tracking invitations sent${result.missingEmails ? ` · ${result.missingEmails} contacts missing email` : ""}`);
      setFailures(result.failed.map((f) => `${f.company}: ${f.reason === "recipient_suppressed" ? "Email opted out" : f.reason}`));
      if (!result.failed.length) setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Invitations not sent"); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
    <DialogTrigger asChild><Button variant="outline" disabled={!contacts}><Mail /> Invite exhibitors</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Send freight tracking invitations?</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{contacts} exhibitor contacts at this event will receive a private sign-in link to their freight, charges, and invoices.</p>
      {failures.length > 0 && <ul className="max-h-40 overflow-auto text-sm text-destructive">{failures.map((f, i) => <li key={i}>{f}</li>)}</ul>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={send}><Mail />{busy ? "Sending…" : "Send invitations"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}