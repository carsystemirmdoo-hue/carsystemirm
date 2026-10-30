/**
 * Priprema upita za program za e-poštu posetioca — isti put kao forma na /kontakt.
 *
 * Sajt nema sopstveno slanje poruka: upit se otvara kao nova poruka na adresu firme, a
 * posetilac je šalje iz svog programa. Zato forma nikada ne prikazuje „poslato“; prikazuje
 * da je poruka pripremljena i kako da je pošalje ako se program nije otvorio.
 */

export type InquiryLine = [label: string, value: string];

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export function inquirySubject(topic: string): string {
  return `Upit sa sajta: ${topic}`;
}

export function inquiryBody(topic: string, lines: InquiryLine[], message: string): string {
  return [`Tema: ${topic}`, ...lines.filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value.trim()}`), "", message.trim()]
    .join("\n")
    .trim();
}

export function inquiryMailto(emailHref: string, topic: string, body: string): string {
  return `${emailHref}?subject=${encodeURIComponent(inquirySubject(topic))}&body=${encodeURIComponent(body)}`;
}
