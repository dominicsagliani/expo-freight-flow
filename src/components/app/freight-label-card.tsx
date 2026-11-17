import { QrCode } from "@/components/app/qr-code";
import { FREIGHT_TYPE_LABEL, type FreightType } from "@/lib/labels";
import { labelFields, qrPayload } from "@/lib/freight-label";

type FreightLabelData = Parameters<typeof labelFields>[0] & { qr_token: string };

export function FreightLabelCard({
  freight,
  crateNumber,
  crateCount,
}: {
  freight: FreightLabelData;
  crateNumber?: number | null;
  crateCount?: number;
}) {
  const l = labelFields(freight);
  return (
    <div className="print-label mx-auto w-[4in] rounded-md border-2 border-foreground bg-card p-4 text-foreground">
      <div className="flex items-start justify-between border-b-2 border-foreground pb-2">
        <span className="font-display text-sm font-bold">ExpoHaul</span>
        <span className="max-w-[2.5in] text-right text-[10px] leading-tight">{l.event}</span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <QrCode value={qrPayload(window.location.origin, freight.qr_token)} size={150} />
        <div className="grid min-w-0 gap-1.5">
          <div><div className="text-[10px] font-semibold uppercase">Company</div><div className="break-words font-display text-sm font-bold leading-tight">{l.company}</div></div>
          <div><div className="text-[10px] font-semibold uppercase">Booth</div><div className="font-display text-3xl font-bold leading-none">{l.booth}</div></div>
          <div><div className="text-[10px] font-semibold uppercase">Contact</div><div className="text-xs font-medium leading-tight">{l.contact}</div></div>
          <div><div className="text-[10px] font-semibold uppercase">Freight ID</div><div className="font-mono text-base font-bold leading-tight">{l.code}</div></div>
          <div className="text-xs">
            {FREIGHT_TYPE_LABEL[l.type as FreightType]} · {l.pieces} pc
            {crateNumber && crateCount ? ` · Crate ${crateNumber} of ${crateCount}` : ""}
          </div>
        </div>
      </div>
      <p className="mt-3 border-t border-foreground pt-2 text-[9px]">Scan with the ExpoHaul app. Full details visible to authorized staff only.</p>
    </div>
  );
}
