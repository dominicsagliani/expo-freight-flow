import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./event-form-dialog";
import { AddressAutocomplete } from "./address-autocomplete";

const schema = z.object({
  company_name: z.string().trim().min(2, "Company name is required").max(160),
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
  contact_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
  contact_phone: z.string().trim().max(40).optional(),
  billing_address: z.string().trim().max(240).optional(),
});

export function ExhibitorFormDialog({
  organizationId,
  exhibitor,
  events,
  trigger,
}: {
  organizationId: string;
  exhibitor?: Tables<"exhibitors">;
  events: { id: string; name: string }[];
  trigger: ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: exhibitor?.company_name ?? "",
    first_name: exhibitor?.first_name ?? "",
    last_name: exhibitor?.last_name ?? "",
    contact_email: exhibitor?.contact_email ?? "",
    contact_phone: exhibitor?.contact_phone ?? "",
    billing_address: exhibitor?.billing_address ?? "",
  });
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [booth, setBooth] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the form");
      const v = parsed.data;
      const fullName = [v.first_name, v.last_name].filter(Boolean).join(" ");
      const row = {
        company_name: v.company_name,
        first_name: v.first_name || null,
        last_name: v.last_name || null,
        contact_name: fullName || null,
        contact_email: v.contact_email || null,
        contact_phone: v.contact_phone || null,
        billing_address: v.billing_address || null,
      };
      if (exhibitor) {
        const { error } = await supabase.from("exhibitors").update(row).eq("id", exhibitor.id);
        if (error) throw error;
        return;
      }
      if (eventId && !booth.trim()) throw new Error("Enter a booth number for the selected event");
      const { data, error } = await supabase
        .from("exhibitors")
        .insert({ ...row, organization_id: organizationId })
        .select("id")
        .single();
      if (error) throw error;
      if (eventId) {
        const { error: e2 } = await supabase.from("event_exhibitors").insert({
          event_id: eventId,
          exhibitor_id: data.id,
          booth_number: booth.trim(),
          organization_id: organizationId,
        });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(exhibitor ? "Exhibitor updated" : "Exhibitor created");
      qc.invalidateQueries({ queryKey: ["exhibitors"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event_exhibitors"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{exhibitor ? "Edit exhibitor" : "New exhibitor"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Company name">
            <Input value={form.company_name} onChange={set("company_name")} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <Input value={form.first_name} onChange={set("first_name")} />
            </Field>
            <Field label="Last name">
              <Input value={form.last_name} onChange={set("last_name")} />
            </Field>
          </div>
          <Field label="Phone">
            <Input value={form.contact_phone} onChange={set("contact_phone")} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.contact_email} onChange={set("contact_email")} />
          </Field>
          <Field label="Billing address">
            <AddressAutocomplete
              value={form.billing_address}
              onChange={(v) => setForm((f) => ({ ...f, billing_address: v }))}
              placeholder="Start typing an address"
              onSelect={(d) => setForm((f) => ({ ...f, billing_address: d.formatted }))}
            />
          </Field>
          {!exhibitor && (
            <div className="grid gap-4 rounded-md border border-border bg-surface p-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Event association">
                <Select value={eventId || "none"} onValueChange={(v) => setEventId(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No event yet</SelectItem>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Booth number">
                <Input className="bg-card" value={booth} onChange={(e) => setBooth(e.target.value)} disabled={!eventId} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : exhibitor ? "Save changes" : "Create exhibitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
