/** DYMO LabelWriter 450 crate label: 30256 Shipping (2-5/16" x 4"). Pure helpers (no browser APIs). */
export const DYMO_LABEL_NAME = "30256 Shipping (2-5/16\" x 4\")";

export type CrateLabel = { crateId: string; exhibitor: string; booth: string; qrValue: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function text(name: string, value: string, x: number, y: number, w: number, h: number, size: number, bold: boolean) {
  return `<ObjectInfo><TextObject><Name>${name}</Name><ForeColor Alpha="255" Red="0" Green="0" Blue="0"/><BackColor Alpha="0" Red="255" Green="255" Blue="255"/><LinkedObjectName></LinkedObjectName><Rotation>Rotation0</Rotation><IsMirrored>False</IsMirrored><IsVariable>True</IsVariable><HorizontalAlignment>Left</HorizontalAlignment><VerticalAlignment>Middle</VerticalAlignment><TextFitMode>ShrinkToFit</TextFitMode><UseFullFontHeight>True</UseFullFontHeight><Verticalized>False</Verticalized><StyledText><Element><String>${esc(value)}</String><Attributes><Font Family="Arial" Size="${size}" Bold="${bold ? "True" : "False"}" Italic="False" Underline="False" Strikeout="False"/><ForeColor Alpha="255" Red="0" Green="0" Blue="0"/></Attributes></Element></StyledText></TextObject><Bounds X="${x}" Y="${y}" Width="${w}" Height="${h}"/></ObjectInfo>`;
}

/** Label XML (twips). QR image on the left, crate ID / exhibitor / booth on the right. */
export function crateLabelXml(l: CrateLabel, qrPngBase64: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips"><PaperOrientation>Landscape</PaperOrientation><Id>Shipping</Id><PaperName>30256 Shipping</PaperName><DrawCommands><RoundRectangle X="0" Y="0" Width="3331" Height="5715" Rx="180" Ry="180"/></DrawCommands>
<ObjectInfo><ImageObject><Name>QR</Name><ForeColor Alpha="255" Red="0" Green="0" Blue="0"/><BackColor Alpha="0" Red="255" Green="255" Blue="255"/><LinkedObjectName></LinkedObjectName><Rotation>Rotation0</Rotation><IsMirrored>False</IsMirrored><IsVariable>False</IsVariable><Image>${qrPngBase64}</Image><ScaleMode>Uniform</ScaleMode><BorderWidth>0</BorderWidth><BorderColor Alpha="255" Red="0" Green="0" Blue="0"/><HorizontalAlignment>Center</HorizontalAlignment><VerticalAlignment>Center</VerticalAlignment></ImageObject><Bounds X="300" Y="150" Width="2900" Height="2900"/></ObjectInfo>
${text("EXPOHAUL", "ExpoHaul", 3300, 150, 2300, 300, 9, true)}
${text("CRATE", l.crateId, 3300, 480, 2300, 650, 16, true)}
${text("EXHIBITOR", l.exhibitor, 3300, 1180, 2300, 900, 11, false)}
${text("BOOTH", `Booth ${l.booth}`, 3300, 2130, 2300, 950, 22, true)}
</DieCutLabel>`;
}
