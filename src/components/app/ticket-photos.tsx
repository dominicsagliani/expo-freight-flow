import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ticketPhotosQuery } from "@/lib/queries";

export function TicketPhotos({ ticketId, canUpload }: { ticketId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const { data: photos = [] } = useQuery(ticketPhotosQuery(ticketId));
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("ticket-photos").upload(path, file, { contentType: file.type });
      if (up.error) { toast.error(up.error.message); continue; }
      const { error } = await supabase.from("ticket_photos").insert({ ticket_id: ticketId, storage_path: path, organization_id: "00000000-0000-0000-0000-000000000000" });
      if (error) toast.error(error.message);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    qc.invalidateQueries({ queryKey: ["ticket_photos", ticketId] });
    toast.success("Photo saved");
  };

  return (
    <div className="grid gap-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => p.url && (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md border border-border bg-muted">
              <img src={p.url} alt="Completion photo" className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {photos.length === 0 && !canUpload && <p className="text-sm text-muted-foreground">No photos yet.</p>}
      {canUpload && (
        <>
          <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button variant="outline" className="h-11" disabled={busy} onClick={() => input.current?.click()}>
            <Camera className="mr-2 size-4" /> {busy ? "Uploading…" : "Add photo"}
          </Button>
        </>
      )}
    </div>
  );
}
