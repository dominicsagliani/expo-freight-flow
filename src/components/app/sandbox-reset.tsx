import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, PackageOpen, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ResetMode = "quick" | "deep";
type ResetResult = { cancelled_jobs: number; stopped_sessions: number; reset_freight: number };

export function SandboxReset({ eventId, eventName, defaultMode = "quick" }: { eventId: string; eventName: string; defaultMode?: ResetMode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ResetMode>(defaultMode);
  const [confirmation, setConfirmation] = useState("");
  const qc = useQueryClient();
  const deep = mode === "deep";

  const reset = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("sandbox_reset_event", { _event: eventId, _deep: deep });
      if (error) throw error;
      return data as unknown as ResetResult;
    },
    onSuccess: async (result) => {
      setOpen(false);
      setConfirmation("");
      toast.success(
        deep
          ? `${result.cancelled_jobs} open jobs cleared; ${result.reset_freight} crates are ready to scan again`
          : `${result.cancelled_jobs} open jobs cleared; drivers and forklifts released`,
      );
      await qc.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeOpen = (value: boolean) => {
    if (reset.isPending) return;
    setOpen(value);
    if (!value) {
      setMode(defaultMode);
      setConfirmation("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><FlaskConical />{defaultMode === "deep" ? "Reset test data" : "Sandbox"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sandbox reset</DialogTitle>
          <DialogDescription>Clear test work at {eventName}. Completed jobs and customer charges always stay unchanged.</DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(value) => { setMode(value as ResetMode); setConfirmation(""); }} className="gap-3">
          <Label htmlFor="sandbox-quick" className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 has-checked:border-teal has-checked:bg-teal/5">
            <RadioGroupItem id="sandbox-quick" value="quick" className="mt-0.5" />
            <span className="grid gap-1">
              <span className="flex items-center gap-2 font-semibold"><RotateCcw className="size-4 text-teal" />Quick Clear</span>
              <span className="text-sm font-normal text-muted-foreground">Cancel open jobs, stop their timers, and release every driver and forklift at this show. Crates stay in their current state.</span>
            </span>
          </Label>
          <Label htmlFor="sandbox-deep" className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 has-checked:border-teal has-checked:bg-teal/5">
            <RadioGroupItem id="sandbox-deep" value="deep" className="mt-0.5" />
            <span className="grid gap-1">
              <span className="flex items-center gap-2 font-semibold"><PackageOpen className="size-4 text-teal" />Deep Reset</span>
              <span className="text-sm font-normal text-muted-foreground">Everything in Quick Clear, plus return every crate at this show to received or its staged location. Reuse the same printed QR labels without creating duplicate crates.</span>
            </span>
          </Label>
        </RadioGroup>

        {deep && (
          <div className="grid gap-3 rounded-md border border-status-requested/40 bg-status-requested/10 p-4">
            <p className="text-sm">Delivery history on completed jobs remains, but all crates at this show become available for another test run.</p>
            <Label htmlFor="sandbox-confirmation" className="grid gap-2 text-sm font-semibold">Type RESET to confirm
              <Input id="sandbox-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={reset.isPending} />
            </Label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => changeOpen(false)} disabled={reset.isPending}>Keep testing as-is</Button>
          <Button variant={deep ? "destructive" : "teal"} onClick={() => reset.mutate()} disabled={reset.isPending || (deep && confirmation !== "RESET")}>
            {reset.isPending ? "Resetting…" : deep ? "Deep reset show" : "Clear open jobs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
