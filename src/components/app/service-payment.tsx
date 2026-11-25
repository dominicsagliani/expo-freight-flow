import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sendServiceInvoice, INVOICE_REASON } from "@/utils/service-invoice.functions";
import { fmtDateTime } from "@/lib/format";

export function notifyInvoiceOutcome(r: { sent: boolean; to?: string; reason?: string } | null) {
  if (!r) return;
  if (r.sent) toast.success(`Invoice emailed to ${r.to}`);
  else if (r.reason !== "already_sent" && r.reason !== "already_paid") toast.message(`Invoice pending: ${INVOICE_REASON[r.reason ?? ""] ?? r.reason}`);
}

/** Fire-and-forget receipt after a job completes; silent unless it fails for a fixable reason. */
export function useAutoInvoice() {
  const send = useServerFn(sendServiceInvoice);
  return (ticketId: string) => {
    send({ data: { ticketId } })
      .then((r) => {
        if (r.sent) toast.success(`Invoice emailed to ${r.to}`);
        else if (r.reason !== "already_sent" && r.reason !== "already_paid") toast.message(`Receipt not sent: ${INVOICE_REASON[r.reason] ?? r.reason}`);
      })
      .catch(() => toast.error("Couldn't email the receipt — send it from the job page"));
  };
}

type T = { id: string; status: string; invoice_sent_at: string | null; paid_at: string | null };

export function ServicePayment({ t, canManage }: { t: T; canManage: boolean }) {
  const send = useServerFn(sendServiceInvoice);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (t.status !== "completed") return <p className="text-sm text-muted-foreground">The exhibitor receives a service invoice when this job is completed.</p>;
  const refresh = () => qc.invalidateQueries({ queryKey: ["tickets"] });
  const resend = async () => {
    setBusy(true);
    try {
      const r = await send({ data: { ticketId: t.id, resend: true } });
      if (r.sent) toast.success(`Invoice emailed to ${r.to}`); else toast.error(INVOICE_REASON[r.reason] ?? r.reason);
      refresh();
    } catch { toast.error("Couldn't send the receipt"); } finally { setBusy(false); }
  };
  const mark = async (paid: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("mark_ticket_paid", { _ticket: t.id, _paid: paid });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(paid ? "Marked paid" : "Marked unpaid"); refresh();
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {t.paid_at
          ? <span className="inline-flex items-center gap-1 rounded bg-status-completed px-2 py-0.5 font-semibold text-primary-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Paid {fmtDateTime(t.paid_at)}</span>
          : <span className="rounded bg-status-requested px-2 py-0.5 font-semibold text-primary-foreground">Unpaid</span>}
        <span className="text-muted-foreground">{t.invoice_sent_at ? `Invoice emailed ${fmtDateTime(t.invoice_sent_at)}` : "Invoice not emailed yet"}</span>
      </div>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {!t.paid_at && <Button size="sm" variant="outline" disabled={busy} onClick={resend}><Mail className="mr-1 h-4 w-4" />{t.invoice_sent_at ? "Resend invoice" : "Email invoice"}</Button>}
          <Button size="sm" variant={t.paid_at ? "ghost" : "default"} disabled={busy} onClick={() => mark(!t.paid_at)}>{t.paid_at ? "Mark unpaid" : "Mark paid"}</Button>
        </div>
      )}
    </div>
  );
}
