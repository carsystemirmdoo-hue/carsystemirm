/**
 * Kontakt centrale — jedini izvor za footer, kontakt stranu, početnu i PDP.
 *
 * Vrednost `null` znači „nije potvrđeno": potrošači tada izostavljaju red ili
 * poziv, a ne prikazuju izmišljen broj ili radno vreme. Otvorena pitanja i
 * kandidati iz javnih izvora: docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md
 * (GAP-001 telefon, GAP-002 e-pošta, GAP-003 radno vreme).
 */
export type CompanyContact = {
  name: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  country: string;
  locationLabel: string;
  phone: string | null;
  phoneHref: string | null;
  email: string;
  emailHref: string;
  workingHours: string | null;
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
  // Raniji „+381 22 000 000" bio je šablon; javni izvori daju tri različita
  // broja, pa se broj ne prikazuje dok ga vlasnik ne potvrdi (GAP-001).
  phone: null,
  phoneHref: null,
  // Na domenu firme, ali postojanje sandučeta nije potvrđeno (GAP-002).
  email: "office@carsystemirm.com",
  emailHref: "mailto:office@carsystemirm.com",
  // Nijedan izvor ne potvrđuje radno vreme (GAP-003).
  workingHours: null,
  partnerNetworkNote:
    "Upiti se rutiraju ka centrali u Inđiji i partnerskoj mreži u Srbiji.",
  editableNote:
    "Kontakt za upite i rutiranje partnerske mreže u Srbiji.",
};
