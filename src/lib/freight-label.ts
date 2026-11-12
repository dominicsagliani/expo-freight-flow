/** Fields allowed on a printed label. Never includes exhibitor name or contact details. */
export function labelFields(f: { freight_code: string; booth_number: string | null; pieces: number; freight_type: string }) {
  return { code: f.freight_code, booth: f.booth_number ?? "—", pieces: f.pieces, type: f.freight_type };
}

/** The QR payload: a sign-in-protected app URL carrying only the random token. */
export function qrPayload(origin: string, qrToken: string) {
  return `${origin}/scan/${qrToken}`;
}
