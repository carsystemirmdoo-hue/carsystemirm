/**
 * Datumi za prikaz i unos u portalu: vidljivo `dd/mm/yyyy`, interno ISO
 * `yyyy-mm-dd` (isti format koji API i baza koriste i do sada).
 *
 * Sve se radi nad brojevima (godina, mesec, dan) i tekstom — nikad preko
 * `new Date("yyyy-mm-dd")` u lokalnoj zoni. Tako promena prikaza ne može da
 * pomeri datum za dan zbog vremenske zone.
 */

export const MESECI = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];
/** Nedelja počinje ponedeljkom. */
export const DANI_KRATKO = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
export const DANI_PUNO = ["ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota", "nedelja"];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export const prestupna = (g) => (g % 4 === 0 && g % 100 !== 0) || g % 400 === 0;

export function danaUMesecu(g, m) {
  return [31, prestupna(g) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** 0 = ponedeljak … 6 = nedelja (UTC aritmetika, bez lokalne zone). */
export function danUNedelji(g, m, d) {
  return (new Date(Date.UTC(g, m - 1, d)).getUTCDay() + 6) % 7;
}

const dve = (n) => String(n).padStart(2, "0");

export function uIso(g, m, d) {
  return `${String(g).padStart(4, "0")}-${dve(m)}-${dve(d)}`;
}

/** Rastavlja ispravan ISO datum; neispravan → `null`. */
export function izIso(iso) {
  const p = ISO.exec(String(iso ?? ""));
  if (!p) return null;
  const g = Number(p[1]), m = Number(p[2]), d = Number(p[3]);
  if (m < 1 || m > 12 || d < 1 || d > danaUMesecu(g, m)) return null;
  return { g, m, d };
}

/** ISO → `dd/mm/yyyy` (prazan string za prazno/neispravno). */
export function uPrikaz(iso) {
  const x = izIso(iso);
  return x ? `${dve(x.d)}/${dve(x.m)}/${x.g}` : "";
}

export const GODINA_MIN = 1990;
export const GODINA_MAX = 2100;

/**
 * Vidljiv unos → ISO.
 *
 * Prihvata `07/10/2026`, `7/10/2026`, `7.10.2026.`, `07-10-2026` i `07102026`.
 * @returns {{ iso: string } | { iso: null, greska: "prazno" | "nepotpuno" | "nepostojeci" }}
 */
export function izUnosa(tekst) {
  const t = String(tekst ?? "").trim().replace(/\.$/, "");
  if (t === "") return { iso: null, greska: "prazno" };
  let d, m, g;
  const delovi = t.split(/[/.\-\s]+/).filter(Boolean);
  if (delovi.length === 3) {
    [d, m, g] = delovi;
  } else if (delovi.length === 1 && /^\d{8}$/.test(delovi[0])) {
    d = t.slice(0, 2); m = t.slice(2, 4); g = t.slice(4, 8);
  } else {
    return { iso: null, greska: "nepotpuno" };
  }
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(g)) {
    return { iso: null, greska: "nepotpuno" };
  }
  const dn = Number(d), mn = Number(m), gn = Number(g);
  if (gn < GODINA_MIN || gn > GODINA_MAX || mn < 1 || mn > 12 || dn < 1 || dn > danaUMesecu(gn, mn)) {
    return { iso: null, greska: "nepostojeci" };
  }
  return { iso: uIso(gn, mn, dn) };
}

/**
 * Automatske kose crte dok se kuca.
 *
 * Radi nad CIFRAMA: kosa crta se dodaje posle dana i meseca. Pri brisanju se
 * kosa crta na kraju ne vraća (inače bi Backspace „zapinjao"). Upisan separator
 * (`.`, `-`, `/`) posle jedne cifre zatvara deo: `7/` → `07/`.
 *
 * @param {string} sirovo  vrednost polja posle izmene
 * @param {boolean} brisanje  da li je izmena bila brisanje
 * @returns {string}
 */
export function formatirajUnos(sirovo, brisanje = false) {
  const t = String(sirovo ?? "").replace(/[.\-\s]/g, "/");
  const delovi = [];
  let tekuci = "";
  for (const ch of t) {
    if (/\d/.test(ch)) {
      tekuci += ch;
      const max = delovi.length < 2 ? 2 : 4;
      if (tekuci.length === max && delovi.length < 2) {
        delovi.push(tekuci);
        tekuci = "";
      } else if (tekuci.length > max) {
        tekuci = tekuci.slice(0, max);
      }
    } else if (ch === "/" && delovi.length < 2 && tekuci.length > 0) {
      delovi.push(tekuci.padStart(2, "0"));
      tekuci = "";
    }
  }
  if (delovi.length === 2) tekuci = tekuci.slice(0, 4);
  let izlaz = delovi.join("/");
  if (delovi.length > 0 && (tekuci.length > 0 || !brisanje)) izlaz += "/";
  izlaz += tekuci;
  // Kosa crta na samom kraju posle brisanja se uklanja.
  if (brisanje) izlaz = izlaz.replace(/\/$/, "");
  return izlaz.slice(0, 10);
}

/** Pozicija kursora: posle istog broja cifara kao pre formatiranja. */
export function kursorPosle(tekst, brojCifara) {
  if (brojCifara <= 0) return 0;
  let n = 0;
  for (let i = 0; i < tekst.length; i += 1) {
    if (/\d/.test(tekst[i])) n += 1;
    if (n === brojCifara) {
      // Ako odmah sledi kosa crta, kursor ide posle nje (nastavak kucanja).
      return tekst[i + 1] === "/" ? i + 2 : i + 1;
    }
  }
  return tekst.length;
}

/** Današnji datum u Beogradu kao brojevi. */
export function danasBeograd(sada = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(sada);
  const v = (t) => Number(p.find((x) => x.type === t)?.value);
  return { g: v("year"), m: v("month"), d: v("day") };
}

/**
 * Prečice za period. Vraća ISO granice (obe uključene) ili prazno za „Sve vreme".
 * @param {"ovaj_mesec" | "prethodni_mesec" | "ova_godina" | "sve"} kod
 */
export function precica(kod, danas) {
  const { g, m } = danas;
  if (kod === "ovaj_mesec") return { od: uIso(g, m, 1), do: uIso(g, m, danaUMesecu(g, m)) };
  if (kod === "prethodni_mesec") {
    const pg = m === 1 ? g - 1 : g;
    const pm = m === 1 ? 12 : m - 1;
    return { od: uIso(pg, pm, 1), do: uIso(pg, pm, danaUMesecu(pg, pm)) };
  }
  if (kod === "ova_godina") return { od: uIso(g, 1, 1), do: uIso(g, 12, 31) };
  return { od: "", do: "" };
}

/** Polja meseca za kalendar: `null` za prazna mesta pre prvog dana (ponedeljak prvi). */
export function mrezaMeseca(g, m) {
  const prazno = danUNedelji(g, m, 1);
  const n = danaUMesecu(g, m);
  const polja = Array.from({ length: prazno }, () => null);
  for (let d = 1; d <= n; d += 1) polja.push(d);
  while (polja.length % 7 !== 0) polja.push(null);
  return polja;
}

/** Pomeranje dana/meseca/godine, sa ograničenjem dana na dužinu meseca. */
export function pomeri({ g, m, d }, dana = 0, meseci = 0) {
  if (meseci !== 0) {
    const ukupno = g * 12 + (m - 1) + meseci;
    const ng = Math.floor(ukupno / 12);
    const nm = (ukupno % 12) + 1;
    return { g: ng, m: nm, d: Math.min(d, danaUMesecu(ng, nm)) };
  }
  const t = new Date(Date.UTC(g, m - 1, d + dana));
  return { g: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
