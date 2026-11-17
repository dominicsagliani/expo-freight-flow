import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/app/page-header";
import { fmtAgo } from "@/lib/format";

export const FREIGHT_ISSUE_LABEL: Record<string, string> = {
  damaged: "Damaged",
  wet: "Wet / water damage",
  missing_pieces: "Missing pieces",
  wrong_booth: "Wrong booth / label",
  other: "Other",
};

type FreightOpt = { id: string; freight_code: string; description: string; exhibitor?: { company_name: string } | null };

export function ReportFreightIssueDialog({ freight, orgId, trigger }: { freight: FreightOpt[]; orgId: string; trigger: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [freightId, setFreightId] = useState("");
  const [kind, setKind] = useState("damaged");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!freightId) { toast.error("Choose the crate"); return; }
    setBusy(true);
    try {
      let photo_path: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        photo_path = `${orgId}/${freightId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("freight-issue-photos").upload(photo_path, file, { contentType: file.type });
        if (up.error) throw new Error(up.error.message);
      }
      const { error } = await supabase.from("freight_issues").insert({ freight_id: freightId, kind, note: note.trim() || null, photo_path, organization_id: orgId });
      if (error) throw new Error(error.message);
      toast.success("Issue reported");
      qc.invalidateQueries({ queryKey: ["freight-issues"] });
      setOpen(false); setFreightId(""); setNote(""); setFile(null); setKind("damaged");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Report freight issue</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fi-freight">Crate</Label>
            <select id="fi-freight" className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={freightId} onChange={(e) => setFreightId(e.target.value)}>
              <option value="">Choose…</option>
              {freight.map((f) => <option key={f.id} value={f.id}>{f.freight_code} · {f.exhibitor?.company_name} · {f.description}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-kind">Problem</Label>
            <select id="fi-kind" className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(FREIGHT_ISSUE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-note">Notes</Label>
            <Textarea id="fi-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What do you see?" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-photo">Photo (optional)</Label>
            <input id="fi-photo" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          <Button variant="teal" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Report issue"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OpenFreightIssues({ canResolve }: { canResolve: boolean }) {
  const qc = useQueryClient();
  const { data: issues = [] } = useQuery({
    queryKey: ["freight-issues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freight_issues")
        .select("id, kind, note, photo_path, created_at, freight:freight_items(freight_code, booth_number, exhibitor:exhibitors(company_name))")
        .is("resolved_at", null).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const viewPhoto = async (path: string) => {
    const { data, error } = await supabase.storage.from("freight-issue-photos").createSignedUrl(path, 300);
    if (error) toast.error(error.message); else window.open(data.signedUrl, "_blank", "noopener");
  };
  const resolve = async (id: string) => {
    const { error } = await supabase.from("freight_issues").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Issue resolved"); qc.invalidateQueries({ queryKey: ["freight-issues"] }); }
  };
  if (issues.length === 0) return null;
  return (
    <Panel title={`Open freight issues (${issues.length})`}>
      <ul className="divide-y divide-border">
        {issues.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
            <span className="font-semibold text-destructive">{FREIGHT_ISSUE_LABEL[i.kind] ?? i.kind}</span>
            <span className="font-mono text-xs">{i.freight?.freight_code}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {i.freight?.exhibitor?.company_name} · Booth {i.freight?.booth_number ?? "—"} · {fmtAgo(i.created_at)}{i.note ? ` · ${i.note}` : ""}
            </span>
            {i.photo_path && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => viewPhoto(i.photo_path!)}>Photo</Button>}
            {canResolve && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(i.id)}>Resolve</Button>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
