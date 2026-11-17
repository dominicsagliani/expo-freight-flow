import { APICallError, NoObjectGeneratedError, Output, type ModelMessage } from "ai";
import { z } from "zod";
import type { BolAiPage, BolExtractionResponse } from "@/lib/bol-ai";
import { createResponsesCall } from "./responses.ts";

const nullableText = z.string().nullable();
const extractionSchema = z.object({
  exhibitor_id: nullableText,
  carrier_name: nullableText,
  pro_number: nullableText,
  shipper_name: nullableText,
  consignee_name: nullableText,
  booth_number: nullableText,
  declared_pieces: z.number().int().nullable(),
  description: nullableText,
  total_weight_lbs: z.number().nullable(),
  special_instructions: nullableText,
  crates: z.array(z.object({ description: nullableText, weight_lbs: z.number().nullable() }).strict()),
  warnings: z.array(z.string()),
}).strict();

const instructions = `You read Bills of Lading for trade-show dock receiving. Extract only facts visible in the supplied page images. Never guess or invent missing values; use null for unknown text and numbers. Return an empty crates array unless individual piece/crate descriptions or weights are explicitly shown. Do not divide a total weight across pieces. Convert weights to pounds only when the source unit is clear, and add a warning when conversion was needed. declared_pieces is the total number of handling pieces/crates, not the number of line items. exhibitor_id must be an exact ID from the supplied registered-exhibitor list when the consignee and event booth clearly match; otherwise null. Keep printed punctuation in PRO numbers and handling instructions. Add brief warnings for illegible or conflicting information.`;

function gatewayMessage(error: APICallError) {
  try {
    const body = JSON.parse(error.responseBody ?? "{}") as { message?: unknown; error?: { message?: unknown } };
    const message = typeof body.message === "string" ? body.message : typeof body.error?.message === "string" ? body.error.message : null;
    if (message) return message.slice(0, 600);
  } catch { /* Use the SDK's safe message below. */ }
  return error.message.slice(0, 600);
}

export async function extractBolWithAi({ apiKey, pages, exhibitors }: {
  apiKey: string;
  pages: BolAiPage[];
  exhibitors: { id: string; company_name: string; booth_number: string }[];
}): Promise<BolExtractionResponse> {
  const prompt = `Read this Bill of Lading and extract its receiving details. Registered exhibitors for this event: ${JSON.stringify(exhibitors)}. Return structured data only and leave anything unreadable null.`;
  const messages: ModelMessage[] = [{
    role: "user",
    content: [
      { type: "text", text: prompt },
      ...pages.map((page) => ({ type: "image" as const, image: new URL(`data:${page.mediaType};base64,${page.data}`) })),
    ],
  }];

  try {
    const { result } = createResponsesCall(
      { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
      messages,
      instructions,
      Output.object({ schema: extractionSchema }),
    );
    const extracted = await result.output as z.infer<typeof extractionSchema>;
    return { ok: true, result: {
      exhibitorId: extracted.exhibitor_id,
      carrierName: extracted.carrier_name,
      proNumber: extracted.pro_number,
      shipperName: extracted.shipper_name,
      consigneeName: extracted.consignee_name,
      boothNumber: extracted.booth_number,
      declaredPieces: extracted.declared_pieces,
      description: extracted.description,
      totalWeightLbs: extracted.total_weight_lbs,
      specialInstructions: extracted.special_instructions,
      crates: extracted.crates.map((crate) => ({ description: crate.description, weightLbs: crate.weight_lbs })),
      warnings: extracted.warnings,
    } };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { ok: false, status: 422, message: "AI could not read this document confidently. Try a clearer photo or enter the details manually." };
    }
    if (APICallError.isInstance(error)) {
      return { ok: false, status: error.statusCode ?? 500, message: gatewayMessage(error) };
    }
    throw error;
  }
}
