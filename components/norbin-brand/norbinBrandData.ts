import type { BrandSectionNavItem } from "@/components/brand/BrandSectionNav";

export const norbinSectionNavItems: BrandSectionNavItem[] = [
  { label: "Program", href: "#program", sectionId: "program" },
  { label: "Oznake", href: "#kod", sectionId: "kod" },
  { label: "Odnos", href: "#odnos", sectionId: "odnos" },
  { label: "Proces", href: "#proces", sectionId: "proces" },
  { label: "Sivi tonovi", href: "#sivi-tonovi", sectionId: "sivi-tonovi" },
  { label: "Naš program", href: "#nas-program", sectionId: "nas-program" },
  {
    label: "Tehnički podaci",
    href: "#tehnicki-podaci",
    sectionId: "tehnicki-podaci",
  },
  { label: "Dokumentacija", href: "#dokumentacija", sectionId: "dokumentacija" },
  { label: "Poreklo", href: "#poreklo", sectionId: "poreklo" },
];

export const norbinWhatItIs = [
  "2K bezbojni lakovi (clears)",
  "Primer filleri",
  "Plastični prajmer",
  "Kit za karoseriju",
  "Učvršćivači",
  "Razređivač",
  "Sredstvo za odmašćivanje pre lakiranja",
];

export const norbinWhatItIsNot = [
  "Bazna boja",
  "Bezbojni lak u tonu (topcoat sistem boje)",
  "Tinteri / mixing baza",
  "Sopstveni sistem boje",
];

export const norbinCodeFamilies = [
  { prefix: "N15", family: "Bezbojni lak (clear)" },
  { prefix: "N55", family: "Primer filler" },
  { prefix: "N60", family: "Kit za karoseriju" },
  { prefix: "N75", family: "Učvršćivač" },
  { prefix: "N85", family: "Razređivač / dodatak" },
  { prefix: "N95", family: "Sredstvo za odmašćivanje" },
] as const;

export type NorbinRatioRow = {
  base: string;
  baseLabel: string;
  ratio: string;
  partners: { code: string; label: string; stocked: boolean; footnote?: string }[];
  note?: string;
};

export const norbinRatios: NorbinRatioRow[] = [
  {
    base: "N15-020",
    baseLabel: "2K bezbojni lak",
    ratio: "2:1",
    partners: [
      { code: "N75-021", label: "učvršćivač, standard", stocked: true },
      { code: "N75-022", label: "učvršćivač, sporiji", stocked: false },
    ],
  },
  {
    base: "N15-V20",
    baseLabel: "2K bezbojni lak, VOC",
    ratio: "4:1",
    partners: [{ code: "N75-V21", label: "učvršćivač", stocked: false }],
  },
  {
    base: "N15-V25",
    baseLabel: "2K bezbojni lak, VOC",
    ratio: "3:1",
    partners: [
      { code: "N75-V21", label: "učvršćivač", stocked: false },
      { code: "N85-021", label: "razređivač", stocked: false },
    ],
  },
  {
    base: "N55-V20",
    baseLabel: "Primer filler, tamno sivi",
    ratio: "5:1:1",
    partners: [
      { code: "N75-020", label: "učvršćivač", stocked: false },
      { code: "N85-021", label: "razređivač", stocked: false },
    ],
    note: "Proizvođačev opseg — mi vodimo učvršćivač N75-020, ne i sam filler.",
  },
  {
    base: "N55-V29",
    baseLabel: "Primer filler, sivo-crni",
    ratio: "5:1",
    partners: [{ code: "N75-020", label: "učvršćivač", stocked: false }],
    note: "Proizvođačev opseg — mi vodimo učvršćivač N75-020, ne i sam filler.",
  },
];

export const norbinProcessSteps = [
  {
    id: "clean",
    label: "Čišćenje",
    detail: "Odmašćivanje pre pripreme površine.",
  },
  {
    id: "fill",
    label: "Punjenje",
    detail: "Primer filler prema podlozi i neravnini.",
  },
  {
    id: "primer",
    label: "Prajmer",
    detail: "Priprema površine pre boje.",
  },
  {
    id: "color",
    label: "Boja",
    detail: "Vaš sistem boje — Norbin ovde nema proizvod.",
    empty: true,
  },
  {
    id: "clear",
    label: "Bezbojni lak",
    detail: "N15 serija zatvara proces.",
  },
] as const;

export const norbinGreyShades = [
  { id: "v20", label: "N55-V20", detail: "tamno sivi", position: 0 },
  { id: "mid", label: "50 / 50", detail: "prelazni ton", position: 50 },
  { id: "v29", label: "N55-V29", detail: "sivo-crni", position: 100 },
] as const;

export const norbinFaq = [
  {
    question: "Koji učvršćivač ide uz Norbin N15-020?",
    answer:
      "N75-021 (standardni) ili N75-022 (sporiji), u odnosu 2:1 prema tehničkom listu.",
  },
  {
    question: "Ima li Norbin baznu boju?",
    answer: "Ne, u EMEA programu Norbin ne uključuje sistem baznih boja.",
  },
  {
    question: "Koja je razlika između N15-020 i N15-V20?",
    answer:
      "Različit VOC režim, različit učvršćivač i različit odnos mešanja — N15-020 ide 2:1 sa N75-021/022, N15-V20 ide 4:1 sa N75-V21.",
  },
] as const;
