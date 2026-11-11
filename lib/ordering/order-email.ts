import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { amount, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import type { OrderDetail } from "@/lib/ordering/ordering-service";

/**
 * Mail o novoj porudžbini (2026-11-11, nacrt za pregled — slanje još NIJE uključeno).
 *
 * Ide komercijalisti kupca i kancelariji (Tamara). U mailu je kratak pregled i dugme
 * „Odštampaj porudžbinu“ koje otvara samo list porudžbine (A4) i odmah pokreće štampu —
 * ne štampa se ceo mail.
 *
 * Kancelarija: `ORDER_OFFICE_EMAILS` (adrese zarezom) na serveru.
 */

export type OrderEmailRecipient = { name: string; email: string | null; role: "komercijalista" | "kancelarija" };

export async function orderEmailRecipients(customerId: string): Promise<OrderEmailRecipient[]> {
  const reps = await getDb().execute<{ name: string; email: string | null }>(sql`
    SELECT u.name, u.email FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
     WHERE ca.customer_id = ${customerId}::uuid ORDER BY u.name`);
  const office = (process.env.ORDER_OFFICE_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    ...[...reps].map((r) => ({ name: r.name, email: r.email, role: "komercijalista" as const })),
    ...(office.length ? office.map((e) => ({ name: "Kancelarija", email: e, role: "kancelarija" as const })) : [{ name: "Kancelarija (Tamara)", email: null, role: "kancelarija" as const }]),
  ];
}

const esc = (s: string | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildOrderEmail(o: OrderDetail, baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  const doc = o.orderNumber ?? o.requestNumber;
  const printUrl = `${base}/portal/zahtevi/${o.id}/stampa?stampaj=1`;
  const openUrl = `${base}/portal/zahtevi/${o.id}`;
  const priced = o.lines.filter((l) => l.priceStatus === "cena");
  const onRequest = o.lines.filter((l) => l.priceStatus === "na_upit");
  const subject = `Nova porudžbina ${doc} — ${o.customerName}`;

  const td = "padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;vertical-align:top;";
  const th = "padding:8px 10px;border-bottom:2px solid #111;font-size:12px;text-align:left;color:#555;";
  const rows = o.lines
    .map(
      (l) => `<tr>
        <td style="${td}font-family:Menlo,Consolas,monospace;">${esc(l.articleCode)}</td>
        <td style="${td}">${esc(l.articleName)}${l.packCount !== null && l.packLabel ? `<br><span style="color:#666;font-size:12px;">${l.packCount} × ${esc(l.packLabel)}</span>` : ""}</td>
        <td style="${td}text-align:right;white-space:nowrap;">${quantity(l.quantity)} ${esc(l.unit)}</td>
        <td style="${td}text-align:right;white-space:nowrap;">${l.priceStatus === "cena" ? `${amount(l.lineNet)}` : "na upit"}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid #e5e7eb;">
  <tr><td style="background:#111;color:#fff;padding:16px 24px;font-size:14px;font-weight:bold;letter-spacing:.04em;">CARSYSTEM I R-M · POSLOVNI SISTEM</td></tr>
  <tr><td style="padding:24px;">
    <p style="margin:0 0 4px;font-size:13px;color:#d71920;font-weight:bold;">Nova porudžbina</p>
    <h1 style="margin:0 0 12px;font-size:22px;">${esc(o.customerName)}</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:18px;">
      <tr><td style="color:#666;padding:2px 16px 2px 0;">Broj</td><td><b>${esc(doc)}</b></td></tr>
      <tr><td style="color:#666;padding:2px 16px 2px 0;">Poslato</td><td>${esc(dmyTime(o.submittedAt))} · ${esc(o.submittedByName)}</td></tr>
      <tr><td style="color:#666;padding:2px 16px 2px 0;">Plaćanje</td><td>${esc(o.paymentOptionLabel ?? "po dogovoru")}</td></tr>
      <tr><td style="color:#666;padding:2px 16px 2px 0;">Isporuka</td><td>${esc(o.deliveryAddress ?? "redovna adresa kupca")}</td></tr>
      ${o.customerNote ? `<tr><td style="color:#666;padding:2px 16px 2px 0;">Napomena</td><td>${esc(o.customerNote)}</td></tr>` : ""}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
      <td style="background:#d71920;border-radius:6px;"><a href="${esc(printUrl)}" style="display:inline-block;padding:12px 20px;color:#fff;font-weight:bold;font-size:14px;text-decoration:none;">Odštampaj porudžbinu</a></td>
      <td style="width:10px;"></td>
      <td style="border:1px solid #111;border-radius:6px;"><a href="${esc(openUrl)}" style="display:inline-block;padding:11px 18px;color:#111;font-weight:bold;font-size:14px;text-decoration:none;">Otvori u portalu</a></td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><th style="${th}">Šifra</th><th style="${th}">Naziv</th><th style="${th}text-align:right;">Količina</th><th style="${th}text-align:right;">Iznos bez PDV-a</th></tr>
      ${rows}
    </table>
    <p style="margin:14px 0 0;font-size:14px;text-align:right;">${priced.length ? `Ukupno sa PDV-om: <b>${amount(o.grossTotal)} RSD</b>` : "Iznos još nije utvrđen (sve stavke na upit)."}</p>
    ${onRequest.length ? `<p style="margin:6px 0 0;font-size:12px;color:#666;text-align:right;">${onRequest.length} stavki na upit nije uračunato.</p>` : ""}
    <p style="margin:22px 0 0;font-size:12px;color:#666;">Dugme „Odštampaj porudžbinu“ otvara samo list porudžbine (A4) za prepis u BizniSoft — ne štampa se ovaj mail. Za otvaranje je potrebna prijava u portal.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `Nova porudžbina ${doc} — ${o.customerName}`,
    `Poslato: ${dmyTime(o.submittedAt)} (${o.submittedByName})`,
    `Plaćanje: ${o.paymentOptionLabel ?? "po dogovoru"}`,
    "",
    ...o.lines.map((l) => `${l.articleCode}  ${l.articleName}  ${quantity(l.quantity)} ${l.unit}${l.priceStatus === "cena" ? `  ${amount(l.lineNet)}` : "  na upit"}`),
    "",
    priced.length ? `Ukupno sa PDV-om: ${amount(o.grossTotal)} RSD` : "Iznos još nije utvrđen.",
    "",
    `Odštampaj porudžbinu: ${printUrl}`,
    `Otvori u portalu: ${openUrl}`,
  ].join("\n");

  return { subject, html, text, printUrl };
}
