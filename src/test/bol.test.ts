import { describe, expect, it } from "vitest";
import { MAX_BOL_BYTES, resizeBolCrates, sanitizeBolFilename, validateBolFile } from "@/lib/bol";

describe("BOL receiving rules", () => {
  it("accepts PDF, JPG and PNG documents up to 15 MB", () => {
    expect(validateBolFile({ name: "dock.pdf", type: "application/pdf", size: MAX_BOL_BYTES })).toBeNull();
    expect(validateBolFile({ name: "camera.JPG", type: "", size: 1000 })).toBeNull();
    expect(validateBolFile({ name: "camera.png", type: "image/png", size: 1000 })).toBeNull();
    expect(validateBolFile({ name: "manifest.txt", type: "text/plain", size: 1000 })).toMatch(/PDF, JPG or PNG/);
    expect(validateBolFile({ name: "large.pdf", type: "application/pdf", size: MAX_BOL_BYTES + 1 })).toMatch(/15 MB/);
  });

  it("creates exactly the requested individual crate rows without duplicating existing rows", () => {
    const existing = [{ description: "Display tower", weight: "450" }];
    expect(resizeBolCrates(existing, 4, "Fallback")).toEqual([
      existing[0],
      { description: "Fallback", weight: "" },
      { description: "Fallback", weight: "" },
      { description: "Fallback", weight: "" },
    ]);
    expect(resizeBolCrates(existing, 1, "Fallback")).toEqual(existing);
  });

  it("uses a storage-safe filename while retaining the extension", () => {
    expect(sanitizeBolFilename("YRC PRO 482910 final.pdf")).toBe("YRC-PRO-482910-final.pdf");
  });
});
