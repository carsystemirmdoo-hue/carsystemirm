/**
 * Podaci stručnih stranica „Sistemi i programi“ (content/sistemi/*.json).
 *
 * Sadržaj je prenet iz prototipova (2026-10-30) uz pravilo: rečenica sa brojčanom
 * vrednošću ostaje samo ako je vrednost nađena na konkretnoj strani dokumenta
 * proizvođača (`SourceRef`). Delovi koji čekaju stručnu ili poslovnu odluku nisu
 * u ovim fajlovima; spisak je u docs/sistemi/ODLUKE.md.
 */

/** Strana dokumenta proizvođača na kojoj je vrednost nađena (1 = prva strana PDF-a). */
export type SourceRef = { doc: string; strana: number };

export type SistemiIzvor = {
  naziv: string;
  verzija?: string;
  /** Adresa dokumenta kod proizvođača. */
  url?: string;
  /** Kopija dokumenta na sajtu (`/documents/...`), kada postoji. */
  dokument?: string;
};

export type StepVariant = {
  title?: string;
  what?: string;
  detail?: string;
  material?: string;
  products?: string[];
  sources?: SourceRef[];
};

export type SistemiStep = {
  id: string;
  title: string;
  /** Šta se radi — uvek vidljivo. */
  what: string;
  /** Zašto — u delu „Detalji“. */
  detail?: string;
  material?: string;
  /** Izbori (podloge, vrste) na koje se korak odnosi; bez polja važi za sve. */
  only?: string[];
  /** Izmena koraka za pojedini izbor. */
  pod?: Record<string, StepVariant>;
  /** `true` = skala posla sa istim id-jem; tekst = id skale. */
  scale?: boolean | string;
  products?: string[];
  sources?: SourceRef[];
  guides?: string[];
};

export type SistemiJob = {
  id: string;
  label?: string;
  desc?: string;
  title: string;
  lead?: string;
  sources?: SourceRef[];
  choice?: {
    question?: string;
    options: { id: string; label: string; hint?: string; note?: string }[];
  };
  steps: SistemiStep[];
  products?: string[];
  guides?: string[];
};

/** Traka skale: [oznaka, od, do, varijanta]. */
export type ScaleBar = [string, number, number, string?];

export type SistemiScaleItem = {
  id: string;
  name: string;
  text?: string;
  bars?: ScaleBar[];
  pods?: string[];
  source: SourceRef;
};

export type SistemiScale = {
  title?: string;
  question?: string;
  note?: string;
  ticks?: number[];
  tickLabels?: string[];
  unit?: string;
  footer?: string;
  items: SistemiScaleItem[];
};

export type SistemiMaterial = {
  id: string;
  label: string;
  hint?: string;
  title?: string;
  lead?: string;
  rows: { k: string; v: string; sources?: SourceRef[] }[];
  products?: string[];
  guides?: string[];
  sources?: SourceRef[];
};

export type SistemiProblem = {
  title: string;
  symptom?: string;
  causes?: string[];
  check?: string;
  guides?: string[];
  sources?: SourceRef[];
};

export type SistemiContent = {
  program: string;
  jobs: SistemiJob[];
  scales: Record<string, SistemiScale>;
  materials: SistemiMaterial[];
  problems: SistemiProblem[];
};

/* --------------------------------------------------------------------------
 * Razrešeni podaci za prikaz (server → klijent, serijalizovani).
 * ------------------------------------------------------------------------ */

export type ResolvedSource = { label: string; href?: string; strana: number };

export type ResolvedProduct = {
  slug: string;
  name: string;
  brandName: string;
  href: string;
  /** `null` kada slike nema ili pravo prikaza nije potvrđeno. */
  image: { src: string; alt: string } | null;
  typeLabel?: string;
  document?: { title: string; href: string; external: boolean };
};

export type ResolvedGuide = { slug: string; title: string; href: string };
