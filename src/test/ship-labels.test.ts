import { describe, expect, it } from "vitest";
import { buildShipmentDescription } from "@/lib/ship-labels";
describe("inbound shipping label description", () => {
  it("records destination, origin and carrier", () => {
    expect(buildShipmentDescription({ destination: "show_site", fromName: "Acme", fromAddress: "1 Main St", carrier: "ODFL", tracking: "123" }))
      .toBe("Inbound to Direct to show site · from Acme (1 Main St) · via ODFL #123");
  });
});
