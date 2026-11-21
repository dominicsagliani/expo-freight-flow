import { useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { qrPayload } from "@/lib/freight-label";
import type { CrateLabel } from "@/lib/dymo-label";

export type CrateRecord = { freight_code: string; qr_token: string; booth_number: string | null; exhibitor: { company_name: string } | null };

export function toCrateLabels(rows: CrateRecord[]): CrateLabel[] {
  return rows.map((f) => ({
    crateId: f.freight_code,
    exhibitor: f.exhibitor?.company_name ?? "—",
    booth: f.booth_number ?? "—",
    qrValue: qrPayload(window.location.origin, f.qr_token),
  }));
}

/** Sends existing crate labels straight to the DYMO LabelWriter (no print dialog). */
export function DymoPrintButton({ crates, children, size = "sm", variant = "teal" }: {
  crates: CrateRecord[]; children: React.ReactNode; size?: "sm" | "default"; variant?: "teal" | "outline" | "ghost";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size={size} variant={variant} disabled={busy || !crates.length} onClick={async () => {
      setBusy(true);
      try {
        const { printCrateLabels } = await import("@/lib/dymo");
        const n = await printCrateLabels(toCrateLabels(crates));
        toast.success(`Sent ${n} label${n === 1 ? "" : "s"} to the DYMO printer`);
      } catch (e) { toast.error((e as Error).message); }
      finally { setBusy(false); }
    }}><Printer /> {busy ? "Printing…" : children}</Button>
  );
}

/** Connection check + one test label. */
export function DymoConnectPanel() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try { const { dymoStatus } = await import("@/lib/dymo"); const s = await dymoStatus(); setMsg({ ok: s.ok, text: s.message }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try {
      const { printCrateLabels } = await import("@/lib/dymo");
      await printCrateLabels([{ crateId: "TEST-0001", exhibitor: "ExpoHaul test label", booth: "000", qrValue: `${window.location.origin}/scan/test` }]);
      setMsg({ ok: true, text: "Test label sent to the printer." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs">
      <span className="font-semibold">DYMO LabelWriter</span>
      <span className={msg ? (msg.ok ? "text-status-progress" : "text-destructive") : "text-muted-foreground"}>
        {msg?.text ?? "Uses 30256 shipping labels (2-5/16\" × 4\")."}
      </span>
      <span className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={check}><RefreshCw /> Check printer</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={test}><Printer /> Print test label</Button>
      </span>
    </div>
  );
}
