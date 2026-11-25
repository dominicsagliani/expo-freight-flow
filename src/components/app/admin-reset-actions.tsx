import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DeleteEventButton({ eventId, name, compact = false, leavePage = false }: { eventId: string; name: string; compact?: boolean; leavePage?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [wipeExhibitors, setWipeExhibitors] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("delete_event_and_exhibitors", { _event: eventId, _delete_exhibitors: wipeExhibitors });
      if (error) throw error;
      return data ?? 0;
    },
    onSuccess: async (count) => {
      setOpen(false);
      toast.success(wipeExhibitors ? `Event deleted along with ${count} exhibitors` : "Event deleted");
      qc.removeQueries({ queryKey: ["events", eventId], exact: true });
      if (leavePage) await navigate({ to: "/events" });
      await qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!remove.isPending) { setOpen(value); setConfirmation(""); setWipeExhibitors(false); } }}>
      <DialogTrigger asChild>
        <Button variant={compact ? "ghost" : "destructive"} size={compact ? "icon" : "default"} aria-label={`Delete event ${name}`} title={`Delete event ${name}`}>
          <Trash2 />{!compact && "Delete event"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>This permanently deletes the event and its tickets, freight, photos records, event rates, and billing history. Company exhibitors, operators, machines, and subscriptions remain. Active work must finish or be reset first. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={wipeExhibitors} onChange={(e) => setWipeExhibitors(e.target.checked)} disabled={remove.isPending} />
          <span><span className="font-medium">Also delete this event's exhibitors</span><br /><span className="text-muted-foreground">Removes their company, contact info, and logins so you can import fresh. Exhibitors who are also in another event are kept.</span></span>
        </label>
        <label className="grid gap-2 text-sm">Type DELETE to confirm
          <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" disabled={remove.isPending} />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={remove.isPending}>Cancel</Button>
          <Button variant="destructive" disabled={confirmation !== "DELETE" || remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? "Deleting…" : "Permanently delete event"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResetDriversButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const reset = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reset_org_drivers", { _org: organizationId });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      setOpen(false);
      toast.success(`${count} drivers are now available`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!reset.isPending) setOpen(value); }}>
      <DialogTrigger asChild><Button variant="outline"><RotateCcw /> Reset all drivers</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset all drivers?</DialogTitle>
          <DialogDescription>Cancel every unfinished ticket across your company’s events, stop active timers, release machines, and mark all drivers available. Completed jobs and charges stay unchanged. Cancelled work is not added to customer bills; scanned freight stays recorded and needs dispatcher review. Drivers must sign back in and select a machine before receiving new jobs.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={reset.isPending}>Keep current jobs</Button>
          <Button variant="destructive" onClick={() => reset.mutate()} disabled={reset.isPending}>{reset.isPending ? "Resetting…" : "Cancel unfinished jobs & reset"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}