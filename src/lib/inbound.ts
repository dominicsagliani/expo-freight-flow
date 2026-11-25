export type InboundPiece = { id: string; pieces: number; arrival_status: string; arrived_at: string | null; inbound_extra: boolean };

export function inboundCounts(shipment: { expected_pieces: number; unexpected: boolean }, freight: InboundPiece[]) {
  const arrived = freight.filter((f) => Boolean(f.arrived_at) || f.arrival_status !== "expected");
  const actual = arrived.reduce((n, f) => n + f.pieces, 0);
  const expectedReceived = arrived.filter((f) => !f.inbound_extra).reduce((n, f) => n + f.pieces, 0);
  const missing = Math.max(0, shipment.expected_pieces - expectedReceived);
  const extra = arrived.filter((f) => f.inbound_extra).reduce((n, f) => n + f.pieces, 0);
  const delivered = freight.filter((f) => f.arrival_status === "delivered_to_booth").reduce((n, f) => n + f.pieces, 0);
  return { expected: shipment.expected_pieces, actual, missing, extra, delivered,
    waiting: arrived.filter((f) => ["received", "in_storage"].includes(f.arrival_status)).reduce((n, f) => n + f.pieces, 0),
    status: shipment.unexpected ? "Unexpected" : !actual ? "Expected" : missing ? "Partial arrival" : "Received" };
}

export function inboundOverview(shipments: { expected_pieces: number; unexpected: boolean; freight: InboundPiece[] }[]) {
  return shipments.reduce((s, row) => {
    const c = inboundCounts(row, row.freight);
    return { expectedShipments: s.expectedShipments + Number(!row.unexpected),
      receivedShipments: s.receivedShipments + Number(c.actual > 0),
      outstanding: s.outstanding + Number(!row.unexpected && c.missing > 0),
      unexpected: s.unexpected + Number(row.unexpected), expected: s.expected + c.expected, actual: s.actual + c.actual };
  }, { expectedShipments: 0, receivedShipments: 0, outstanding: 0, unexpected: 0, expected: 0, actual: 0 });
}