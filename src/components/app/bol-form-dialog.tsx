import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Camera, FileText, LoaderCircle, Printer, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./event-form-dialog";
import { BOL_ACCEPT, MAX_BOL_CRATES, bolMimeType, resizeBolCrates, sanitizeBolFilename, validateBolFile, type BolCrateDraft } from "@/lib/bol";
import { prepareBolForAi } from "@/lib/bol-ai";
import { extractBolDocument } from "@/utils/bol-extraction.functions";

type Booth = { event_id: string; exhibitor_id: string; booth_number: string; exhibitor: { company_name: string } | null };

const emptyDetails = { carrier: "", pro: "", shipper: "", consignee: "", booth: "", description: "", totalWeight: "", special: "" };

export function BolFormDialog({
  events,
  booths,
  trigger,
}: {
  events: { id: string; name: string; organization_id: string }[];
  booths: Booth[];
  trigger: ReactNode;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const intakeKey = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState("");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [exhibitorId, setExhibitorId] = useState("");
  const [pieces, setPieces] = useState("1");
  const [details, setDetails] = useState(emptyDetails);
  const [crates, setCrates] = useState<BolCrateDraft[]>([{ description: "", weight: "" }]);
  const [aiStatus, setAiStatus] = useState("");
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const eventBooths = booths.filter((b) => b.event_id === eventId);
  const set = (key: keyof typeof details) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDetails((current) => ({ ...current, [key]: e.target.value }));

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const extraction = useMutation({
    mutationFn: async (selected: File) => {
      if (!eventId) throw new Error("Choose an event before AI extraction");
      setAiStatus("Preparing document pages…");
      const prepared = await prepareBolForAi(selected);
      setAiStatus("Reading BOL with AI…");
      const response = await extractBolDocument({ data: { eventId, pages: prepared.pages } });
      if (!response.ok) throw new Error(response.message);
      return { result: response.result, truncated: prepared.truncated };
    },
    onSuccess: ({ result, truncated }) => {
      const validExhibitor = eventBooths.some((booth) => booth.exhibitor_id === result.exhibitorId) ? result.exhibitorId : null;
      const reportedCount = result.declaredPieces;
      const count = reportedCount && Number.isInteger(reportedCount) && reportedCount >= 1 && reportedCount <= MAX_BOL_CRATES
        ? reportedCount
        : result.crates.length >= 1 && result.crates.length <= MAX_BOL_CRATES ? result.crates.length : Number(pieces);
      const totalWeight = result.totalWeightLbs !== null && Number.isFinite(result.totalWeightLbs) && result.totalWeightLbs >= 0 ? String(result.totalWeightLbs) : "";
      setExhibitorId(validExhibitor ?? "");
      setDetails({
        carrier: result.carrierName ?? "", pro: result.proNumber ?? "", shipper: result.shipperName ?? "",
        consignee: result.consigneeName ?? "", booth: result.boothNumber ?? "", description: result.description ?? "",
        totalWeight, special: result.specialInstructions ?? "",
      });
      setPieces(String(count));
      setCrates(resizeBolCrates([], count, result.description ?? "").map((row, index) => {
        const extracted = result.crates[index];
        const weight = extracted?.weightLbs;
        return {
          description: extracted?.description ?? row.description,
          weight: weight !== null && weight !== undefined && Number.isFinite(weight) && weight >= 0 ? String(weight) : "",
        };
      }));
      setAiNotes([...result.warnings, ...(truncated ? ["AI read the first 5 pages; review any remaining pages manually."] : [])]);
      setAiStatus("AI filled the fields below. Review everything before check-in.");
      toast.success("BOL read — review the extracted details");
    },
    onError: (error: Error) => {
      setAiStatus("AI could not finish reading this document. You can enter the details manually or try again.");
      setAiNotes([]);
      toast.error(error.message);
    },
  });

  function chooseFile(selected: File | null) {
    if (!selected) return;
    const problem = validateBolFile(selected);
    if (problem) {
      toast.error(problem);
      return;
    }
    intakeKey.current = crypto.randomUUID();
    setAiStatus("");
    setAiNotes([]);
    setFile(selected);
    extraction.mutate(selected);
  }

  function selectExhibitor(id: string) {
    setExhibitorId(id);
    const booth = eventBooths.find((b) => b.exhibitor_id === id);
    setDetails((current) => ({
      ...current,
      consignee: booth?.exhibitor?.company_name ?? "",
      booth: booth?.booth_number ?? "",
    }));
  }

  function changePieces(value: string) {
    setPieces(value);
    const count = Number(value);
    setCrates((current) => resizeBolCrates(current, count, details.description));
  }

  function distributeWeight() {
    const total = Number(details.totalWeight);
    const count = Number(pieces);
    if (!(total > 0) || !Number.isInteger(count) || count < 1) {
      toast.error("Enter a total weight before distributing it");
      return;
    }
    const each = (total / count).toFixed(2);
    setCrates((current) => current.map((crate) => ({ ...crate, weight: each })));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Upload or photograph the Bill of Lading");
      const problem = validateBolFile(file);
      if (problem) throw new Error(problem);
      if (!eventId || !exhibitorId) throw new Error("Choose an event and exhibitor");
      const count = Number(pieces);
      if (!Number.isInteger(count) || count < 1 || count > MAX_BOL_CRATES) throw new Error(`Enter between 1 and ${MAX_BOL_CRATES} crates`);
      if (crates.length !== count) throw new Error("Piece count must match the individual crate records");
      const totalWeight = details.totalWeight.trim() ? Number(details.totalWeight) : null;
      if (totalWeight !== null && (!(totalWeight >= 0) || !Number.isFinite(totalWeight))) throw new Error("Total weight must be zero or greater");
      for (const crate of crates) {
        const weight = crate.weight.trim() ? Number(crate.weight) : 0;
        if (!(weight >= 0) || !Number.isFinite(weight)) throw new Error("Crate weights must be zero or greater");
      }

      const key = intakeKey.current ?? crypto.randomUUID();
      intakeKey.current = key;
      const organizationId = events.find((event) => event.id === eventId)?.organization_id;
      if (!organizationId) throw new Error("Event not found");
      const path = `${organizationId}/${eventId}/${key}/${sanitizeBolFilename(file.name)}`;
      const mime = bolMimeType(file);

      setStage("Uploading BOL…");
      const uploaded = await supabase.storage.from("bol-documents").upload(path, file, { contentType: mime, upsert: false });
      if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw new Error(uploaded.error.message);

      setStage(`Saving ${count} ${count === 1 ? "crate" : "crates"}…`);
      const { data, error } = await supabase.rpc("receive_bill_of_lading", {
        _event: eventId,
        _exhibitor: exhibitorId,
        _storage_path: path,
        _filename: file.name,
        _mime: mime,
        _file_size: file.size,
        _carrier: details.carrier.trim(),
        _pro: details.pro.trim(),
        _shipper: details.shipper.trim(),
        _consignee: details.consignee.trim(),
        _booth: details.booth.trim(),
        _declared_pieces: count,
        _description: details.description.trim(),
        // The database accepts NULL for an unknown BOL weight; generated RPC types require number.
        _total_weight: totalWeight as number,
        _special: details.special.trim(),
        _crates: crates.map((crate) => ({ description: crate.description.trim(), weight_lbs: crate.weight.trim() })),
        _intake_key: key,
      });
      if (error) throw new Error(error.message);
      const result = data as { bol_id?: unknown } | null;
      if (typeof result?.bol_id !== "string") throw new Error("The BOL was saved without a shipment reference");
      return result.bol_id;
    },
    onSuccess: (bolId) => {
      const count = Number(pieces);
      toast.success(`BOL saved with ${count} unique ${count === 1 ? "crate" : "crates"}`);
      qc.invalidateQueries({ queryKey: ["freight"] });
      qc.invalidateQueries({ queryKey: ["bills_of_lading"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      setOpen(false);
      setFile(null);
      setDetails(emptyDetails);
      setPieces("1");
      setCrates([{ description: "", weight: "" }]);
      setAiStatus("");
      setAiNotes([]);
      intakeKey.current = null;
      navigate({ to: "/bol-labels/$bolId", params: { bolId }, search: { autoprint: 1 } });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setStage(""),
  });

  const mime = file ? bolMimeType(file) : "";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!save.isPending && !extraction.isPending) setOpen(next); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>BOL freight check-in</DialogTitle>
          <DialogDescription>Attach one Bill of Lading, verify its details, and create a unique QR label for every crate.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
          <section className="grid gap-3 rounded-lg border border-border bg-surface p-4">
            <div>
              <h3 className="text-sm font-semibold">Bill of Lading</h3>
              <p className="text-xs text-muted-foreground">PDF, JPG or PNG · 15 MB maximum · private to company staff</p>
            </div>
            <input ref={uploadInput} type="file" accept={BOL_ACCEPT} className="hidden" onChange={(e) => { chooseFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
            <input ref={cameraInput} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={(e) => { chooseFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={extraction.isPending || save.isPending} onClick={() => uploadInput.current?.click()}><Upload /> {file ? "Replace document" : "Upload BOL"}</Button>
              <Button type="button" variant="outline" disabled={extraction.isPending || save.isPending} onClick={() => cameraInput.current?.click()}><Camera /> Take photo</Button>
              {file && <Button type="button" variant="outline" disabled={extraction.isPending || save.isPending} onClick={() => extraction.mutate(file)}><Sparkles /> Read with AI</Button>}
              {file && <Button type="button" variant="ghost" disabled={extraction.isPending || save.isPending} onClick={() => { setFile(null); setAiStatus(""); setAiNotes([]); intakeKey.current = null; }}><Trash2 /> Remove</Button>}
            </div>
            {file ? (
              <div className="grid gap-3 rounded-md border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 shrink-0 text-status-progress" />
                  <span className="min-w-0 flex-1 break-words font-medium">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-status-progress">
                  {extraction.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
                  {extraction.isPending ? aiStatus : stage || aiStatus || "Ready — document uploads when you check in"}
                </div>
                {!!aiNotes.length && <ul className="grid gap-1 rounded-md border border-status-pending/30 bg-status-pending/5 p-3 text-xs text-muted-foreground">{aiNotes.map((note, index) => <li key={index}>Review: {note}</li>)}</ul>}
                {previewUrl && mime.startsWith("image/") && <img src={previewUrl} alt="Bill of Lading preview" className="max-h-72 w-full rounded border border-border object-contain" />}
                {previewUrl && mime === "application/pdf" && <object data={previewUrl} type="application/pdf" aria-label="Bill of Lading PDF preview" className="h-72 w-full rounded border border-border"><a href={previewUrl} target="_blank" rel="noreferrer">Preview PDF</a></object>}
              </div>
            ) : <p className="text-xs text-muted-foreground">No document selected. You can remove or replace it before check-in.</p>}
          </section>

          <section className="grid gap-4">
            <div>
              <h3 className="text-sm font-semibold">Shipment information</h3>
              <p className="text-xs text-muted-foreground">AI suggestions are editable and are not saved until you check in.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Event">
                <Select value={eventId} onValueChange={(value) => { setEventId(value); setExhibitorId(""); setDetails((current) => ({ ...current, consignee: "", booth: "" })); }}>
                  <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                  <SelectContent>{events.map((event) => <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Consignee / exhibitor">
                <Select value={exhibitorId} onValueChange={selectExhibitor}>
                  <SelectTrigger><SelectValue placeholder="Select exhibitor" /></SelectTrigger>
                  <SelectContent>{eventBooths.map((booth) => <SelectItem key={booth.exhibitor_id} value={booth.exhibitor_id}>{booth.exhibitor?.company_name} · Booth {booth.booth_number}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Carrier name"><Input value={details.carrier} onChange={set("carrier")} placeholder="e.g. YRC Freight" /></Field>
              <Field label="PRO / tracking number"><Input value={details.pro} onChange={set("pro")} placeholder="Optional" /></Field>
              <Field label="Shipper name"><Input value={details.shipper} onChange={set("shipper")} placeholder="Optional" /></Field>
              <Field label="Consignee name on BOL"><Input value={details.consignee} onChange={set("consignee")} placeholder="Optional" /></Field>
              <Field label="Booth number"><Input value={details.booth} onChange={set("booth")} placeholder="If available" /></Field>
              <Field label="Total weight (lb)"><Input type="number" min="0" step="0.01" value={details.totalWeight} onChange={set("totalWeight")} placeholder="If available" /></Field>
            </div>
            <Field label="Freight description"><Input value={details.description} onChange={set("description")} placeholder="e.g. Trade show display materials" /></Field>
            <Field label="Special handling instructions"><Textarea value={details.special} onChange={set("special")} placeholder="Optional — fragile, top load only, delivery notes…" /></Field>
          </section>

          <section className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Individual crates</h3>
                <p className="text-xs text-muted-foreground">Each row becomes one saved freight record with its own QR code.</p>
              </div>
              <Field label="Crates / pieces"><Input type="number" min="1" max={MAX_BOL_CRATES} value={pieces} onChange={(e) => changePieces(e.target.value)} className="w-28" /></Field>
            </div>
            <div className="grid gap-2">
              {crates.map((crate, index) => (
                <div key={index} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[3rem_1fr_9rem] sm:items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Crate {index + 1}</span>
                  <Input aria-label={`Crate ${index + 1} description`} value={crate.description} onChange={(e) => setCrates((current) => current.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} placeholder={details.description || "Received freight"} />
                  <div className="relative"><Input aria-label={`Crate ${index + 1} weight`} type="number" min="0" step="0.01" value={crate.weight} onChange={(e) => setCrates((current) => current.map((row, i) => i === index ? { ...row, weight: e.target.value } : row))} placeholder="Weight optional" className="pr-9" /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">lb</span></div>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={distributeWeight}>Distribute total weight evenly</Button>
          </section>

          <p className="text-xs text-muted-foreground">Check-in saves the original document and every crate before the print dialog opens. Canceling printing never deletes the shipment.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={save.isPending || extraction.isPending}>Cancel</Button>
            <Button type="submit" variant="teal" disabled={save.isPending || extraction.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" /> : <Printer />}
              {save.isPending ? stage || "Checking in…" : `Check in & print ${pieces || "0"} ${Number(pieces) === 1 ? "label" : "labels"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
