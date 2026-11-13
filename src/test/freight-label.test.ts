import { describe, expect, it } from "vitest";
import { labelFields, qrPayload } from "@/lib/freight-label";

const freight = {
  freight_code: "FRT-1",
  booth_number: "842",
  pieces: 2,
  freight_type: "crate",
  event: { name: "Midwest Manufacturing Expo" },
  exhibitor: { company_name: "Apex Expo Services", contact_name: "Dana Whitfield" },
};

describe("freight QR labels", () => {
  it("QR payload carries only the random token, no exhibitor info", () => {
    expect(qrPayload("https://app.example", "abc123")).toBe("https://app.example/scan/abc123");
  });
  it("label shows event, company, booth and contact name", () => {
    const l = labelFields(freight);
    expect(l.event).toBe("Midwest Manufacturing Expo");
    expect(l.company).toBe("Apex Expo Services");
    expect(l.booth).toBe("842");
    expect(l.contact).toBe("Dana Whitfield");
    expect(l.code).toBe("FRT-1");
  });
  it("label never carries contact email or phone", () => {
    const l = labelFields({
      ...freight,
      exhibitor: { company_name: "Apex Expo Services", contact_name: "Dana Whitfield" } as never,
    });
    expect(Object.keys(l).sort()).toEqual(["booth", "code", "company", "contact", "event", "pieces", "type"]);
  });
  it("missing contact or event fall back to a dash", () => {
    const l = labelFields({ ...freight, event: null, exhibitor: { company_name: "Apex", contact_name: null } });
    expect(l.event).toBe("—");
    expect(l.contact).toBe("—");
    expect(l.company).toBe("Apex");
  });
});
