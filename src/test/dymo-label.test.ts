import { describe, expect, it } from "vitest";
import { crateLabelXml } from "@/lib/dymo-label";

describe("DYMO crate label", () => {
  const xml = crateLabelXml({ crateId: "FR-1001", exhibitor: "Acme & Sons", booth: "512", qrValue: "x" }, "QUJD");
  it("targets the 30252 1x3 address roll for the LabelWriter 450", () => expect(xml).toContain("<PaperName>30252 Address</PaperName>"));
  it("contains crate ID, booth, escaped exhibitor and QR image", () => {
    expect(xml).toContain("FR-1001");
    expect(xml).toContain("Booth 512");
    expect(xml).toContain("Acme &amp; Sons");
    expect(xml).toContain("<Image>QUJD</Image>");
  });
});
