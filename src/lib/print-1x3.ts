/** Browser-print 1x3 crate labels (DYMO 30252, 1-1/8" x 3-1/2") from an isolated frame so the app layout can't shrink or crop them. */
import QRCode from "qrcode";
import type { CrateLabel } from "@/lib/dymo-label";

/** Printer calibration: the user's DYMO 450 prints this far too early along the 3.5" feed, so content starts this much further down the strip. */
export const LABEL_FEED_OFFSET_IN = 0.5;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function labels1x3Html(labels: (CrateLabel & { qr: string })[]) {
  const pages = labels.map((l) => `<div class="page"><div class="label"><img src="${l.qr}" alt=""/><div class="t"><div class="b">EXPOHAUL</div><div class="id">${esc(l.crateId)}</div><div class="co">${esc(l.exhibitor)}</div><div class="bo">Booth ${esc(l.booth)}</div></div></div></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Crate labels</title><style>
@page { size: 1.125in 3.5in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1.125in; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
.page { position: relative; width: 1.125in; height: 3.5in; overflow: hidden; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.label { position: absolute; top: ${LABEL_FEED_OFFSET_IN}in; left: 1.125in; width: ${3.5 - LABEL_FEED_OFFSET_IN}in; height: 1.125in; transform: rotate(90deg); transform-origin: top left; display: flex; align-items: center; gap: 0.08in; padding: 0.14in 0.1in; }
img { width: 0.78in; height: 0.78in; flex: none; }
.t { min-width: 0; line-height: 1.1; }
.b { font-size: 6pt; font-weight: 700; }
.id { font-family: "Courier New", monospace; font-size: 11pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.co { font-size: 7pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: ${2.4 - LABEL_FEED_OFFSET_IN - 0.3}in; }
.bo { font-size: 12pt; font-weight: 700; }
</style></head><body>${pages}</body></html>`;
}

export async function print1x3Labels(labels: CrateLabel[]) {
  const withQr = await Promise.all(labels.map(async (l) => ({ ...l, qr: await QRCode.toDataURL(l.qrValue, { margin: 1, width: 400, errorCorrectionLevel: "M" }) })));
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(labels1x3Html(withQr)); doc.close();
  await Promise.all(Array.from(doc.images).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}
