/** Fields printed on a label: event, company, booth, contact name, freight ID.
 *  Contact email and phone stay off the label. */
export function labelFields(f: {
  freight_code: string;
  booth_number: string | null;
  pieces: number;
  freight_type: string;
  event: { name: string } | null;
  exhibitor: { company_name: string; contact_name: string | null } | null;
}) {
  return {
    code: f.freight_code,
    booth: f.booth_number ?? "—",
    pieces: f.pieces,
    type: f.freight_type,
    event: f.event?.name ?? "—",
    company: f.exhibitor?.company_name ?? "—",
    contact: f.exhibitor?.contact_name ?? "—",
  };
}

/** The QR payload: a sign-in-protected app URL carrying only the random token. */
export function qrPayload(origin: string, qrToken: string) {
  return `${origin}/scan/${qrToken}`;
}
