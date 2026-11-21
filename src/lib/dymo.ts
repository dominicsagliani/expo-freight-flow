/** Browser-only bridge to the official DYMO Connect JavaScript SDK (talks to DYMO Connect on this computer). */
import QRCode from "qrcode";
import { crateLabelXml, type CrateLabel } from "@/lib/dymo-label";

type DymoPrinter = { name: string; modelName: string; isConnected: boolean; printerType: string };
type DymoFramework = {
  init: (cb?: () => void) => void;
  checkEnvironment: () => { isBrowserSupported: boolean; isFrameworkInstalled: boolean; isWebServicePresent: boolean; errorDetails: string };
  getPrinters: () => DymoPrinter[];
  openLabelXml: (xml: string) => { print: (printer: string, params?: string) => void };
};
declare global { interface Window { dymo?: { label: { framework: DymoFramework } } } }

let loading: Promise<DymoFramework> | null = null;

export function loadDymo(): Promise<DymoFramework> {
  if (loading) return loading;
  loading = new Promise<DymoFramework>((resolve, reject) => {
    const ready = () => {
      const fw = window.dymo?.label.framework;
      if (!fw) return reject(new Error("DYMO library failed to load."));
      fw.init(() => resolve(fw));
    };
    if (window.dymo) return ready();
    const s = document.createElement("script");
    s.src = "/vendor/dymo.connect.framework.js";
    s.onload = ready;
    s.onerror = () => reject(new Error("Couldn't load the DYMO library."));
    document.head.appendChild(s);
  }).catch((e) => { loading = null; throw e; });
  return loading;
}

export type DymoStatus = { ok: boolean; message: string; printers: string[] };

export async function dymoStatus(): Promise<DymoStatus> {
  const fw = await loadDymo();
  const env = fw.checkEnvironment();
  if (!env.isWebServicePresent || !env.isFrameworkInstalled) {
    return { ok: false, printers: [], message: "DYMO Connect isn't running on this computer. Install/open DYMO Connect for Desktop, then retry." };
  }
  const printers = fw.getPrinters().filter((p) => p.printerType === "LabelWriterPrinter" && p.isConnected).map((p) => p.name);
  if (!printers.length) return { ok: false, printers, message: "No connected LabelWriter found. Check the USB cable and power." };
  return { ok: true, printers, message: `Ready: ${printers[0]}` };
}

/** Prints each label straight to the printer — no dialog. Returns how many were sent. */
export async function printCrateLabels(labels: CrateLabel[], printer?: string): Promise<number> {
  const fw = await loadDymo();
  const status = await dymoStatus();
  if (!status.ok) throw new Error(status.message);
  const target = printer && status.printers.includes(printer) ? printer : status.printers[0]!;
  for (const l of labels) {
    const png = await QRCode.toDataURL(l.qrValue, { margin: 1, width: 600, errorCorrectionLevel: "M" });
    fw.openLabelXml(crateLabelXml(l, png.split(",")[1]!)).print(target);
  }
  return labels.length;
}
