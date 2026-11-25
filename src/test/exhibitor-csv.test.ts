import { describe, expect, it } from "vitest";
import { parseExhibitorCsv, SAMPLE_EXHIBITOR_CSV } from "@/lib/exhibitor-csv";

describe("exhibitor CSV import", () => {
  it("reads the app's headers including quoted addresses", () => {
    const { rows } = parseExhibitorCsv(SAMPLE_EXHIBITOR_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.billing_address).toBe("1200 Harbor Dr, St. Petersburg, FL");
    expect(rows[1]?.booth_number).toBe("402");
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });
  it("accepts snake_case headers and splits Contact Name", () => {
    const { rows } = parseExhibitorCsv("company_name,booth_number,contact_name\nAcme,1,Jo Ann Smith\n");
    expect(rows[0]?.first_name).toBe("Jo");
    expect(rows[0]?.last_name).toBe("Ann Smith");
  });
  it("requires company and booth columns", () => {
    expect(parseExhibitorCsv("company,email\nA,b@c.co").error).toMatch(/Booth/);
  });
  it("flags missing booth and duplicate rows", () => {
    const { rows } = parseExhibitorCsv("Company,Booth\nAcme,\nBeta,5\nbeta,5\n");
    expect(rows[0]?.errors).toContain("Booth number missing");
    expect(rows[2]?.errors).toContain("Duplicate row in file");
  });
});
