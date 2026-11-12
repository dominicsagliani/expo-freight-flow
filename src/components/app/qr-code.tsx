import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M" }).then(setSrc);
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt="Freight QR code" /> : <div style={{ width: size, height: size }} />;
}
