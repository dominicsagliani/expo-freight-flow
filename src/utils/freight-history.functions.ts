import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FreightFile, FreightHistory } from "@/lib/freight-history";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns an authorized crate timeline and short-lived URLs for only its approved private files. */
export const getFreightHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { freightId: string }) => {
    if (!UUID.test(input.freightId)) throw new Error("Invalid freight ID");
    return { freightId: input.freightId };
  })
  .handler(async ({ data, context }): Promise<FreightHistory> => {
    const { data: result, error } = await context.supabase.rpc("freight_chain_of_custody", { _freight: data.freightId });
    if (error) throw new Error(error.message);
    const history = result as unknown as FreightHistory;
    if (!history?.freight || !Array.isArray(history.events)) throw new Error("Crate history is unavailable");

    const document = history.freight.bol?.document ?? null;
    const files: FreightFile[] = [...history.events.flatMap((event) => event.photos), ...(document ? [document] : [])];
    const byBucket = new Map<string, string[]>();
    for (const file of files) {
      byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.path]);
    }

    // The RPC above is the authorization boundary. Signing happens only after it
    // returns this exact crate's approved paths; no client-supplied path is signed.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const urls = new Map<string, string>();
    await Promise.all([...byBucket.entries()].map(async ([bucket, paths]) => {
      const uniquePaths = [...new Set(paths)];
      const { data: signed, error: signError } = await supabaseAdmin.storage.from(bucket).createSignedUrls(uniquePaths, 300);
      if (signError) return;
      for (const file of signed ?? []) {
        if (file.signedUrl) urls.set(`${bucket}/${file.path}`, file.signedUrl);
      }
    }));
    const withUrl = <T extends FreightFile>(file: T): T => ({ ...file, url: urls.get(`${file.bucket}/${file.path}`) ?? null });

    return {
      freight: {
        ...history.freight,
        bol: history.freight.bol ? {
          ...history.freight.bol,
          document: history.freight.bol.document ? withUrl(history.freight.bol.document) : null,
        } : null,
      },
      events: history.events.map((event) => ({ ...event, photos: event.photos.map(withUrl) })),
    };
  });
