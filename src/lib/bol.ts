export const BOL_ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";
export const MAX_BOL_BYTES = 15 * 1024 * 1024;
export const MAX_BOL_CRATES = 50;

export type BolCrateDraft = { description: string; weight: string };

export function bolMimeType(file: { name: string; type: string }) {
  if (["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return file.type;
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  return file.type;
}

export function validateBolFile(file: { name: string; type: string; size: number }) {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(bolMimeType(file))) {
    return "Choose a PDF, JPG or PNG document";
  }
  if (file.size <= 0) return "The selected document is empty";
  if (file.size > MAX_BOL_BYTES) return "The document must be 15 MB or smaller";
  return null;
}

export function resizeBolCrates(current: BolCrateDraft[], count: number, description: string) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BOL_CRATES) return current;
  return Array.from({ length: count }, (_, index) =>
    current[index] ?? { description: description.trim(), weight: "" },
  );
}

export function sanitizeBolFilename(name: string) {
  const basename = name.split(/[\\/]/).pop() ?? "bol-document";
  const safe = basename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  return safe || "bol-document";
}
