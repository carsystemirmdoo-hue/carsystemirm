/**
 * Da li se uz izabranu posudu PREDLAŽE odgovarajući poklopac (odluka vlasnika 2026-10-13).
 *
 * Predlog je samo ponuda u malom panelu — pribor se nikad ne dodaje u korpu sam.
 * Uslov vlasnika: poklopac se nudi ako je na stanju. Izvor stvarnog stanja zaliha
 * još ne postoji, pa je stanje „nepoznato“; tada predlog ide samo uz izričitu
 * postavku `unknown-ok` (prikaz bez ikakve tvrdnje o stanju). Podrazumevano: ne prikazuje se.
 *
 * Direktno dodavanje samo za potvrđenu ponudu i prodajnu jedinicu (`mode: "dodaj"`); potvrđen kompatibilan
 * pribor bez toga (upit za nabavku, nepotvrđeno pakovanje ili cena) vodi na upit (`mode: "upit"`).
 *
 * @param {{ orderable: boolean; outOfProgramme: boolean; stock: "na_stanju" | "nema" | "nepoznato"; policy: "require" | "unknown-ok" }} input
 * @returns {{ show: boolean; mode: "dodaj" | "upit" | null; reason: string | null }}
 */
export function companionDecision(input) {
  if (input.outOfProgramme) return { show: false, mode: null, reason: "pribor je van programa" };
  if (input.stock === "nema") return { show: false, mode: null, reason: "pribor nije na stanju" };
  if (input.stock !== "na_stanju" && input.policy !== "unknown-ok")
    return { show: false, mode: null, reason: "stanje zaliha nije poznato (izvor zaliha ne postoji)" };
  return input.orderable ? { show: true, mode: "dodaj", reason: null } : { show: true, mode: "upit", reason: "pribor nije u potvrđenoj ponudi za direktno poručivanje" };
}

/** Postavka iz okruženja; sve osim `unknown-ok` znači „samo uz poznato stanje“. */
export function companionStockPolicy(value) {
  return String(value ?? "").trim() === "unknown-ok" ? "unknown-ok" : "require";
}

/** Jedinica pakovanja koja meri osnovu odnosa: zapremina → LIT, masa → KG. Ništa se ne preračunava. */
const BASIS_UNIT = { zapremina: "LIT", masa: "KG" };
const UNIT_WORD = { LIT: "u litrima", KG: "u kilogramima" };

/**
 * Predlog broja pakovanja hertera (samo predlog — kupac upisuje broj i potvrđuje).
 *
 * Predlaže se SAMO kada su potvrđeni: odnos (osnova : herter), osnova odnosa (zapremina ili masa) i
 * pakovanja oba artikla u jedinici te osnove (LIT za zapreminu, KG za masu). Zapremina i masa se ne
 * izjednačavaju; JM komad (npr. limenka 0,5 L vođena kao 1 KOM) ne daje predlog, jer zapremina
 * iz oznake nije potvrđena količina.
 *
 * @param {{ basePacks: number; basePack: { quantity: number; unit: string } | null; companionPack: { quantity: number; unit: string } | null;
 *           ratio: { base: number; companion: number; basis: "zapremina" | "masa" | null } | null }} input
 * @returns {{ packs: number; needed: number; unit: string; reason: null } | { packs: null; needed: null; unit: null; reason: string }}
 */
export function suggestCompanionPacks(input) {
  const none = (reason) => ({ packs: null, needed: null, unit: null, reason });
  const r = input.ratio;
  if (!r || !(r.base > 0) || !(r.companion > 0)) return none("odnos mešanja nije potvrđen");
  if (!r.basis || !BASIS_UNIT[r.basis]) return none("izvor ne navodi da li je odnos po zapremini ili po masi");
  const unit = BASIS_UNIT[r.basis];
  const b = input.basePack;
  const c = input.companionPack;
  if (!b || String(b.unit).toUpperCase() !== unit) return none(`pakovanje osnovnog artikla nije izraženo ${UNIT_WORD[unit]}`);
  if (!c || String(c.unit).toUpperCase() !== unit) return none(`pakovanje hertera nije izraženo ${UNIT_WORD[unit]}`);
  const n = Number(input.basePacks);
  if (!Number.isInteger(n) || n < 1 || !(b.quantity > 0) || !(c.quantity > 0)) return none("broj pakovanja nije ispravan");
  const needed = Math.round(((n * b.quantity * r.companion) / r.base) * 1000) / 1000;
  return { packs: Math.max(1, Math.ceil(needed / c.quantity - 1e-9)), needed, unit, reason: null };
}
