/**
 * Kontakt centrale — jedini izvor za footer, kontakt stranu, početnu, PDP,
 * brend strane i schema.org `Organization`.
 *
 * Telefon kancelarije, glavna e-pošta i regionalni brojevi komercijalista su
 * direktno potvrđeni od firme (2026-10-01, docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md
 * GAP-001 i GAP-002). Vrednost `null` znači „nije potvrđeno": potrošači tada
 * izostavljaju red, a ne prikazuju izmišljen podatak (GAP-004 radno vreme).
 *
 * Prikaz je u domaćem obliku („022 558 501"); `tel:` je uvek međunarodni
 * oblik bez razmaka („tel:+38122558501").
 */
/**
 * `tel:` u međunarodnom mašinskom obliku iz domaćeg zapisa.
 * Polje sa više brojeva („011 386 33 60 / 063 528 477") daje link za prvi broj.
 * Vraća null kada zapis nije prepoznatljiv srpski broj.
 */
export function toTelHref(phone: string): string | null {
  const first = phone.split("/")[0] ?? "";
  const digits = first.replace(/[^\d+]/g, "");
  let international: string;
  if (digits.startsWith("+381")) international = digits;
  else if (digits.startsWith("00381")) international = `+${digits.slice(2)}`;
  else if (digits.startsWith("381")) international = `+${digits}`;
  else if (digits.startsWith("0")) international = `+381${digits.slice(1)}`;
  else return null;
  return /^\+381\d{8,9}$/.test(international) ? `tel:${international}` : null;
}

export type SalesContact = {
  /** Region koji komercijalista pokriva; ime osobe se namerno ne prikazuje. */
  region: string;
  phone: string;
  phoneInternational: string;
  phoneHref: string;
};

export type CompanyContact = {
  name: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  country: string;
  locationLabel: string;
  /** Telefon kancelarije — glavni broj na svim stranama i u CTA dugmadima. */
  phone: string | null;
  phoneInternational: string | null;
  phoneHref: string | null;
  email: string;
  emailHref: string;
  workingHours: string | null;
  /** Regionalni komercijalisti — prikazuju se samo na /kontakt. */
  salesContacts: SalesContact[];
  partnerNetworkNote: string;
  editableNote: string;
};

export type CompanyLocation = {
  name: string;
  city: string;
  label: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  dataNote: string;
};

/**
 * Canonical company/headquarters location. Every single-location map
 * (contact teaser, homepage preview) must read coordinates from here —
 * never duplicate lat/lng in components.
 */
export const companyLocation: CompanyLocation = {
  name: "Carsystem i R-M Inđija",
  city: "Inđija",
  label: "Centrala · Inđija",
  coordinates: { lat: 45.0482, lng: 20.0817 },
  dataNote:
    "Koordinate su na nivou grada Inđije; tačka adrese Ive Andrića 3 nije geokodirana ni potvrđena.",
};

export const companyContact: CompanyContact = {
  name: "Carsystem i R-M Inđija",
  // Adresa je saglasna u registru privrednih subjekata, firminom BEX adresaru
  // i spisku partnera na carsystem.org (provereno 2026-10-01).
  streetAddress: "Ive Andrića 3",
  postalCode: "22320",
  city: "Inđija",
  country: "Srbija",
  locationLabel: "Ive Andrića 3, 22320 Inđija, Srbija",
  // Direktna potvrda firme, 2026-10-01 (GAP-001).
  phone: "022 558 501",
  phoneInternational: "+381 22 558 501",
  phoneHref: "tel:+38122558501",
  // Direktna potvrda firme, 2026-10-01 (GAP-002).
  email: "carsystemirmdoo@gmail.com",
  emailHref: "mailto:carsystemirmdoo@gmail.com",
  // Nijedan izvor ne potvrđuje radno vreme (GAP-004).
  workingHours: null,
  // Direktna potvrda firme, 2026-10-01. Regioni nisu dodeljeni prodavnicama:
  // lokator nema proverenu regionalnu klasifikaciju.
  salesContacts: [
    {
      region: "Vojvodina",
      phone: "061 168 8472",
      phoneInternational: "+381 61 168 8472",
      phoneHref: "tel:+381611688472",
    },
    {
      region: "Centralna Srbija",
      phone: "069 333 7401",
      phoneInternational: "+381 69 333 7401",
      phoneHref: "tel:+381693337401",
    },
    {
      region: "Južna Srbija",
      phone: "063 157 8270",
      phoneInternational: "+381 63 157 8270",
      phoneHref: "tel:+381631578270",
    },
  ],
  partnerNetworkNote:
    "Upiti stižu u centralu u Inđiji, a po potrebi se prosleđuju partnerskoj mreži u Srbiji.",
  editableNote:
    "Kontakt za upite i preporuku partnerske prodavnice u Srbiji.",
};
