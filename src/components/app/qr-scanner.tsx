import { useEffect, useRef, useState } from "react";

/** Camera QR scanner. The library is loaded only in the browser. */
export function QrScanner({ onResult }: { onResult: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cb = useRef(onResult);
  cb.current = onResult;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: { stop: () => void; destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const { default: QrScannerLib } = await import("qr-scanner");
      if (cancelled || !videoRef.current) return;
      if (!(await QrScannerLib.hasCamera())) {
        setError("No camera found on this device.");
        return;
      }
      const s = new QrScannerLib(videoRef.current, (r) => cb.current(r.data), {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      });
      scanner = s;
      try {
        await s.start();
      } catch {
        setError("Camera access was blocked. Allow camera permission in your browser settings and try again.");
      }
    })();
    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, []);

  return (
    <div className="grid gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-sidebar">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Point the camera at an ExpoHaul freight label.</p>
      )}
    </div>
  );
}
