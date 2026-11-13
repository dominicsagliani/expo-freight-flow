import { useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewerMarker = {
  id: string;
  /** Position as a percentage of the plan width/height, so markers stay put at any zoom. */
  x: number;
  y: number;
  label: string;
  colorClass: string;
  dimmed?: boolean;
};

type Props = {
  fileUrl: string;
  mimeType: string;
  markers: ViewerMarker[];
  selectedId?: string | null;
  editMode?: boolean;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (xPct: number, yPct: number) => void;
};

const MAX_RENDER_WIDTH = 1600;

/**
 * Interactive floor plan: wheel/pinch zoom, drag pan, coordinate-based booth
 * markers. PDFs render page 1 to a canvas (pdfjs loaded only in the browser);
 * images render natively. Proportions always come from the source file.
 */
export function FloorPlanViewer({
  fileUrl,
  mimeType,
  markers,
  selectedId,
  editMode,
  onMarkerClick,
  onMapClick,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    setSize(null);
    setPdfError(null);
    if (!isPdf) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument(fileUrl).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: MAX_RENDER_WIDTH / base.width });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        if (!cancelled) setSize({ w: viewport.width, h: viewport.height });
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : "Could not render this PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPdf, fileUrl]);

  const handleMapClick = (e: React.MouseEvent) => {
    if (!editMode || !onMapClick || !contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) onMapClick(Math.round(x * 100) / 100, Math.round(y * 100) / 100);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border bg-muted/40">
      <TransformWrapper
        minScale={0.3}
        maxScale={8}
        wheel={{ step: 0.12 }}
        pinch={{ step: 5 }}
        doubleClick={{ mode: "zoomIn" }}
        panning={{ velocityDisabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute right-3 top-3 z-20 flex gap-1">
              <Button size="icon" variant="secondary" className="size-8" onClick={() => zoomIn()} aria-label="Zoom in">
                <Plus className="size-4" />
              </Button>
              <Button size="icon" variant="secondary" className="size-8" onClick={() => zoomOut()} aria-label="Zoom out">
                <Minus className="size-4" />
              </Button>
              <Button size="icon" variant="secondary" className="size-8" onClick={() => resetTransform()} aria-label="Reset view">
                <Maximize className="size-4" />
              </Button>
            </div>
            <TransformComponent wrapperClass="!h-full !w-full" contentClass="!inline-block">
              <div
                ref={contentRef}
                onClick={handleMapClick}
                className={`relative ${editMode ? "cursor-crosshair" : ""}`}
                style={size ? { width: size.w, height: size.h } : undefined}
              >
                {isPdf ? (
                  <canvas ref={canvasRef} className="block" />
                ) : (
                  <img
                    src={fileUrl}
                    alt="Event floor plan"
                    className="block h-full w-full select-none"
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      const scale = Math.min(1, MAX_RENDER_WIDTH / img.naturalWidth);
                      setSize({ w: img.naturalWidth * scale, h: img.naturalHeight * scale });
                    }}
                  />
                )}
                {markers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkerClick?.(m.id);
                    }}
                    className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-md transition-opacity ${m.colorClass} ${
                      m.dimmed ? "opacity-20" : ""
                    } ${selectedId === m.id ? "ring-4 ring-teal" : ""}`}
                    style={{ left: `${m.x}%`, top: `${m.y}%`, width: 30, height: 30 }}
                    title={m.label}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
      {pdfError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 p-6 text-center text-sm text-destructive">
          {pdfError}
        </div>
      )}
      {!size && !pdfError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
          Loading floor plan…
        </div>
      )}
    </div>
  );
}
