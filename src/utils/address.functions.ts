import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function creds() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Address lookup is not configured");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": maps };
}

async function fail(res: Response): Promise<never> {
  const body = await res.text();
  console.error(`Places request failed [${res.status}]: ${body}`);
  throw new Error(res.status === 403 ? "Address lookup was denied by Google" : "Address lookup failed");
}

export type AddressSuggestion = { placeId: string; text: string };
export type AddressDetails = { name: string; street: string; city: string; formatted: string };

export const suggestAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ input: z.string().trim().min(3).max(200), sessionToken: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<AddressSuggestion[]> => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        ...creds(),
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({ input: data.input, sessionToken: data.sessionToken, includedRegionCodes: ["us", "ca"] }),
    });
    if (!res.ok) await fail(res);
    const json = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId: string; text?: { text: string } } }[];
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is { placeId: string; text: { text: string } } => !!p?.placeId && !!p.text?.text)
      .slice(0, 6)
      .map((p) => ({ placeId: p.placeId, text: p.text.text }));
  });

export const getAddressDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ placeId: z.string().regex(/^[A-Za-z0-9_=-]{5,500}$/), sessionToken: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<AddressDetails> => {
    const res = await fetch(
      `${GATEWAY_URL}/places/v1/places/${data.placeId}?sessionToken=${encodeURIComponent(data.sessionToken)}`,
      { headers: { ...creds(), "X-Goog-FieldMask": "displayName,formattedAddress,addressComponents" } },
    );
    if (!res.ok) await fail(res);
    const p = (await res.json()) as {
      displayName?: { text?: string };
      formattedAddress?: string;
      addressComponents?: { longText: string; shortText: string; types: string[] }[];
    };
    const c = (t: string, short = false) => {
      const x = p.addressComponents?.find((a) => a.types.includes(t));
      return x ? (short ? x.shortText : x.longText) : "";
    };
    const street = [c("street_number"), c("route")].filter(Boolean).join(" ");
    const locality = c("locality") || c("postal_town") || c("sublocality");
    const city = [locality, [c("administrative_area_level_1", true), c("postal_code")].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    return {
      name: p.displayName?.text ?? "",
      street: street || p.formattedAddress?.split(",")[0] || "",
      city,
      formatted: p.formattedAddress ?? "",
    };
  });
