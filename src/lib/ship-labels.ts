export const SHIP_DESTINATIONS = {
  advance_warehouse: { label: "Advance warehouse" },
  show_site: { label: "Direct to show site" },
} as const;
export type ShipDestination = keyof typeof SHIP_DESTINATIONS;

/** Text stored on each pre-advised crate so the dock knows how it's arriving. */
export function buildShipmentDescription(i: {
  destination: ShipDestination; fromName: string; fromAddress: string; carrier: string; tracking?: string; contact?: string;
}) {
  const parts = [
    `Inbound to ${SHIP_DESTINATIONS[i.destination].label}`,
    `from ${i.fromName.trim()} (${i.fromAddress.trim()})`,
    `via ${i.carrier.trim()}${i.tracking?.trim() ? ` #${i.tracking.trim()}` : ""}`,
  ];
  if (i.contact?.trim()) parts.push(`on-site contact ${i.contact.trim()}`);
  return parts.join(" · ").slice(0, 500);
}
