import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TicketStatus } from "@/lib/labels";

export function OperatorJobActions({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, event: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    window.__lovableEvents?.track?.(event, {});
    toast.success(ok);
    setConfirming(false);
    setNotes("");
    qc.invalidateQueries();
  };

  if (status === "assigned")
    return (
      <Button className="h-12 w-full" disabled={busy}
        onClick={() => run(() => supabase.rpc("operator_start_job", { _ticket: ticketId }), "Job started", "project.job_started")}>
        <Play className="mr-2 size-4" /> Start job
      </Button>
    );
  if (status === "in_progress")
    return confirming ? (
      <div className="grid gap-2">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Completion notes (optional)" />
        <div className="flex gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button className="h-12 flex-1" disabled={busy}
            onClick={() => run(() => supabase.rpc("operator_complete_job", { _ticket: ticketId, _notes: notes }), "Job completed", "project.job_completed")}>
            Confirm complete
          </Button>
        </div>
      </div>
    ) : (
      <Button className="h-12 w-full" onClick={() => setConfirming(true)}>
        <CheckCircle2 className="mr-2 size-4" /> Mark complete
      </Button>
    );
  return null;
}
