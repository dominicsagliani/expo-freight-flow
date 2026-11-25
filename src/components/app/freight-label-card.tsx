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
    <div className="print-label mx-auto grid min-h-[59mm] w-full max-w-[104mm] grid-rows-[auto_1fr] gap-2 rounded-md border-2 border-foreground bg-card p-[3mm] text-foreground">
      <div className="flex items-start justify-between gap-2 border-b border-foreground pb-1">
        <span className="font-display text-xs font-bold">ExpoHaul</span>
        <span className="max-w-[65mm] break-words text-right text-[9px] leading-tight">{l.event}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="shrink-0"><QrCode value={qrPayload(window.location.origin, freight.qr_token)} size={118} /></div>
        <div className="grid min-w-0 gap-1">
          <div className="break-words font-display text-xs font-bold leading-tight">{l.company}</div>
          <div><div className="text-[9px] font-semibold uppercase">Booth</div><div className="break-words font-display text-2xl font-bold leading-none">{l.booth}</div></div>
          <div className="break-words text-[10px] font-medium leading-tight">Contact: {l.contact}</div>
          <div className="break-all font-mono text-xs font-bold leading-tight">{l.code}</div>
          <div className="text-[9px] leading-tight">
            {FREIGHT_TYPE_LABEL[l.type as FreightType]} · {l.pieces} pc
            {crateNumber && crateCount ? ` · Crate ${crateNumber} of ${crateCount}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
