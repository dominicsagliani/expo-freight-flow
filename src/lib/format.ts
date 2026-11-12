import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "MMM d, yyyy");
}

export function fmtShortDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "MMM d");
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "MMM d, h:mm a");
}

export function fmtAgo(value: string | null | undefined) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(parseISO(value))} ago`;
}

export function fmtWeight(lbs: number | null | undefined) {
  if (lbs == null) return "—";
  return `${Number(lbs).toLocaleString()} lb`;
}

export function fmtDims(l?: number | null, w?: number | null, h?: number | null) {
  if (!l || !w || !h) return "—";
  return `${Number(l)}″ × ${Number(w)}″ × ${Number(h)}″`;
}

export function fmtDateRange(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${format(s, "MMM d")}–${format(e, "d, yyyy")}`;
  }
  return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
}
