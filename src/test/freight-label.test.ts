import { describe, expect, it } from "vitest";
import { labelFields, qrPayload } from "@/lib/freight-label";

describe("freight QR labels", () => {
  it("QR payload carries only the random token, no exhibitor info", () => {
    expect(qrPayload("https://app.example", "abc123")).toBe("https://app.example/scan/abc123");
  });
  it("label fields exclude exhibitor name and contacts", () => {
    const f = { freight_code: "FRT-1", booth_number: "842", pieces: 2, freight_type: "crate",
      company_name: "Secret Co", contact_email: "a@b.c" } as never;
    expect(Object.keys(labelFields(f)).sort()).toEqual(["booth", "code", "pieces", "type"]);
  });
});
