import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import type { AccountActor } from "@/lib/customers/account-service";
import { buildInvitationEmail } from "@/lib/customers/invitationEmail.mjs";
import { EMAILED_INVITATION_TTL_MS, issueInvitation } from "@/lib/customers/invitation-service";
import { isAddress, sendMail, SmtpError } from "@/lib/mail/smtp.mjs";
import { mailConfig, publicBaseUrl } from "@/lib/ordering/order-email";

/**
 * Pozivnica mejlom (2026-11-14). Izdaje poziv kroz ISTU kapiju kao ručni poziv (firma povezana,
 * osoba potvrđena), ali sa rokom od 7 dana, i šalje ga sa firminog naloga (lib/mail/smtp.mjs,
 * bez provajdera — COST_CONTROL). Link postoji samo u mejlu: ne vraća se pozivaocu, ne beleži se
 * u trag, outbox ni dnevnik. Uspešno slanje označava outbox stavku kao `sent`.
 */
export type InvitationEmailResult = { ok: true; text: string } | { ok: false; text: string };

export async function sendInvitationEmail(
  accountId: string,
  actor: AccountActor,
  options: { reason?: string } = {},
): Promise<InvitationEmailResult> {
  const cfg = mailConfig();
  if (!cfg.configured) return { ok: false, text: "Slanje mejla nije podešeno na serveru (SMTP_USER / SMTP_PASSWORD)." };

  const db = getDb();
  const [acc] = [
    ...(await db.execute<{ email: string; name: string | null; customer_id: string; customer_name: string }>(sql`
      SELECT cu.email, cu.name, cu.customer_id::text AS customer_id, c.name AS customer_name
        FROM customer_users cu JOIN customers c ON c.id = cu.customer_id
       WHERE cu.id = ${accountId}::uuid`)),
  ];
  if (!acc) return { ok: false, text: "Nalog ne postoji." };
  if (!isAddress(acc.email)) return { ok: false, text: "Adresa e-pošte naloga nije ispravna — ispravite je pre slanja." };
  const reps = [
    ...(await db.execute<{ name: string }>(sql`
      SELECT u.name FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
       WHERE ca.customer_id = ${acc.customer_id}::uuid AND u.active ORDER BY u.name`)),
  ].map((r) => r.name);

  // Baca CustomerAccountError / InvitationBlockedError kada kapija nije prošla — poziva ih radnja.
  const { token, expiresAt } = await issueInvitation(
    { accountId, reason: options.reason ?? "Pozivnica poslata mejlom", ttlMs: EMAILED_INVITATION_TTL_MS },
    actor,
  );

  const base = publicBaseUrl();
  const mail = buildInvitationEmail({
    customerName: acc.customer_name,
    contactName: acc.name,
    email: acc.email,
    repNames: reps,
    activationUrl: `${base}/prijava/kupac/aktivacija?token=${encodeURIComponent(token)}`,
    loginUrl: `${base}/prijava`,
    expiresAt,
  });

  try {
    await sendMail(
      { host: cfg.host, port: cfg.port, secure: cfg.port === 465, user: cfg.user, pass: cfg.pass },
      {
        from: cfg.user,
        fromName: cfg.fromName,
        replyTo: isAddress(cfg.replyTo) && cfg.replyTo !== cfg.user ? cfg.replyTo : undefined,
        to: [acc.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      },
    );
  } catch (error) {
    const code = error instanceof SmtpError ? error.code : "nepoznato";
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.customerInvitationEmailFailed,
      entityType: "Kupčev nalog",
      entityId: accountId,
      entityLabel: acc.customer_name,
      after: { greska: code },
      reason: null,
    }).catch(() => undefined);
    return { ok: false, text: `Mejl nije poslat (${code}). Poziv je izdat, ali kupac ga nije dobio — pokušajte ponovo ili izdajte link ručno.` };
  }

  await db.execute(sql`
    UPDATE customer_message_outbox SET status = 'sent', handed_over_at = now(), handed_over_by = ${actor.id}::uuid
     WHERE customer_user_id = ${accountId}::uuid AND kind = 'invitation' AND status = 'pending'`);
  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.customerInvitationEmailSent,
    entityType: "Kupčev nalog",
    entityId: accountId,
    entityLabel: acc.customer_name,
    after: { rokDana: 7, komercijalista: reps.length > 0 },
    reason: null,
  }).catch(() => undefined);
  return { ok: true, text: `Pozivnica poslata na ${acc.email}; link važi do ${expiresAt.toLocaleString("sr-RS", { timeZone: "Europe/Belgrade" })}.` };
}
