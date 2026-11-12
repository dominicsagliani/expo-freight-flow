/** Client-side checks mirrored by database triggers and access rules. Returns an error message or null. */
export function validateTicketDraft(d: {
  eventId: string;
  exhibitorId: string;
  freightIds: string[];
  allowedFreightIds: string[];
}): string | null {
  if (!d.eventId) return "Choose an event";
  if (!d.exhibitorId) return "Choose an exhibitor";
  const allowed = new Set(d.allowedFreightIds);
  if (d.freightIds.some((id) => !allowed.has(id))) {
    return "Attached freight must belong to the selected exhibitor and event";
  }
  return null;
}
