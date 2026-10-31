import { SYSTEM_GROUPS } from "@/components/layout/navigation-data";
import type { SourceRef } from "@/lib/sistemi/types";

export const SISTEMI_HUB_HREF = "/sistemi-i-programi";

/** Sedam stavki menija „Sistemi i programi“, istim redom kao u zaglavlju. */
export function getSistemiPageLinks(): { href: string; title: string }[] {
  return SYSTEM_GROUPS.flatMap((group) => group.links)
    .filter((link) => !link.href.startsWith("/kontakt"))
    .map((link) => ({ href: link.href, title: link.title }));
}

/** Podmeni: pregled celine i sedam stranica. */
export function getSistemiNavLinks(): { href: string; title: string }[] {
  return [{ href: SISTEMI_HUB_HREF, title: "Pregled" }, ...getSistemiPageLinks()];
}

export type SistemiPageCopy = {
  /** Podnaslov ispod naziva iz menija (npr. „Maskiranje, čišćenje i zaštita“). */
  subtitle?: string;
  lead: string;
  jobsTitle: string;
  materialsTitle: string;
  materialsLead: string;
};

export const SISTEMI_PAGE_COPY: Record<string, SistemiPageCopy> = {
  "boje-i-lakovi": {
    lead: "Bazna boja, utapanje i završni lak iz istog sistema. Vrednosti za materijal daje tehnički list proizvoda.",
    jobsTitle: "Šta radite?",
    materialsTitle: "Materijali i alati",
    materialsLead: "Šta se koristi u kom delu posla i šta proveriti u listu.",
  },
  "priprema-i-abrazivi": {
    lead: "Priprema podloge pre punioca, bazne boje i laka. Granulacije i vreme sušenja dolaze iz tehničkog lista materijala.",
    jobsTitle: "Šta radite?",
    materialsTitle: "Izbor abraziva",
    materialsLead: "Diskovi, blokovi, flis i paste za matiranje: kada se koristi koji.",
  },
  "pistolji-i-oprema": {
    lead: "Izbor dizne, podešavanje, čišćenje i otklanjanje grešaka pištolja. Diznu i pritisak za materijal daje tabela za nanošenje u tehničkom listu.",
    jobsTitle: "Šta radite?",
    materialsTitle: "Oprema uz pištolj",
    materialsLead: "Čaše, vazduh i čišćenje: šta je deo sistema i na šta paziti.",
  },
  poliranje: {
    lead: "Poliranje novog i starog laka, hologrami i mat lak. Redosled pasta i sunđera prati ono što proizvođač navodi za svaki korak.",
    jobsTitle: "Šta radite?",
    materialsTitle: "Paste, sunđeri i mašine",
    materialsLead: "Šta ide u abrazivni, a šta u završni korak.",
  },
  "potrosni-materijal": {
    subtitle: "Maskiranje, čišćenje i zaštita",
    lead: "Trake, folije, papir i odmašćivači za pripremu vozila pre lakiranja. Granice temperature i namenu daje tehnički list proizvoda.",
    jobsTitle: "Šta radite?",
    materialsTitle: "Izbor materijala",
    materialsLead: "Trake, folije i papir, sredstva za čišćenje i zaštita vozila.",
  },
};

/**
 * Pregled sistema boja na stranici „Boje i lakovi“. Samo sistemi čiji su proizvodi u
 * katalogu sajta; namena je navedena samo kada je nađena u tehničkom listu (izvor, strana).
 */
export type PaintSystem = {
  name: string;
  brand: string;
  /** Kartica u katalogu: porodica ili predstavnički proizvod. */
  href: string;
  /** Proizvodi koji se broje uz sistem (prefiks naziva u katalogu). */
  match: { brandSlug: string; namePattern: RegExp } | { familySlug: string };
  purpose?: { text: string; source: SourceRef };
  documentSource?: string;
};

export const PAINT_SYSTEMS: PaintSystem[] = [
  {
    name: "AGILIS",
    brand: "R-M",
    href: "/proizvodi/rm-agilis",
    match: { brandSlug: "rm", namePattern: /AGILIS/i },
    purpose: {
      text: "Sistem mešanja vodenih baznih boja za reparaturno lakiranje vozila; recepture za jednobojne, metalik i biserne nijanse.",
      source: { doc: "rm-agilis-tds", strana: 1 },
    },
  },
  {
    name: "ONYX HD",
    brand: "R-M",
    href: "/proizvodi/rm-onyx-hd",
    match: { brandSlug: "rm", namePattern: /ONYX/i },
    purpose: {
      text: "Sistem mešanja vodenih baznih boja za reparaturno lakiranje vozila; recepture za jednobojne, metalik i biserne nijanse.",
      source: { doc: "rm-onyx-hd-tds", strana: 1 },
    },
  },
  {
    name: "DIAMONT",
    brand: "R-M",
    href: "/proizvodi/rm-diamont-bazna-boja",
    match: { brandSlug: "rm", namePattern: /DIAMONT/i },
    purpose: {
      text: "Bazne boje za popravku sistema bazna boja / bezbojni lak: metalik, biserne i jednobojne nijanse.",
      source: { doc: "rm-diamont-tds", strana: 1 },
    },
  },
  {
    name: "UNO HD",
    brand: "R-M",
    href: "/proizvodi/rm-uno-hd",
    match: { brandSlug: "rm", namePattern: /UNO HD/i },
    purpose: {
      text: "Završna boja serije UNO HD za visok sjaj; T 2A55 je vezivo za mešanje serije.",
      source: { doc: "rm-t2a55-tds", strana: 1 },
    },
  },
  {
    name: "Basecoat 45",
    brand: "baslac",
    href: "/proizvodi/grupa/baslac-line-45",
    match: { familySlug: "baslac-line-45" },
    purpose: {
      text: "Vodena bazna boja za metalik i jednobojne nijanse, u sistemu bazna boja / bezbojni lak.",
      source: { doc: "baslac-45-line-tds", strana: 1 },
    },
  },
  {
    name: "Basecoat 35",
    brand: "baslac",
    href: "/proizvodi/grupa/baslac-line-35",
    match: { familySlug: "baslac-line-35" },
    purpose: {
      text: "Bazna boja za jednobojne, metalik i biserne nijanse.",
      source: { doc: "baslac-35-line-tds", strana: 1 },
    },
  },
  {
    name: "Topcoat 30",
    brand: "baslac",
    href: "/proizvodi/grupa/baslac-line-30",
    match: { familySlug: "baslac-line-30" },
    purpose: {
      text: "Završna boja sa direktnim sjajem, velike pokrivne moći.",
      source: { doc: "baslac-30-line-tds", strana: 1 },
    },
  },
  {
    name: "Topcoat 30 CV",
    brand: "baslac",
    href: "/proizvodi/grupa/baslac-line-30-cv",
    match: { familySlug: "baslac-line-30-cv" },
    purpose: {
      text: "Jednoslojna završna boja za pune nijanse, pogodna i za velike površine.",
      source: { doc: "baslac-30-line-cv-tds", strana: 1 },
    },
  },
  {
    name: "N15-020 Clear",
    brand: "Norbin",
    href: "/proizvodi/grupa/norbin-n15-020",
    match: { familySlug: "norbin-n15-020" },
    purpose: {
      text: "2K bezbojni lak za sve bazne boje.",
      source: { doc: "norbin-n15-020-tds", strana: 1 },
    },
  },
  {
    name: "N15-V20 Clear VOC",
    brand: "Norbin",
    href: "/proizvodi/norbin-n15-v20-clear-voc",
    match: { brandSlug: "norbin", namePattern: /N15-V20/ },
    purpose: {
      text: "2K VOC bezbojni lak za sve bazne boje.",
      source: { doc: "norbin-n15-v20-tds", strana: 1 },
    },
  },
];
