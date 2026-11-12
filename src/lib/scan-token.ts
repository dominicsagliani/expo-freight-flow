/** Extracts the freight QR token from a scanned value (full scan URL or bare token). */
export function parseScanToken(raw: string): string | null {
  const v = raw.trim();
  const m = v.match(/\/scan\/([A-Za-z0-9_-]{16,})(?:[/?#]|$)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{16,}$/.test(v)) return v;
  return null;
}
