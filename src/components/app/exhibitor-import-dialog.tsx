import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./event-form-dialog";
import { parseExhibitorCsv, SAMPLE_EXHIBITOR_CSV, type ExhibitorCsvRow } from "@/lib/exhibitor-csv";

type Existing = { id: string; company_name: string; event_exhibitors: { event_id: string; booth_number: string }[] };

export function ExhibitorImportDialog({
  organizationId,
  events,
  existing,
  trigger,
}: {
  organizationId: string;
  events: { id: string; name: string }[];
  existing: Existing[];
  trigger: ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [rows, setRows] = useState<ExhibitorCsvRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const byName = new Map(existing.map((x) => [x.company_name.trim().toLowerCase(), x]));
  const valid = rows.filter((r) => r.errors.length === 0);
  const status = (r: ExhibitorCsvRow) => {
    if (r.errors.length) return r.errors.join(", ");
    const ex = byName.get(r.company_name.toLowerCase());
    if (!ex) return "New";
    return ex.event_exhibitors.some((b) => b.event_id === eventId) ? "Already at this event — skipped" : "Existing company — add booth";
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE_EXHIBITOR_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "expohaul-exhibitors-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    const res = parseExhibitorCsv(await f.text());
    setFileError(res.error ?? null);
    setRows(res.rows);
  };

  const run = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Choose an event");
      let created = 0, booths = 0, skipped = 0;
      const failed: string[] = [];
      for (const r of valid) {
        try {
          let ex = byName.get(r.company_name.toLowerCase());
          if (ex?.event_exhibitors.some((b) => b.event_id === eventId)) { skipped++; continue; }
          let id = ex?.id;
          if (!id) {
            const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
            const { data, error } = await supabase
              .from("exhibitors")
              .insert({
                organization_id: organizationId,
                company_name: r.company_name,
                first_name: r.first_name || null,
                last_name: r.last_name || null,
                contact_name: name || null,
                contact_email: r.contact_email || null,
                contact_phone: r.contact_phone || null,
                billing_address: r.billing_address || null,
              })
              .select("id")
              .single();
            if (error) throw error;
            id = data.id;
            created++;
          }
          const { error: e2 } = await supabase.from("event_exhibitors").insert({
            organization_id: organizationId,
            event_id: eventId,
            exhibitor_id: id,
            booth_number: r.booth_number,
          });
          if (e2) throw e2;
          booths++;
          ex = { id, company_name: r.company_name, event_exhibitors: [...(ex?.event_exhibitors ?? []), { event_id: eventId, booth_number: r.booth_number }] };
          byName.set(r.company_name.toLowerCase(), ex);
        } catch (e) {
          failed.push(`Row ${r.line}: ${(e as Error).message}`);
        }
      }
      return { created, booths, skipped, failed };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["exhibitors"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event_exhibitors"] });
      const msg = `${r.created} new exhibitors, ${r.booths} booths assigned${r.skipped ? `, ${r.skipped} skipped` : ""}`;
      if (r.failed.length) toast.error(`${msg}. ${r.failed.length} failed — ${r.failed[0]}`);
      else { toast.success(msg); setOpen(false); setRows([]); setFileName(""); }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import exhibitors from CSV</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Columns: Company Name, Booth Number (required), First Name, Last Name, Contact Email, Contact Phone, Billing
            Address. Companies already in your list are matched by name, so no duplicates are created.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event">
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue placeholder="Choose event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="CSV file">
              <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
            </Field>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={downloadSample}>
            <Download /> Download sample CSV
          </Button>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {rows.length > 0 && (
            <div className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                {fileName}: {valid.length} ready · {rows.length - valid.length} with problems
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface text-left">
                    <tr>
                      <th className="px-2 py-1.5">Row</th>
                      <th className="px-2 py-1.5">Company</th>
                      <th className="px-2 py-1.5">Booth</th>
                      <th className="px-2 py-1.5">Contact</th>
                      <th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.line} className={r.errors.length ? "text-destructive" : ""}>
                        <td className="px-2 py-1.5 tabular-nums">{r.line}</td>
                        <td className="px-2 py-1.5">{r.company_name || "—"}</td>
                        <td className="px-2 py-1.5 font-mono">{r.booth_number || "—"}</td>
                        <td className="px-2 py-1.5">{[r.first_name, r.last_name].filter(Boolean).join(" ") || r.contact_email || "—"}</td>
                        <td className="px-2 py-1.5">{status(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!eventId || valid.length === 0 || run.isPending} onClick={() => run.mutate()}>
            <Upload /> {run.isPending ? "Importing…" : `Import ${valid.length} exhibitors`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
