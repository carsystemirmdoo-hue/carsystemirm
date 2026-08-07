import type { FinalReviewMode } from "./paintTakeoverTypes";

export const TAKEOVER_SURFACE_PATH =
  "M-20 330 C280 395 620 360 970 286 C1320 212 1660 124 1940 -20 L1940 1450 L-20 1450Z";

export const LIGHT_COVER_PATH =
  "M-20 -20 H1940 L1940 -20 C1660 124 1320 212 970 286 C620 360 280 395 -20 330Z";

/**
 * Geometrija prelaza. Ove dve konstante su jedini izvor istine i CSS visina
 * sekcije mora da ih prati (`height: (1 + STICKY_TRAVEL_VH) * 100svh`).
 *
 * ENTRY_LEAD_VH  — koliko viewport visina pre pinovanja traje approach faza,
 *                  tj. koliko dugo se ulazak crta još u bloku partnerske mreže.
 * STICKY_TRAVEL_VH — koliko viewport visina sekcija putuje dok je pinovana.
 */
/*
 * ENTRY_LEAD_VH mora biti >= 1: gornja ivica sekcije ulazi u kadar tačno jednu
 * viewport visinu pre pinovanja. Sa kraćim lead-om (probano 0.4) postoji pojas
 * u kome je svetla ploča takeovera već na ekranu, a timeline je još 0 — to je
 * bio "veliki prazan beli prostor" između blokova. Sada se signal pokreće u
 * istom trenutku kada se ploča pojavi, pa praznog kadra nema.
 */
export const ENTRY_LEAD_VH = 1;
export const STICKY_TRAVEL_VH = 0.55;

/**
 * Jedan kontinualni timeline za ceo prelaz poglavlja.
 *
 * Ranija verzija je vozila sve slojeve iz `progress` sekcije takeovera, koji
 * počinje tek kada se sekcija pinuje. Posledica: prethodni blok nije imao
 * nikakav signal, a prvih ~200px pinovanog kadra je bila prazna svetla ploča.
 *
 * Sada `timeline` počinje dok je korisnik još u bloku partnerske mreže
 * (approach faza, udeo ENTRY_SHARE) i nastavlja se kroz sticky kadar. Svi
 * slojevi — uključujući boju headera — su čiste funkcije tog jednog signala,
 * pa ni jedan prelaz ne može da "sevne" nezavisno od skrola.
 *
 * KLJUČNO — brzina timeline-a mora biti ista sa obe strane pina. Approach je
 * ranije bio meren preko cele viewport visine (720px) dok je sticky kadar imao
 * samo 418px za preostalih 82% timeline-a, pa je u trenutku pinovanja brzina
 * skakala ~7.9×. Sve što je tada bilo u toku — pre svega white→dark wipe i
 * chapter signal — završavalo se u ~60px skrola i to je bilo "sevanje".
 *
 * Sada je approach meren preko ENTRY_LEAD_VH, a udeo se izvodi iz izmerenih
 * piksela (vidi `entryShareFor`), pa je d(timeline)/d(px) konstantno.
 */
export const ENTRY_SHARE =
  ENTRY_LEAD_VH / (ENTRY_LEAD_VH + STICKY_TRAVEL_VH);

/**
 * Prozori slojeva, u `timeline` jedinicama (0..1). Pin je na ENTRY_SHARE ≈ 0.645.
 *
 * Raspored prati pravilo: sve što se gleda u PINOVANOM kadru (hero potezi,
 * leva tekst zona) ide posle pina; atmosfera (wipe, chapter) ide pre njega, jer
 * se ona čita i dok je ploča tek delimično u kadru.
 */
export const TIMELINE = {
  /**
   * Painterly potezi u prethodnom bloku (iza mape i kartice). Završavaju se
   * pre pina, tako da je gest dovučen taman kad površina preuzme kadar.
   */
  entryBrush: [0.0, 0.58] as const,
  /**
   * Tamna površina koja preuzima svetlu. Kreće na 0.05 — praktično čim scena
   * uđe u viewport — pa nema faze u kojoj se skroluje kroz praznu belu ploču.
   * Glavni deo prelaza pada na sredinu scene i završava se na 0.70.
   */
  surface: [0.05, 0.7] as const,
  /** Painterly background sloj, ide odmah iza površine da nema rupe. */
  background: [0.3, 0.76] as const,
  /** Leva tekst zona — tek u pinovanom kadru. */
  content: [0.62, 0.8] as const,
  contentMobile: [0.58, 0.76] as const,
  /** Kontrast ispod teksta — malo pre teksta. */
  contrast: [0.58, 0.78] as const,
  /** Chapter signal koji nose header i sekcije ispod. */
  chapter: [0.08, 0.66] as const,
  /** Hero potezi: ceo staggerovani set staje u pinovani kadar. */
  strokes: [0.6, 0.92] as const,
  /** Poslednjih ~10%: kratko smirivanje i prirodan izlazak. */
  hold: [0.9, 1.0] as const,
  /**
   * Izlazak scene. Painterly slojevi (potezi, sprej, color wash) se gase pre
   * kraja sekcije, tako da tamna scena zavrsava kao miran taman kadar.
   *
   * Bez ovoga je poslednji kadar bio artwork u punom intenzitetu, pa su roze
   * i magenta potezi stajali neposredno uz prelaz u svetlu komercijalnu zonu i
   * citali se kao uvodna dekoracija tog bloka. Potez sada pripada iskljucivo
   * tamnoj sceni i nestaje u njoj.
   */
  outro: [0.8, 0.96] as const,
} as const;

/**
 * Pojedinačni prozori poteza, u lokalnoj `strokes` skali. Rasponi su kratki
 * (~0.30) i gušće staggerovani nego ranije (~0.62): svaki potez se povuče kao
 * jedan brz gest, umesto da se svih šest sporo vuku preko celog prozora.
 */
export const LINE_WINDOWS = [
  [0.0, 0.3],
  [0.09, 0.41],
  [0.18, 0.51],
  [0.28, 0.6],
  [0.4, 0.72],
  [0.52, 0.86],
] as const;

/**
 * Udeo approach faze u timeline-u, izveden iz stvarno izmerenih piksela.
 * Time je brzina kontinualna i onda kada se CSS visina sekcije razlikuje od
 * STICKY_TRAVEL_VH (drugi breakpoint, dinamički svh, zaokruživanje).
 */
export function entryShareFor(entryLeadPx: number, stickyRangePx: number) {
  const total = entryLeadPx + stickyRangePx;
  if (total <= 0) return ENTRY_SHARE;
  return clamp(entryLeadPx / total, 0.02, 0.9);
}

/**
 * Prebacuje `approach` (prethodni blok) i `progress` (sticky kadar) u jedan
 * monotoni timeline sa konstantnom brzinom po pikselu skrola.
 */
export function toTimeline(
  approach: number,
  progress: number,
  share: number = ENTRY_SHARE,
) {
  if (progress <= 0) return clamp(approach) * share;
  return share + clamp(progress) * (1 - share);
}

/**
 * Manifest nosi tajminge poteza u staroj `progress` skali (0.105–0.90).
 * Umesto regenerisanja artwork-a, prozor se ovde preslikava u novi, kraći
 * `strokes` prozor — isti redosled i isti karakter, samo življi ulazak.
 */
const MANIFEST_STROKE_RANGE = [0.105, 0.9] as const;

export function remapStrokeWindow(start: number, end: number) {
  const [srcStart, srcEnd] = MANIFEST_STROKE_RANGE;
  const [dstStart, dstEnd] = TIMELINE.strokes;
  const span = srcEnd - srcStart;
  const scale = (dstEnd - dstStart) / span;
  return [
    dstStart + (start - srcStart) * scale,
    dstStart + (end - srcStart) * scale,
  ] as const;
}

export const paintTakeoverReviewModes: Array<{
  mode: FinalReviewMode;
  label: string;
}> = [
  { mode: "final", label: "FINAL" },
  { mode: "background", label: "BACKGROUND ONLY" },
  { mode: "hero-static", label: "HERO STATIC" },
  { mode: "hero-motion", label: "HERO MOTION" },
  { mode: "text-contrast", label: "TEXT CONTRAST" },
  { mode: "mask-debug", label: "MASK DEBUG" },
];

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

export function normalize(progress: number, start: number, end: number) {
  return clamp((progress - start) / Math.max(0.0001, end - start));
}

export function mapProgress(progress: number, start: number, end: number) {
  const normalized = normalize(progress, start, end);
  return normalized * normalized * (3 - 2 * normalized);
}

/**
 * Potez četke ne kreće mekano — kontakt je trenutan, a rep se smiruje. Zato
 * potezi koriste ease-out umesto smoothstep-a: isti prozor skrola deluje
 * osetno življe jer se najveći deo poteza povuče na početku gesta.
 */
export function easeBrushStroke(progress: number) {
  const normalized = clamp(progress);
  return 1 - Math.pow(1 - normalized, 2.2);
}

/** Faze se čitaju u `timeline` skali (approach + sticky kadar). */
export function phaseFor(timeline: number) {
  if (timeline < 0.08) return "Approach";
  if (timeline < 0.25) return "Entry brush (prethodni blok)";
  if (timeline < 0.5) return "White to dark threshold";
  if (timeline < 0.62) return "Primary collision";
  if (timeline < 0.74) return "Secondary brush energy";
  if (timeline < 0.86) return "Spray, splatter and detail";
  if (timeline < 0.96) return "Controlled hold";
  return "Exit preparation";
}

export function clipForGroup(
  progress: number,
  origin: string,
  direction: string,
) {
  const remaining = ((1 - progress) * 100).toFixed(3);

  if (origin === "left" || direction.includes("left-to-right")) {
    return `inset(0 ${remaining}% 0 0)`;
  }
  if (origin === "right" || direction.includes("right-to-left")) {
    return `inset(0 0 0 ${remaining}%)`;
  }
  if (origin === "top" || direction.includes("top-right")) {
    return `inset(0 0 ${remaining}% 0)`;
  }
  if (origin === "bottom" || direction.includes("bottom-left")) {
    return `inset(${remaining}% 0 0 0)`;
  }

  const centered = ((1 - progress) * 46).toFixed(3);
  return `inset(${centered}% ${centered}% ${centered}% ${centered}%)`;
}
