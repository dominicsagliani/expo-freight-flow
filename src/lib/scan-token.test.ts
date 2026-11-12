import { describe, it, expect } from "vitest";
import { parseScanToken } from "./scan-token";

describe("parseScanToken", () => {
  it("reads token from a label scan URL", () => {
    expect(parseScanToken("https://app.example.com/scan/abcDEF1234567890xyz")).toBe("abcDEF1234567890xyz");
  });
  it("accepts a bare token", () => {
    expect(parseScanToken("abcDEF1234567890xyz")).toBe("abcDEF1234567890xyz");
  });
  it("rejects unrelated QR codes", () => {
    expect(parseScanToken("https://example.com/menu")).toBeNull();
    expect(parseScanToken("hello")).toBeNull();
  });
});
