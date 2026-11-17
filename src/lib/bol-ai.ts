import { bolMimeType } from "./bol";

export type BolAiPage = { data: string; mediaType: "image/jpeg" };

export type BolExtractionResult = {
  exhibitorId: string | null;
  carrierName: string | null;
  proNumber: string | null;
  shipperName: string | null;
  consigneeName: string | null;
  boothNumber: string | null;
  declaredPieces: number | null;
  description: string | null;
  totalWeightLbs: number | null;
  specialInstructions: string | null;
  crates: { description: string | null; weightLbs: number | null }[];
  warnings: string[];
};

export type BolExtractionResponse =
  | { ok: true; result: BolExtractionResult }
  | { ok: false; status: number; message: string };

const MAX_AI_PAGES = 5;
const MAX_IMAGE_EDGE = 2000;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare the document image")), "image/jpeg", 0.9);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function renderCanvas(canvas: HTMLCanvasElement): Promise<BolAiPage> {
  const blob = await canvasToJpeg(canvas);
  return { data: await blobToBase64(blob), mediaType: "image/jpeg" };
}

function sizedCanvas(width: number, height: number) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return { canvas, scale };
}

/** Converts PDFs and photos to bounded JPEG page images in the browser. */
export async function prepareBolForAi(file: File): Promise<{ pages: BolAiPage[]; truncated: boolean }> {
  const mime = bolMimeType(file);
  if (mime === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: BolAiPage[] = [];
    for (let number = 1; number <= Math.min(document.numPages, MAX_AI_PAGES); number += 1) {
      const page = await document.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, MAX_IMAGE_EDGE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not render this PDF");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      pages.push(await renderCanvas(canvas));
      canvas.width = 1;
      canvas.height = 1;
    }
    return { pages, truncated: document.numPages > MAX_AI_PAGES };
  }

  const bitmap = await createImageBitmap(file);
  const { canvas, scale } = sizedCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this photo");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
  bitmap.close();
  return { pages: [await renderCanvas(canvas)], truncated: false };
}
