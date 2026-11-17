import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseScanToken } from "@/lib/scan-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/app/qr-scanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type QueueScanResult = {
  ok: true;
  created: boolean;
  ticket_id: string;
  ticket_number: string;
  status: string;
  freight_id: string;
  freight_code: string;
  description: string;
  exhibitor: string;
  booth: string | null;
  assigned: boolean;
  operator_id: string | null;
  operator_name: string | null;
  equipment_id: string | null;
  equipment_unit: string | null;
};

export function FreightQueueScanner({
  open,
  onOpenChange,
  onQueued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQueued?: (result: QueueScanResult) => void;
}) {
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueueScanResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setManual("");
    setError(null);
    setResult(null);
    setBusy(false);
  }, [open]);

  const submit = async (raw: string) => {
    if (busy) return;
    const token = parseScanToken(raw);
    if (!token) {
      setError("That code isn't an ExpoHaul freight label.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("scan_freight_to_queue", { _token: token });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const queued = data as unknown as QueueScanResult;
    setResult(queued);
    onQueued?.(queued);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan freight to queue</DialogTitle>
          <DialogDescription>
            The delivery job goes automatically to the next available compatible forklift.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-lg border border-border">
              {open && <QrScanner onResult={(value) => void submit(value)} />}
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(manual);
              }}
            >
              <Input
                aria-label="Freight label code"
                value={manual}
                onChange={(event) => setManual(event.target.value)}
                placeholder="Hardware scanner or label code"
                disabled={busy}
                autoFocus
              />
              <Button type="submit" disabled={busy || !manual.trim()}>
                <ScanLine />{busy ? "Queueing…" : "Queue"}
              </Button>
            </form>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid justify-items-center gap-2 rounded-lg bg-status-completed/10 p-5 text-center">
              {result.assigned ? <CheckCircle2 className="size-12 text-status-completed" /> : <Clock3 className="size-12 text-status-requested" />}
              <div className="text-xl font-bold">
                {result.assigned ? `Sent to ${result.operator_name} · ${result.equipment_unit}` : "Waiting for the next available forklift"}
              </div>
              <div className="text-sm text-muted-foreground">
                {result.created ? "Delivery job created" : "Already on an open delivery job"} · {result.ticket_number}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4 text-sm">
              <div className="font-mono font-semibold">{result.freight_code}</div>
              <div className="mt-1 font-medium">{result.exhibitor} · Booth {result.booth ?? "—"}</div>
              <div className="mt-1 text-muted-foreground">{result.description}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { setResult(null); setManual(""); setError(null); }}>Scan another</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
