import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_STATUS_LABEL, type EventStatus } from "@/lib/labels";

const schema = z
  .object({
    name: z.string().trim().min(2, "Event name is required").max(160),
    venue: z.string().trim().min(2, "Venue is required").max(160),
    city: z.string().trim().max(120).optional(),
    address: z.string().trim().max(240).optional(),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    move_in_date: z.string().optional(),
    move_out_date: z.string().optional(),
    status: z.enum(["planning", "move_in", "live", "move_out", "closed"]),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "End date must be on or after start date", path: ["end_date"] });

export function EventFormDialog({
  organizationId,
  event,
  trigger,
}: {
  organizationId: string;
  event?: Tables<"events">;
  trigger: ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: event?.name ?? "",
    venue: event?.venue ?? "",
    city: event?.city ?? "",
    address: event?.address ?? "",
    start_date: event?.start_date ?? "",
    end_date: event?.end_date ?? "",
    move_in_date: event?.move_in_date ?? "",
    move_out_date: event?.move_out_date ?? "",
    status: (event?.status ?? "planning") as EventStatus,
    notes: event?.notes ?? "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the form");
      const v = parsed.data;
      const row = {
        ...v,
        city: v.city || null,
        address: v.address || null,
        move_in_date: v.move_in_date || null,
        move_out_date: v.move_out_date || null,
        notes: v.notes || null,
      };
      if (event) {
        const { error } = await supabase.from("events").update(row).eq("id", event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert({ ...row, organization_id: organizationId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(event ? "Event updated" : "Event created");
      qc.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Event name">
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Venue">
              <Input value={form.venue} onChange={(e) => set("venue")(e.target.value)} required />
            </Field>
            <Field label="City / location">
              <Input value={form.city} onChange={(e) => set("city")(e.target.value)} />
            </Field>
          </div>
          <Field label="Venue address">
            <Input value={form.address} onChange={(e) => set("address")(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Move-in begins">
              <Input type="date" value={form.move_in_date} onChange={(e) => set("move_in_date")(e.target.value)} />
            </Field>
            <Field label="Move-out ends">
              <Input type="date" value={form.move_out_date} onChange={(e) => set("move_out_date")(e.target.value)} />
            </Field>
            <Field label="Show opens">
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date")(e.target.value)} required />
            </Field>
            <Field label="Show closes">
              <Input type="date" value={form.end_date} onChange={(e) => set("end_date")(e.target.value)} required />
            </Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Operational notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : event ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
