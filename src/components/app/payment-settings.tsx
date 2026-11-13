import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function PaymentSettings({ orgId }: { orgId: string }) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from("organizations").select("payment_link_url, payment_instructions").eq("id", orgId).maybeSingle()
      .then(({ data }) => { setUrl(data?.payment_link_url ?? ""); setNotes(data?.payment_instructions ?? ""); });
  }, [orgId]);
  const save = async () => {
    const link = url.trim();
    if (link && !/^https:\/\/\S+\.\S+/i.test(link)) return void toast.error("Payment link must start with https://");
    setBusy(true);
    const { error } = await supabase.from("organizations").update({ payment_link_url: link || null, payment_instructions: notes.trim() || null }).eq("id", orgId);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Payment details saved");
  };
  return (
    <Panel title="Get paid at time of service" bodyClassName="grid gap-4 p-4">
      <p className="text-sm text-muted-foreground">When a job is completed, the exhibitor gets an email with the charge and a pay button that opens your own payment page (Stripe, Square, PayPal, etc.). The money goes straight to you.</p>
      <div className="grid gap-1.5">
        <Label htmlFor="pay-link">Your payment link</Label>
        <Input id="pay-link" placeholder="https://buy.stripe.com/…" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pay-notes">Payment instructions (optional)</Label>
        <Textarea id="pay-notes" placeholder="Enter the job number as the amount description. Card, ACH or check accepted." value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={600} />
      </div>
      <div><Button onClick={save} disabled={busy}>Save</Button></div>
    </Panel>
  );
}
