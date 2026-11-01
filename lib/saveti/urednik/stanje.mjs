/**
 * Pravila uređivanja i objave rubrike „Saveti i vodiči“ (panel, migracija 0058).
 *
 * Čist modul bez baze: servis (lib/saveti/urednik/servis.ts) učita redove, a ovde se računa
 * status, važenje odobrenja, termini i odluka za termin. Isto pravilo koriste panel, javni deo i
 * zakazani posao, a testovi ga proveravaju bez baze (stanje.test.mjs).
 *
 * Pravila (zahtevi vlasnika 15. 10. i 1. 11. 2026):
 *  - svako čuvanje je nova verzija; odobrenje važi za verziju i za naredne verzije ISTOG javnog
 *    sadržaja (isti otisak bez prekida). Izmena teksta, slike ili izvora menja otisak i poništava
 *    odobrenje; izmena samo internih napomena ga ne poništava;
 *  - stručna potvrda je zaseban uslov: članak koji je traži ne može biti odobren dok potvrda
 *    stručnjaka nije upisana za isti sadržaj (isto pravilo lanca kao odobrenje);
 *  - objavljuje se samo odobrena verzija, u trenutku koji vlasnik izabere (vreme Srbije) ili odmah;
 *  - kod objavljenog članka izmene su radna verzija; javni tekst ostaje odobrena verzija dok nova
 *    ne bude odobrena i objavljena (ili povučena).
 */
import { createHash } from "node:crypto";
import { zonedCalendarDate, zonedDateTimeToInstant } from "../vreme.mjs";

/** @typedef {"nacrt"|"za_pregled"|"odobren"|"zakazan"|"objavljen"|"povucen"} SavetiStatus */

export const STATUSI = [
  { key: "nacrt", label: "Nacrt" },
  { key: "za_pregled", label: "Za pregled" },
  { key: "odobren", label: "Odobren" },
  { key: "zakazan", label: "Zakazan" },
  { key: "objavljen", label: "Objavljen" },
  { key: "povucen", label: "Povučen" },
];

/** @type {Record<string, string>} */
export const STATUS_LABEL = Object.fromEntries(STATUSI.map((s) => [s.key, s.label]));

/** Ton oznake statusa u panelu (PortalPrimitives Badge). @type {Record<string, string>} */
export const STATUS_TONE = {
  nacrt: "neutral",
  za_pregled: "warning",
  odobren: "info",
  zakazan: "info",
  objavljen: "success",
  povucen: "danger",
};

/** @type {Record<string, string>} */
export const RADNJA_LABEL = {
  uvezeno: "Uvezeno iz repozitorijuma",
  sacuvano: "Sačuvano",
  poslato_na_pregled: "Poslato na pregled",
  vraceno_na_doradu: "Vraćeno na doradu",
  odobreno: "Odobreno",
  zakazano: "Zakazano",
  otkazano_zakazivanje: "Otkazan termin",
  objavljeno: "Objavljeno po rasporedu",
  objavljene_izmene: "Objavljene izmene",
  povuceno: "Povučeno iz javnog prikaza",
  vracena_verzija: "Vraćena ranija verzija",
  promenjena_adresa: "Promenjena adresa",
  strucno_potvrdjeno: "Upisana stručna potvrda",
  oznaceno_za_strucnu_potvrdu: "Označeno da traži stručnu potvrdu",
};

/** Polja koja vidi javnost — samo ona ulaze u otisak. */
export const JAVNA_POLJA = ["naslov", "metaNaslov", "opis", "telo", "izvori", "podaci", "slikaId", "slikaAlt"];

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Otisak javnog sadržaja verzije (SHA-256, 24 hex znaka). */
export function otisakSadrzaja(verzija) {
  const javno = {};
  for (const key of JAVNA_POLJA) javno[key] = verzija[key] ?? null;
  return createHash("sha256").update(canonical(javno)).digest("hex").slice(0, 24);
}

/**
 * Verzije koje dele javni sadržaj sa poslednjom (od poslednje izmene sadržaja do kraja).
 * @param {{ id: string, broj: number, otisak: string }[]} verzije  rastuće po broju
 */
export function lanacPoslednjeg(verzije) {
  if (!verzije.length) return [];
  const last = verzije[verzije.length - 1];
  const chain = [];
  for (let i = verzije.length - 1; i >= 0 && verzije[i].otisak === last.otisak; i -= 1) chain.unshift(verzije[i]);
  return chain;
}

/**
 * Da li u lancu postoji događaj date radnje koji nije opozvan kasnijim „vraćeno na doradu“.
 * @param {{ verzijaId: string|null, radnja: string, vreme: Date|string, detalji?: any }[]} dogadjaji
 */
function vaziRadnja(chainIds, dogadjaji, radnja) {
  let last = null;
  for (const d of dogadjaji) {
    if (!d.verzijaId || !chainIds.has(d.verzijaId)) continue;
    if (d.radnja === radnja || d.radnja === "vraceno_na_doradu") last = d;
  }
  return last && last.radnja === radnja ? last : null;
}

/**
 * Odobrenje koje važi za poslednju verziju (ili null). Odobrenje beleži otisak; važi samo ako se
 * poklapa sa otiskom poslednje verzije i dato je u neprekinutom lancu istog sadržaja.
 */
export function vazeceOdobrenje(verzije, dogadjaji) {
  const chain = lanacPoslednjeg(verzije);
  if (!chain.length) return null;
  const otisak = chain[chain.length - 1].otisak;
  const ids = new Set(chain.map((v) => v.id));
  const d = vaziRadnja(ids, dogadjaji, "odobreno");
  if (!d || (d.detalji?.otisak && d.detalji.otisak !== otisak)) return null;
  return d;
}

/**
 * Stručna potvrda koja važi za poslednju verziju (ili null): upisana za isti otisak, u
 * neprekinutom lancu istog sadržaja i nije opozvana vraćanjem na doradu.
 */
export function vazecaStrucnaPotvrda(verzije, dogadjaji) {
  const chain = lanacPoslednjeg(verzije);
  if (!chain.length) return null;
  const otisak = chain[chain.length - 1].otisak;
  const d = vaziRadnja(new Set(chain.map((v) => v.id)), dogadjaji, "strucno_potvrdjeno");
  if (!d || (d.detalji?.otisak && d.detalji.otisak !== otisak)) return null;
  return d;
}

/**
 * Javna verzija u trenutku `sada`: termin koji je prošao (a nije otkazan) ima prednost nad
 * ranije objavljenom verzijom — tako je članak javan od izabranog trenutka i pre nego što
 * usklađivanje upiše objavu. Povučen članak je javan samo ako je posle povlačenja ponovo zakazan
 * ili objavljen.
 * @param {{ javnaVerzijaId: string|null, povuceno: Date|string|null }} clanak
 * @param {{ verzijaId: string, termin: Date|string, izvrseno?: Date|string|null } | null} zakazivanje
 */
export function javnaVerzijaU(clanak, zakazivanje, sada = new Date()) {
  if (zakazivanje && !zakazivanje.izvrseno && new Date(zakazivanje.termin).getTime() <= sada.getTime()) {
    return zakazivanje.verzijaId;
  }
  return clanak.javnaVerzijaId && !clanak.povuceno ? clanak.javnaVerzijaId : null;
}

/**
 * Status članka.
 * @param {{
 *   clanak: { javnaVerzijaId: string|null, povuceno: Date|string|null, strucnaPotvrdaPotrebna?: boolean },
 *   verzije: { id: string, broj: number, otisak: string }[],
 *   dogadjaji: { verzijaId: string|null, radnja: string, vreme: any, detalji?: any }[],
 *   zakazivanje?: { verzijaId: string, termin: Date|string, izvrseno?: Date|string|null } | null,
 *   sada?: Date,
 * }} ulaz
 * @returns {{ status: SavetiStatus, radniStatus: SavetiStatus, javno: boolean, imaIzmene: boolean,
 *             radnaVerzijaId: string|null, javnaVerzijaId: string|null, odobrenje: any,
 *             strucnaPotvrda: { potrebna: boolean, vazeca: any }, termin: string|null }}
 */
export function stanjeClanka({ clanak, verzije, dogadjaji, zakazivanje = null, sada = new Date() }) {
  const poslednja = verzije[verzije.length - 1] ?? null;
  const chain = lanacPoslednjeg(verzije);
  const ids = new Set(chain.map((v) => v.id));
  const odobrenje = vazeceOdobrenje(verzije, dogadjaji);
  const naPregledu = vaziRadnja(ids, dogadjaji, "poslato_na_pregled");
  const javnaVerzijaId = javnaVerzijaU(clanak, zakazivanje, sada);
  // Termin koji još čeka (budući); prošao termin je već objava.
  const ceka = zakazivanje && !zakazivanje.izvrseno && javnaVerzijaId !== zakazivanje.verzijaId ? zakazivanje : null;
  const zakazanoZaLanac = ceka && ids.has(ceka.verzijaId) ? ceka : null;

  /** @type {SavetiStatus} */
  let radniStatus = "nacrt";
  if (odobrenje) radniStatus = zakazanoZaLanac ? "zakazan" : "odobren";
  else if (naPregledu) radniStatus = "za_pregled";

  const javna = javnaVerzijaId ? verzije.find((v) => v.id === javnaVerzijaId) : null;
  const javno = Boolean(javna);
  const imaIzmene = Boolean(javna && poslednja && javna.otisak !== poslednja.otisak);

  /** @type {SavetiStatus} */
  let status = radniStatus;
  if (javno) status = "objavljen";
  else if (clanak.povuceno) status = "povucen";

  return {
    status,
    radniStatus: javno && !imaIzmene ? "objavljen" : radniStatus,
    javno,
    imaIzmene,
    radnaVerzijaId: poslednja?.id ?? null,
    javnaVerzijaId,
    odobrenje,
    strucnaPotvrda: {
      potrebna: Boolean(clanak.strucnaPotvrdaPotrebna),
      vazeca: clanak.strucnaPotvrdaPotrebna ? vazecaStrucnaPotvrda(verzije, dogadjaji) : null,
    },
    termin: zakazanoZaLanac ? new Date(zakazanoZaLanac.termin).toISOString() : null,
  };
}

/** Da li članak odgovara filteru statusa (glavni ili radni status — „Za pregled“ nalazi i izmene). */
export function odgovaraFilteru(stanje, filter) {
  if (!filter) return true;
  return stanje.status === filter || stanje.radniStatus === filter;
}

/* ------------------------------------------------------------------ termin */

export const VREMENSKA_ZONA = "Europe/Belgrade";
/** Termin mora biti bar ovoliko u budućnosti (inače se koristi „Objavite odmah“). */
export const MIN_UNAPRED_MS = 60_000;
export const MAX_UNAPRED_DANA = 400;

/**
 * Trenutak objave iz datuma i vremena koje je vlasnik uneo po vremenu Srbije
 * („2026-11-17“, „09:00“). Letnje/zimsko računanje vremena rešava vreme.mjs.
 * @returns {{ ok: true, termin: Date } | { ok: false, razlog: string }}
 */
export function terminIzUnosa(datum, vreme, sada = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum ?? ""))) return { ok: false, razlog: "Unesite datum objave." };
  if (!/^\d{2}:\d{2}$/.test(String(vreme ?? ""))) return { ok: false, razlog: "Unesite vreme objave (sat i minut)." };
  const [h, m] = vreme.split(":").map(Number);
  if (h > 23 || m > 59) return { ok: false, razlog: "Vreme objave nije ispravno." };
  let termin;
  try {
    termin = zonedDateTimeToInstant(datum, vreme, VREMENSKA_ZONA);
  } catch {
    return { ok: false, razlog: "Datum objave nije ispravan." };
  }
  if (Number.isNaN(termin.getTime()) || zonedCalendarDate(termin, VREMENSKA_ZONA) !== datum) {
    return { ok: false, razlog: "Datum objave nije ispravan." };
  }
  if (termin.getTime() < sada.getTime() + MIN_UNAPRED_MS) {
    return { ok: false, razlog: "Izabrani trenutak je prošao ili je za manje od minut. Za objavu sada koristite „Objavite odmah“." };
  }
  if (termin.getTime() > sada.getTime() + MAX_UNAPRED_DANA * 86_400_000) {
    return { ok: false, razlog: `Objava se zakazuje najviše ${MAX_UNAPRED_DANA} dana unapred.` };
  }
  return { ok: true, termin };
}

/* ------------------------------------------------------------------ prikaz vremena */

const FMT = new Intl.DateTimeFormat("sr-Latn-RS", {
  timeZone: "Europe/Belgrade",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** „17. 11. 2026. u 09:00“ po vremenu Srbije. */
export function vremeSrbije(value) {
  if (!value) return "";
  const d = new Date(value);
  const parts = Object.fromEntries(FMT.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.day}. ${parts.month}. ${parts.year}. u ${parts.hour}:${parts.minute}`;
}

export function datumSrbije(value) {
  return zonedCalendarDate(new Date(value));
}

/* ------------------------------------------------------------------ adresa */

export function slugIzNaslova(naslov) {
  return String(naslov)
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

export function ispravanSlug(slug) {
  return typeof slug === "string" && slug.length <= 120 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
