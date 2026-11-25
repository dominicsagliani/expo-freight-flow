export type ExhibitorCsvRow = {
  line: number;
  company_name: string;
  booth_number: string;
  first_name: string;
  last_name: string;
  contact_email: string;
  contact_phone: string;
  billing_address: string;
  piece_count: number;
  weight_lbs: number;
  errors: string[];
};

export const EXHIBITOR_CSV_HEADERS = [
  "company_name",
  "booth_number",
  "first_name",
  "last_name",
  "contact_email",
  "contact_phone",
  "billing_address",
  "piece_count",
  "weight_lbs",
] as const;

export const SAMPLE_EXHIBITOR_CSV =
  "Company Name,Booth Number,First Name,Last Name,Contact Email,Contact Phone,Billing Address,Piece Count,Weight Lbs\n" +
  'Acme Marine Supplies,B-14,Sarah,Jenkins,sarah@acmemarine.com,555-234-5678,"1200 Harbor Dr, St. Petersburg, FL",3,500\n' +
  'Gulf Coast Rigging,402,Dave,Miller,dave@gulfcoast.com,555-876-5432,"450 Bay St, Tampa, FL",2,300\n';

/** RFC4180-style CSV parser (quotes, escaped quotes, CRLF, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z]/g, "");
const ALIASES: Record<string, string> = {
  companyname: "company_name", company: "company_name", exhibitor: "company_name",
  boothnumber: "booth_number", booth: "booth_number", slip: "booth_number",
  firstname: "first_name", lastname: "last_name", contactname: "contact_name", name: "contact_name",
  contactemail: "contact_email", email: "contact_email",
  contactphone: "contact_phone", phone: "contact_phone",
  billingaddress: "billing_address", address: "billing_address",
  piececount: "piece_count", pieces: "piece_count", cratecount: "piece_count",
  weightlbs: "weight_lbs", weight: "weight_lbs",
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseExhibitorCsv(text: string): { rows: ExhibitorCsvRow[]; error?: string } {
  const all = parseCsv(text);
  if (all.length < 2) return { rows: [], error: "The file needs a header row and at least one exhibitor." };
  const header = all[0];
  if (!header) return { rows: [], error: "Missing headers" };
  const keys = header.map((h) => ALIASES[norm(h)] ?? null);
  if (!keys.includes("company_name") || !keys.includes("booth_number"))
    return { rows: [], error: "Missing required columns: Company Name and Booth Number." };
  const seen = new Set<string>();
  const rows = all.slice(1).map((cells, i) => {
    const g: Record<string, string> = {};
    keys.forEach((k, j) => { if (k) g[k] = (cells[j] ?? "").trim(); });
    let first = g["first_name"] ?? "";
    let last = g["last_name"] ?? "";
    if (!first && !last && g["contact_name"]) {
      const parts = g["contact_name"].split(/\s+/);
      first = parts.shift() ?? "";
      last = parts.join(" ");
    }
    const r: ExhibitorCsvRow = {
      line: i + 2,
      company_name: g["company_name"] ?? "",
      booth_number: g["booth_number"] ?? "",
      first_name: first,
      last_name: last,
      contact_email: g["contact_email"] ?? "",
      contact_phone: g["contact_phone"] ?? "",
      billing_address: g["billing_address"] ?? "",
      piece_count: Number(g["piece_count"] || 1),
      weight_lbs: Number(g["weight_lbs"] || 0),
      errors: [],
    };
    if (r.company_name.length < 2) r.errors.push("Company name missing");
    if (!r.booth_number) r.errors.push("Booth number missing");
    if (r.contact_email && !EMAIL.test(r.contact_email)) r.errors.push("Invalid email");
    if (!Number.isInteger(r.piece_count) || r.piece_count < 1 || r.piece_count > 1000) r.errors.push("Piece count must be 1–1000");
    if (!Number.isFinite(r.weight_lbs) || r.weight_lbs < 0) r.errors.push("Invalid weight");
    const key = `${r.company_name.toLowerCase()}|${r.booth_number.toLowerCase()}`;
    if (r.company_name && r.booth_number && seen.has(key)) r.errors.push("Duplicate row in file");
    seen.add(key);
    return r;
  });
  return { rows };
}
