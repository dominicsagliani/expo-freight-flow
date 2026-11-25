import { supabase } from "@/integrations/supabase/client";
import { bolMimeType, sanitizeBolFilename, validateBolFile } from "@/lib/bol";

export async function uploadInboundDocument(file: File | null, org: string, event: string, shipment: string, key: string) {
  if (!file) return { path: "", filename: "" };
  const problem = validateBolFile(file);
  if (problem) throw new Error(problem);
  const path = `${org}/${event}/${shipment}/${key}/${sanitizeBolFilename(file.name)}`;
  const { error } = await supabase.storage.from("bol-documents").upload(path, file, { contentType: bolMimeType(file) });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
  return { path, filename: file.name };
}