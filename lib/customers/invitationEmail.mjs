/**
 * Pozivni mejl kupcu (2026-11-14): tekst koji je vlasnik odobrio — šta portal nudi, link za
 * postavljanje lozinke (važi 7 dana, jednom), adresa prijave, dodeljeni komercijalista (samo ime)
 * i telefon kancelarije. Čista funkcija: bez baze i bez slanja, da bi se tekst mogao proveriti testom.
 */

export const INVITATION_EMAIL_DAYS = 7;
export const OFFICE_PHONE = "022 558 501";
export const COMPANY_SIGNATURE = "Carsystem i R-M Inđija d.o.o.";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** dd.mm.gggg. u HH:MM po beogradskom vremenu. */
export function belgradeDeadline(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month}.${p.year}. u ${p.hour}:${p.minute}`;
}

/** „Vaš komercijalista je X.“ / „Vaši komercijalisti su X i Y.“ / null kada niko nije dodeljen. */
export function repSentence(names) {
  const n = [...new Set((names ?? []).map((s) => String(s).trim()).filter(Boolean))];
  if (!n.length) return null;
  if (n.length === 1) return `Vaš komercijalista je ${n[0]}.`;
  return `Vaši komercijalisti su ${n.slice(0, -1).join(", ")} i ${n[n.length - 1]}.`;
}

/**
 * @param {{ customerName: string, contactName?: string | null, email: string, repNames?: string[],
 *   activationUrl: string, loginUrl: string, expiresAt: Date }} p
 */
export function buildInvitationEmail(p) {
  const greeting = p.contactName?.trim() ? `Poštovani/a ${p.contactName.trim()},` : "Poštovani,";
  const deadline = belgradeDeadline(p.expiresAt);
  const rep = repSentence(p.repNames);
  const contact = rep
    ? `${rep} Za sva pitanja možete se obratiti svom komercijalisti ili kancelariji — odgovorom na ovaj mejl ili na ${OFFICE_PHONE} (radnim danima 08–16 h).`
    : `Za sva pitanja odgovorite na ovaj mejl ili pozovite kancelariju na ${OFFICE_PHONE} (radnim danima 08–16 h).`;
  const loginLabel = p.loginUrl.replace(/^https?:\/\//, "");
  const subject = "Pristup Carsystem i R-M portalu za Vašu firmu";

  const text = [
    greeting,
    "",
    `za firmu ${p.customerName} otvoren je nalog na portalu Carsystem i R-M. Na portalu možete:`,
    "– da vidite svoje cene i rabate,",
    "– da pošaljete zahtev za porudžbinu,",
    "– da pregledate svoje fakture.",
    "",
    "Da biste počeli, postavite svoju lozinku na ovom linku:",
    p.activationUrl,
    `Link važi ${INVITATION_EMAIL_DAYS} dana (do ${deadline}) i može se iskoristiti samo jednom.`,
    "",
    `Posle toga se prijavljujete na ${loginLabel} sa adresom ${p.email} i svojom lozinkom.`,
    "",
    contact,
    "",
    "Ako niste očekivali ovaj mejl, slobodno ga zanemarite — dok se lozinka ne postavi, nalog ostaje zatvoren.",
    "",
    "Srdačan pozdrav,",
    COMPANY_SIGNATURE,
  ].join("\n");

  const html = `<!doctype html><html lang="sr"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1b1f24;font-size:15px;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px">
<p>${esc(greeting)}</p>
<p>za firmu <strong>${esc(p.customerName)}</strong> otvoren je nalog na portalu Carsystem i R-M. Na portalu možete:</p>
<ul style="padding-left:20px;margin:0 0 16px"><li>da vidite svoje cene i rabate,</li><li>da pošaljete zahtev za porudžbinu,</li><li>da pregledate svoje fakture.</li></ul>
<p>Da biste počeli, postavite svoju lozinku:</p>
<p style="margin:20px 0"><a href="${esc(p.activationUrl)}" style="display:inline-block;background:#c8102e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px">Postavite lozinku</a></p>
<p style="font-size:13px;color:#555">Link važi ${INVITATION_EMAIL_DAYS} dana (do ${esc(deadline)}) i može se iskoristiti samo jednom. Ako dugme ne radi, otvorite ovu adresu:<br><a href="${esc(p.activationUrl)}" style="color:#555;word-break:break-all">${esc(p.activationUrl)}</a></p>
<p>Posle toga se prijavljujete na <a href="${esc(p.loginUrl)}">${esc(loginLabel)}</a> sa adresom <strong>${esc(p.email)}</strong> i svojom lozinkom.</p>
<p>${esc(contact)}</p>
<p style="font-size:13px;color:#555">Ako niste očekivali ovaj mejl, slobodno ga zanemarite — dok se lozinka ne postavi, nalog ostaje zatvoren.</p>
<p>Srdačan pozdrav,<br>${esc(COMPANY_SIGNATURE)}</p>
</div></body></html>`;

  return { subject, text, html };
}
