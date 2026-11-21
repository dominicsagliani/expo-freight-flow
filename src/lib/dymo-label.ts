/** DYMO LabelWriter 450 crate label: 30252 Address (1-1/8" x 3-1/2", the standard "1x3" roll). Pure helpers (no browser APIs). */
export const DYMO_LABEL_NAME = "30252 Address (1-1/8\" x 3-1/2\")";

export type CrateLabel = { crateId: string; exhibitor: string; booth: string; qrValue: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function text(name: string, value: string, x: number, y: number, w: number, h: number, size: number, bold: boolean) {
  return `<ObjectInfo><TextObject><Name>${name}</Name><ForeColor Alpha="255" Red="0" Green="0" Blue="0"/><BackColor Alpha="0" Red="255" Green="255" Blue="255"/><LinkedObjectName></LinkedObjectName><Rotation>Rotation0</Rotation><IsMirrored>False</IsMirrored><IsVariable>True</IsVariable><HorizontalAlignment>Left</HorizontalAlignment><VerticalAlignment>Middle</VerticalAlignment><TextFitMode>ShrinkToFit</TextFitMode><UseFullFontHeight>True</UseFullFontHeight><Verticalized>False</Verticalized><StyledText><Element><String>${esc(value)}</String><Attributes><Font Family="Arial" Size="${size}" Bold="${bold ? "True" : "False"}" Italic="False" Underline="False" Strikeout="False"/><ForeColor Alpha="255" Red="0" Green="0" Blue="0"/></Attributes></Element></StyledText></TextObject><Bounds X="${x}" Y="${y}" Width="${w}" Height="${h}"/></ObjectInfo>`;
}

/** Label XML (twips). QR image on the left, crate ID / exhibitor / booth on the right. */
export function crateLabelXml(l: CrateLabel, qrPngBase64: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips"><PaperOrientation>Landscape</PaperOrientation><Id>Address</Id><PaperName>30252 Address</PaperName><DrawCommands><RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270"/></DrawCommands>
<ObjectInfo><ImageObject><Name>QR</Name><ForeColor Alpha="255" Red="0" Green="0" Blue="0"/><BackColor Alpha="0" Red="255" Green="255" Blue="255"/><LinkedObjectName></LinkedObjectName><Rotation>Rotation0</Rotation><IsMirrored>False</IsMirrored><IsVariable>False</IsVariable><Image>${qrPngBase64}</Image><ScaleMode>Uniform</ScaleMode><BorderWidth>0</BorderWidth><BorderColor Alpha="255" Red="0" Green="0" Blue="0"/><HorizontalAlignment>Center</HorizontalAlignment><VerticalAlignment>Center</VerticalAlignment></ImageObject><Bounds X="330" Y="90" Width="1400" Height="1400"/></ObjectInfo>
${text("EXPOHAUL", "ExpoHaul", 1850, 60, 3050, 220, 7, true)}
${text("CRATE", l.crateId, 1850, 290, 3050, 420, 14, true)}
${text("EXHIBITOR", l.exhibitor, 1850, 720, 3050, 320, 9, false)}
${text("BOOTH", `Booth ${l.booth}`, 1850, 1050, 3050, 450, 16, true)}
</DieCutLabel>`;
}
