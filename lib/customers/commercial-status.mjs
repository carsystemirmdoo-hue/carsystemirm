/**
 * Poseban poslovni status kupca (0042) — čista pravila, bez baze.
 *
 * Status ne briše ništa: fakture, partner i ranije odobrena pravila ostaju.
 * Menja samo šta portal SME da uradi automatski.
 */
export const COMMERCIAL_STATUSES = Object.freeze({
  redovan: "Redovan",
  van_pripreme_portala: "Van pripreme za portal (fakturisanje za druge)",
  kompenzacija: "Kompenzacija / međusobno prebijanje",
  retka_saradnja: "Retka ili nova saradnja",
  uslovi_placanja: "Rabat zavisi od roka plaćanja",
  poseban_dogovor: "Individualni dogovor",
});

/** Kupac se NE priprema za portal: nema naloga, nema automatskog formiranja cena. */
export const NOT_PREPARED = Object.freeze(["van_pripreme_portala", "retka_saradnja"]);

/**
 * Iz istorije se ništa ne izvodi automatski (ni direktno, ni izvedeno, ni grupe):
 * uslovi zavise od nečega što fakture ne pokazuju (prebijanje, treća lica, rok),
 * pa bi svaki „obrazac“ bio izmišljen. Ranije odobrena pravila ostaju vidljiva kao poseban slučaj.
 */
export const NO_AUTOMATIC = Object.freeze(["van_pripreme_portala", "kompenzacija", "retka_saradnja", "uslovi_placanja", "poseban_dogovor"]);

export function isPreparedForPortal(status) {
  return !NOT_PREPARED.includes(status ?? "redovan");
}

export function allowsAutomaticRebates(status) {
  return !NO_AUTOMATIC.includes(status ?? "redovan");
}

export function statusReason(status) {
  switch (status) {
    case "van_pripreme_portala": return "kupac van pripreme za portal — istorija nije jedan dogovor (fakturisanje za druge)";
    case "kompenzacija": return "uslovi zavise od međusobnog prebijanja — samo ručni pregled";
    case "retka_saradnja": return "retka saradnja — novi uslovi ostaju prazni";
    case "uslovi_placanja": return "uslov izveden iz roka plaćanja — za potvrdu";
    case "poseban_dogovor": return "individualni dogovor — ručni pregled";
    default: return null;
  }
}
