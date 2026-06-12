import type { MatchListing } from "./match.server";

export interface EmailListing extends MatchListing {
  net_yield?: number | null;
  stars?: number | null;
}

export interface DigestSection {
  searchName: string;
  listings: EmailListing[];
}

const APP_URL = process.env.APP_BASE_URL || "https://property-finder-pro-13.lovable.app";
const BG = "#0f172a";
const SURFACE = "#111c2e";
const SURFACE_2 = "#162236";
const BORDER = "#1f2c44";
const FG = "#e2e8f0";
const MUTED = "#94a3b8";
const PRIMARY = "#3b82f6";

function fmtPrice(p: number | null): string {
  if (!p) return "Dohodou";
  return `${p.toLocaleString("cs-CZ").replace(/,/g, " ")} Kč`;
}

function yieldBadge(y?: number | null): string {
  if (y == null) return "";
  const color = y >= 5 ? "#22c55e" : y >= 4 ? "#eab308" : "#f97316";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${color}1f;color:${color};font-size:11px;font-weight:700;">Výnos ${y.toFixed(1)}%</span>`;
}

function listingCard(l: EmailListing): string {
  const img = l.image_url
    ? `<img src="${l.image_url}" alt="" width="120" height="90" style="display:block;border-radius:8px;object-fit:cover;border:1px solid ${BORDER};" />`
    : `<div style="width:120px;height:90px;border-radius:8px;background:${SURFACE_2};border:1px solid ${BORDER};"></div>`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;border:1px solid ${BORDER};border-radius:10px;background:${SURFACE};">
    <tr>
      <td style="padding:12px;vertical-align:top;width:140px;">${img}</td>
      <td style="padding:12px 12px 12px 0;vertical-align:top;">
        <div style="font-size:14px;font-weight:600;color:${FG};line-height:1.3;margin-bottom:4px;">${escape(l.title ?? "(bez názvu)")}</div>
        <div style="font-size:12px;color:${MUTED};margin-bottom:6px;">${escape(l.city ?? "")}${l.area_m2 ? ` · ${l.area_m2} m²` : ""}</div>
        <div style="font-size:15px;font-weight:700;color:${PRIMARY};margin-bottom:6px;">${fmtPrice(l.price)}</div>
        <div style="margin-bottom:10px;">${yieldBadge(l.net_yield)}</div>
        <a href="${l.url}" style="display:inline-block;padding:6px 14px;border-radius:6px;background:${PRIMARY};color:#fff;font-size:12px;font-weight:600;text-decoration:none;">Zobrazit inzerát</a>
      </td>
    </tr>
  </table>`;
}

function shell(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 16px 0;">
          <div style="font-size:20px;font-weight:800;color:${FG};">🐕 Hlídací pes</div>
          <div style="font-size:12px;color:${MUTED};">RealityScanner</div>
        </td></tr>
        ${inner}
        <tr><td style="padding:24px 0 0 0;border-top:1px solid ${BORDER};margin-top:24px;">
          <div style="font-size:11px;color:${MUTED};text-align:center;padding-top:16px;">
            <a href="${APP_URL}/watchdogs" style="color:${PRIMARY};text-decoration:none;">Spravovat hlídací psy</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function renderInstantEmail(searchName: string, listings: EmailListing[]): { subject: string; html: string; text: string } {
  const n = listings.length;
  const inner = `
    <tr><td style="padding:0 0 16px 0;">
      <div style="font-size:16px;font-weight:600;color:${FG};margin-bottom:4px;">${n} ${plural(n, "nová nemovitost", "nové nemovitosti", "nových nemovitostí")}</div>
      <div style="font-size:13px;color:${MUTED};">Hledání: ${escape(searchName)}</div>
    </td></tr>
    <tr><td>${listings.map(listingCard).join("")}</td></tr>`;
  return {
    subject: `🏠 ${n} ${plural(n, "nová nemovitost", "nové nemovitosti", "nových nemovitostí")} — ${searchName}`,
    html: shell(`${n} nových nemovitostí`, inner),
    text: plainText(listings, searchName),
  };
}

export function renderDigestEmail(sections: DigestSection[]): { subject: string; html: string; text: string } {
  const total = sections.reduce((s, x) => s + x.listings.length, 0);
  const inner = sections.map((s) => `
    <tr><td style="padding:0 0 8px 0;">
      <div style="font-size:14px;font-weight:600;color:${FG};margin-top:8px;margin-bottom:8px;border-left:3px solid ${PRIMARY};padding-left:8px;">
        ${escape(s.searchName)} <span style="color:${MUTED};font-weight:400;">— ${s.listings.length}</span>
      </div>
    </td></tr>
    <tr><td>${s.listings.map(listingCard).join("")}</td></tr>`).join("");
  const subject = `🏠 Denní souhrn: ${total} ${plural(total, "nová nemovitost", "nové nemovitosti", "nových nemovitostí")}`;
  return {
    subject,
    html: shell(subject, inner),
    text: sections.map((s) => `### ${s.searchName}\n` + plainText(s.listings, s.searchName)).join("\n\n"),
  };
}

function plainText(listings: EmailListing[], searchName: string): string {
  const head = `Nové nemovitosti pro hledání "${searchName}":\n\n`;
  const body = listings.map((l, i) =>
    `${i + 1}. ${l.title ?? ""}\n   ${l.city ?? ""}${l.area_m2 ? ` · ${l.area_m2} m²` : ""}\n   ${fmtPrice(l.price)}${l.net_yield != null ? ` · výnos ${l.net_yield.toFixed(1)}%` : ""}\n   ${l.url}`,
  ).join("\n\n");
  return head + body + `\n\nSpravovat hlídací psy: ${APP_URL}/watchdogs\n`;
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
