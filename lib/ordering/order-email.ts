import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { isAddress, sendMail, SmtpError } from "@/lib/mail/smtp.mjs";
import { amount, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { loadOrderForMail, type OrderDetail } from "@/lib/ordering/ordering-service";

/**
 * Mail o novoj porudžbini (2026-11-11 pregled; 2026-11-12 slanje preko firminog Gmail naloga).
 *
 * Ide komercijalisti kupca i kancelariji (Tamara). U mailu je kratak pregled i dugme
 * „Odštampaj porudžbinu“ koje otvara samo list porudžbine (A4) i odmah pokreće štampu —
 * ne štampa se ceo mail.
 *
 * Kancelarija (Tamara): carsystemirmdoo@gmail.com (odluka vlasnika 2026-11-11); `ORDER_OFFICE_EMAILS`
 * (adrese zarezom) na serveru ga može zameniti.
 */

export const OFFICE_EMAIL = "carsystemirmdoo@gmail.com";

export type OrderEmailRecipient = { name: string; email: string | null; role: "komercijalista" | "kancelarija" };

export async function orderEmailRecipients(customerId: string): Promise<OrderEmailRecipient[]> {
  const reps = await getDb().execute<{ name: string; email: string | null }>(sql`
    SELECT u.name, u.email FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
     WHERE ca.customer_id = ${customerId}::uuid ORDER BY u.name`);
  const office = (process.env.ORDER_OFFICE_EMAILS || OFFICE_EMAIL)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    ...[...reps].map((r) => ({ name: r.name, email: r.email, role: "komercijalista" as const })),
    ...(office.length ? office.map((e) => ({ name: "Kancelarija (Tamara)", email: e, role: "kancelarija" as const })) : [{ name: "Kancelarija (Tamara)", email: null, role: "kancelarija" as const }]),
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
  // U mejlu datum po našem („12.11.2026. u 14:20“), ne „12/11/2026“.
  const when = dmyTime(o.submittedAt).replace(/^(\d{2})\/(\d{2})\/(\d{4}) /, "$1.$2.$3. u ");
  const net = priced.reduce((a, l) => a + (l.lineNet ?? 0), 0);
  const gross = Number(o.grossTotal ?? 0);
  const vat = Math.max(0, gross - net);
  const items = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "stavka" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "stavke" : "stavki"}`;

  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const td = "padding:12px 0;border-bottom:1px solid #ececef;vertical-align:top;font-size:14px;line-height:1.35;";
  const rows = o.lines
    .map(
      (l) => `<tr>
        <td style="${td}">
          <div style="font-weight:600;color:#111;">${esc(l.articleName)}</div>
          <div style="margin-top:3px;font-size:12px;color:#6b6b74;"><span style="font-family:Menlo,Consolas,monospace;">${esc(l.articleCode)}</span>${l.packCount !== null && l.packLabel ? ` · ${l.packCount} × ${esc(l.packLabel)}` : ""}</div>
        </td>
        <td style="${td}text-align:right;white-space:nowrap;padding-left:12px;">${quantity(l.quantity)} ${esc(l.unit)}</td>
        <td style="${td}text-align:right;white-space:nowrap;padding-left:12px;${l.priceStatus === "cena" ? "" : "color:#8a5a00;"}">${l.priceStatus === "cena" ? amount(l.lineNet) : "na upit"}</td>
      </tr>`,
    )
    .join("");

  const meta = (k: string, v: string) =>
    `<tr><td style="padding:3px 18px 3px 0;color:#6b6b74;font-size:13px;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;font-size:14px;color:#111;">${v}</td></tr>`;
  const sum = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:${strong ? 15 : 13}px;color:${strong ? "#111" : "#6b6b74"};${strong ? "font-weight:700;" : ""}">${k}</td><td style="padding:4px 0;text-align:right;font-size:${strong ? 17 : 14}px;color:#111;${strong ? "font-weight:800;" : ""}white-space:nowrap;">${v}</td></tr>`;

  const html = `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f4;${font}color:#111;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.customerName)} · ${esc(items(o.lines.length))}${priced.length ? ` · ${amount(gross)} RSD` : ""}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f4;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
  <tr><td style="background:#111114;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="color:#fff;font-size:15px;font-weight:800;letter-spacing:.06em;">CARSYSTEM <span style="color:#d71920;">I</span> R-M</td>
      <td style="color:#9a9aa3;font-size:12px;text-align:right;letter-spacing:.04em;">POSLOVNI SISTEM</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:#d71920;line-height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:28px 28px 8px;">
    <div style="display:inline-block;background:#fdecec;color:#b3141b;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:5px 12px;">Nova porudžbina · ${esc(doc)}</div>
    <h1 style="margin:14px 0 4px;font-size:24px;line-height:1.2;font-weight:800;color:#111;">${esc(o.customerName)}</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#6b6b74;">${esc(items(o.lines.length))}${priced.length ? ` · <b style="color:#111;">${amount(gross)} RSD</b> sa PDV-om` : ""}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      ${meta("Poslato", `${esc(when)} · ${esc(o.submittedByName)}`)}
      ${meta("Plaćanje", esc(o.paymentOptionLabel ?? "po dogovoru"))}
      ${meta("Isporuka", esc(o.deliveryAddress ?? "redovna adresa kupca"))}
      ${o.customerNote ? meta("Napomena", `<span style="background:#fff7e0;padding:2px 6px;border-radius:4px;">${esc(o.customerNote)}</span>`) : ""}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>
      <td style="background:#d71920;border-radius:8px;"><a href="${esc(printUrl)}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">Odštampaj porudžbinu</a></td>
      <td style="width:10px;"></td>
      <td style="border:1.5px solid #111;border-radius:8px;"><a href="${esc(openUrl)}" style="display:inline-block;padding:12px 18px;color:#111;font-weight:700;font-size:15px;text-decoration:none;">Otvori u portalu</a></td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <th style="padding:0 0 8px;border-bottom:2px solid #111;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b74;text-align:left;">Artikal</th>
        <th style="padding:0 0 8px 12px;border-bottom:2px solid #111;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b74;text-align:right;">Količina</th>
        <th style="padding:0 0 8px 12px;border-bottom:2px solid #111;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b74;text-align:right;">Iznos</th>
      </tr>
      ${rows}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;"><tr><td></td><td style="width:300px;max-width:100%;background:#f6f6f8;border-radius:10px;padding:12px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${priced.length ? `${sum("Osnovica", `${amount(net)} RSD`)}${sum("PDV", `${amount(vat)} RSD`)}${sum("Ukupno", `${amount(gross)} RSD`, true)}` : sum("Iznos", "na upit", true)}
      </table>
      ${onRequest.length ? `<div style="margin-top:6px;font-size:12px;color:#8a5a00;">${esc(items(onRequest.length))} na upit — nije uračunato.</div>` : ""}
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:18px 28px 26px;">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#8b8b94;">„Odštampaj porudžbinu“ otvara samo list porudžbine (A4) za prepis u BizniSoft, ne ceo mejl. Za otvaranje je potrebna prijava u portal.</p>
  </td></tr>
</table>
<p style="margin:14px 0 0;font-size:11px;color:#9a9aa3;">Car System i R-M d.o.o. · Ive Andrića 3, Inđija · carsystemirm.com</p>
</td></tr></table>
</body></html>`;

  const text = [
    `Nova porudžbina ${doc} — ${o.customerName}`,
    `Poslato: ${when} (${o.submittedByName})`,
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

/* =========================================================================
 * Slanje (2026-11-12)
 * ====================================================================== */

/**
 * Gmail firme (carsystemirmdoo@gmail.com) sa LOZINKOM ZA APLIKACIJE — besplatno, bez servisa
 * treće strane. Promenljive na serveru (Vercel, Production):
 *   SMTP_USER       — nalog sa kog se šalje (npr. carsystemirmdoo@gmail.com)
 *   SMTP_PASSWORD   — lozinka za aplikacije (16 slova; razmaci se zanemaruju)
 *   ORDER_EMAILS=1  — automatsko slanje posle svake nove porudžbine (bez nje samo ručno dugme)
 * Opciono: SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), MAIL_FROM_NAME, PUBLIC_BASE_URL,
 * MAIL_REPLY_TO (podrazumevano kancelarija). Šalje se može i sa posebnog naloga samo za slanje
 * (npr. carsystem.portal@gmail.com): odgovor na mejl ipak ide kancelariji.
 */
export function mailConfig() {
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = (process.env.SMTP_PASSWORD ?? "").replace(/\s+/g, "");
  return {
    configured: Boolean(user && pass && isAddress(user)),
    automatic: process.env.ORDER_EMAILS === "1",
    user,
    pass,
    host: (process.env.SMTP_HOST ?? "smtp.gmail.com").trim(),
    port: Number(process.env.SMTP_PORT ?? 465) || 465,
    fromName: (process.env.MAIL_FROM_NAME ?? "Carsystem portal").replace(/[\r\n]/g, " ").slice(0, 60),
    replyTo: (process.env.MAIL_REPLY_TO ?? OFFICE_EMAIL).trim(),
  };
}

export function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || process.env.AUTH_URL || "https://carsystemirm.com").replace(/\/$/, "");
}

export type OrderEmailResult = { ok: boolean; sent: number; text: string };

const SYSTEM_ACTOR = { kind: "system" as const, name: "Portal", role: "sistem" };

/**
 * Šalje mejl o porudžbini komercijalisti kupca i kancelariji. Nikad ne baca grešku: ishod se vraća
 * i beleži u Aktivnosti (bez adresa, lozinke i sadržaja porudžbine).
 */
export async function sendOrderEmail(
  orderId: string,
  opts: { actor?: { id: string; name: string; role: string } | null; reason: "automatski" | "rucno" },
): Promise<OrderEmailResult> {
  const cfg = mailConfig();
  if (!cfg.configured) return { ok: false, sent: 0, text: "Slanje mejla nije podešeno (SMTP_USER i SMTP_PASSWORD na serveru)." };
  const o = await loadOrderForMail(orderId);
  if (!o) return { ok: false, sent: 0, text: "Porudžbina ne postoji." };
  const recipients = await orderEmailRecipients(o.customerId);
  const to = [...new Set(recipients.map((r) => (r.email ?? "").trim().toLowerCase()).filter(isAddress))];
  const actor = opts.actor ? { id: opts.actor.id, name: opts.actor.name, role: opts.actor.role } : SYSTEM_ACTOR;
  const label = o.orderNumber ?? o.requestNumber;
  if (!to.length) return { ok: false, sent: 0, text: "Nema nijedne adrese primaoca." };
  const mail = buildOrderEmail(o, publicBaseUrl());
  try {
    await sendMail(
      { host: cfg.host, port: cfg.port, secure: cfg.port === 465, user: cfg.user, pass: cfg.pass },
      { from: cfg.user, fromName: cfg.fromName, replyTo: isAddress(cfg.replyTo) && cfg.replyTo !== cfg.user ? cfg.replyTo : undefined, to, subject: mail.subject, html: mail.html, text: mail.text },
    );
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.orderEmailSent,
      entityType: "Zahtev za porudžbinu",
      entityId: o.id,
      entityLabel: label,
      after: { primalaca: to.length, nacin: opts.reason },
      reason: null,
    }).catch(() => undefined);
    return { ok: true, sent: to.length, text: `Mejl je poslat (${to.length} ${to.length === 1 ? "primalac" : "primaoca"}).` };
  } catch (error) {
    const code = error instanceof SmtpError ? error.code : "nepoznato";
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.orderEmailFailed,
      entityType: "Zahtev za porudžbinu",
      entityId: o.id,
      entityLabel: label,
      after: { kod: code, nacin: opts.reason },
      reason: null,
    }).catch(() => undefined);
    const why = code === "auth" ? "Gmail je odbio prijavu — proverite lozinku za aplikacije." : code === "rcpt" ? "Gmail je odbio adresu primaoca." : "Veza sa Gmail-om nije uspela.";
    return { ok: false, sent: 0, text: `Mejl nije poslat. ${why}` };
  }
}

/** Posle nove porudžbine: automatski, samo kada je uključeno (ORDER_EMAILS=1) i podešeno. */
export async function sendOrderEmailIfEnabled(orderId: string) {
  const cfg = mailConfig();
  if (!cfg.automatic || !cfg.configured) return;
  await sendOrderEmail(orderId, { reason: "automatski" }).catch(() => undefined);
}
