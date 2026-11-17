import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";

export const STAGING_AREAS = ["North Bone Yard", "South Bone Yard", "East Bone Yard", "West Bone Yard", "Marshalling Yard", "Dock Floor", "General Staging"];
const BUCKET = "freight-issue-photos";

export type StagingRow = { id: string; freight_id: string; area: string; location_note: string | null; landmark: string | null; photo_path: string | null; staged_by_name: string | null; staged_at: string };

export const latestStagingQuery = () => ({
  queryKey: ["freight-staging"],
  queryFn: async () => {
    const { data, error } = await supabase.from("freight_staging").select("id, freight_id, area, location_note, landmark, photo_path, staged_by_name, staged_at").order("staged_at", { ascending: false }).limit(2000);
    if (error) throw new Error(error.message);
    const latest = new Map<string, StagingRow>();
    for (const r of data ?? []) if (!latest.has(r.freight_id)) latest.set(r.freight_id, r);
    return latest;
  },
});

export function StageCrateDialog({ freightId, freightCode, orgId, trigger }: { freightId: string; freightCode: string; orgId: string; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState<string>(STAGING_AREAS[0] ?? "General Staging");
  const [note, setNote] = useState("");
  const [landmark, setLandmark] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      let photo_path: string | null = null;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Photo must be under 10 MB");
        photo_path = `${orgId}/staging/${freightId}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
        const up = await supabase.storage.from(BUCKET).upload(photo_path, file, { contentType: file.type });
        if (up.error) throw new Error(up.error.message);
      }
      const { error } = await supabase.from("freight_staging").insert({ freight_id: freightId, organization_id: orgId, area, location_note: note.trim() || null, landmark: landmark.trim() || null, photo_path });
      if (error) { if (photo_path) await supabase.storage.from(BUCKET).remove([photo_path]); throw new Error(error.message); }
    },
    onSuccess: () => {
      toast.success(`${freightCode} staged in ${area}`);
      setOpen(false); setNote(""); setLandmark(""); setFile(null);
      void qc.invalidateQueries({ queryKey: ["freight-staging"] });
      void qc.invalidateQueries({ queryKey: ["freight"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader><DialogTitle>Stage {freightCode}</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-1.5">
            <Label htmlFor="stg-area">Staging area</Label>
            <Input id="stg-area" list="stg-areas" value={area} onChange={(e) => setArea(e.target.value)} required />
            <datalist id="stg-areas">{STAGING_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="stg-note">Location note</Label><Input id="stg-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Second row, top of stack" /></div>
          <div className="grid gap-1.5"><Label htmlFor="stg-land">Nearby landmark</Label><Input id="stg-land" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Loading dock 3" /></div>
          <div className="grid gap-1.5"><Label htmlFor="stg-photo">Photo of crate or stack</Label><Input id="stg-photo" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <DialogFooter><Button type="submit" variant="teal" disabled={save.isPending || !area.trim()}><MapPin />{save.isPending ? "Saving…" : "Save location"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StagingSummary({ row }: { row?: StagingRow | undefined }) {
  const [busy, setBusy] = useState(false);
  if (!row) return null;
  const view = async () => {
    setBusy(true);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.photo_path!, 300);
    setBusy(false);
    if (error || !data) toast.error("Could not open photo"); else window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      Staged {fmtDateTime(row.staged_at)}{row.staged_by_name ? ` by ${row.staged_by_name}` : ""}
      {row.photo_path && <button type="button" onClick={view} disabled={busy} className="ml-1 inline-flex items-center gap-0.5 text-teal underline"><Camera className="size-3" />photo</button>}
    </div>
  );
}

export function useLatestStaging(enabled: boolean) {
  return useQuery({ ...latestStagingQuery(), enabled }).data ?? new Map<string, StagingRow>();
}
