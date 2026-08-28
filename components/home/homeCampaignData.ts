import { baslacCampaignSlides } from "@/components/baslac-brand/baslacBrandData";
import { rmCampaignSlides } from "@/components/rm-brand/rmBrandData";

/**
 * Homepage kampanjski slajdovi.
 *
 * Tekst i CTA se preuzimaju iz postojećih, potvrđenih brend podataka — ovde se
 * ne uvode nove tvrdnje o brendovima. Slike se ponovo koriste sa brend
 * stranica gde postoje (bez dupliranja binarnih fajlova); samo Carsystem slajd
 * ima svoje izvedenice, jer izvor je 1.8 MB PNG koji nije za LCP.
 */

export type HomeCampaignSlideId =
  | "carsystem"
  | "baslac-20-years"
  | "rm-agilis"
  | "rm-refinity";

export type HomeCampaignSlide = {
  id: HomeCampaignSlideId;
  brand: string;
  /**
   * `photo` — full-bleed fotografija sa gradijentom radi čitljivosti.
   * `artwork` — providni foreground sloj nad kontrolisanom tamnom površinom.
   */
  visual: "photo" | "artwork";
  desktopImage: string;
  mobileImage: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  mobileImageWidth: number;
  mobileImageHeight: number;
  /** `object-position` za desktop i mobilni kadar. */
  focalPointDesktop: string;
  focalPointMobile: string;
  textAlign: "left";
  /** Kontrast teksta je fiksiran po slajdu, ne izveden iz slike. */
  textTheme: "on-dark";
  gradientDirection: "to-right" | "none";
  /** Dominantna boja pozadine — sprečava beli blink pre dekodiranja slike. */
  backgroundColor: string;
  accentColor: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  controlLabel: string;
  /** Statička paleta tranzicije, ručno definisana po kampanji. */
  transitionFrom: string;
  transitionTo: string;
  progressColor: string;
  controlTheme: "on-dark" | "on-light";
};

const rmAgilis = rmCampaignSlides.find(
  (slide) => slide.id === "agilis-performance",
);
const rmRefinity = rmCampaignSlides.find((slide) => slide.id === "refinity");
const baslacJubilee = baslacCampaignSlides.find(
  (slide) => slide.id === "20-years",
);

if (!rmAgilis || !rmRefinity || !baslacJubilee) {
  throw new Error(
    "Homepage kampanja očekuje postojeće R-M AGILIS, R-M REFINITY i Baslac 20 godina slajdove.",
  );
}

export const homeCampaignSlides: HomeCampaignSlide[] = [
  {
    id: "carsystem",
    brand: "Carsystem",
    visual: "photo",
    desktopImage:
      "/images/home/campaign/carsystem-home-campaign-brand-desktop.webp",
    mobileImage:
      "/images/home/campaign/carsystem-home-campaign-brand-mobile.webp",
    imageAlt:
      "Lakirer u zaštitnoj opremi nanosi boju na karoserijski panel u profesionalnoj lakirnici",
    imageWidth: 1672,
    imageHeight: 941,
    mobileImageWidth: 1255,
    mobileImageHeight: 941,
    focalPointDesktop: "60% 45%",
    focalPointMobile: "62% 42%",
    textAlign: "left",
    textTheme: "on-dark",
    gradientDirection: "to-right",
    backgroundColor: "#0b0e12",
    accentColor: "#e0242c",
    eyebrow: "Carsystem i R-M Inđija, Srbija",
    // Kraci naslov kampanje; stabilan naslov strane stoji iznad carousela.
    title: "Boje, lakovi, priprema i oprema na jednom mestu.",
    description:
      "Distribucija boja, lakova, pripremnih materijala i opreme za lakirnice, uz tehničku podršku i partnersku mrežu u Srbiji i regionu.",
    primaryCta: { href: "/prodavnice", label: "Pronađite prodavnicu" },
    controlLabel: "Carsystem",
    transitionFrom: "#0b0e12",
    transitionTo: "#3a0d10",
    progressColor: "#e0242c",
    controlTheme: "on-dark",
  },
  {
    id: "baslac-20-years",
    brand: "Baslac",
    visual: "artwork",
    desktopImage: baslacJubilee.desktopImage,
    mobileImage: baslacJubilee.mobileImage,
    imageAlt: baslacJubilee.imageAlt,
    imageWidth: baslacJubilee.imageWidth,
    imageHeight: baslacJubilee.imageHeight,
    mobileImageWidth: baslacJubilee.mobileImageWidth,
    mobileImageHeight: baslacJubilee.mobileImageHeight,
    focalPointDesktop: "center right",
    focalPointMobile: "right center",
    textAlign: "left",
    textTheme: "on-dark",
    gradientDirection: "none",
    backgroundColor: "#060d10",
    accentColor: "#29a3dc",
    eyebrow: baslacJubilee.eyebrow,
    title: baslacJubilee.title,
    description: baslacJubilee.description,
    primaryCta: { href: "/brendovi/baslac", label: "Upoznajte Baslac" },
    controlLabel: "Baslac 20",
    transitionFrom: "#04090c",
    transitionTo: "#1d7fb0",
    progressColor: "#29a3dc",
    controlTheme: "on-dark",
  },
  {
    id: "rm-agilis",
    brand: "R-M",
    visual: "photo",
    desktopImage: rmAgilis.desktopImage,
    mobileImage: rmAgilis.mobileImage,
    imageAlt: rmAgilis.imageAlt,
    imageWidth: 1672,
    imageHeight: 941,
    mobileImageWidth: 1448,
    mobileImageHeight: 1086,
    focalPointDesktop: "62% 50%",
    focalPointMobile: "58% 50%",
    textAlign: "left",
    textTheme: "on-dark",
    gradientDirection: "to-right",
    backgroundColor: "#08120f",
    accentColor: "#e0242c",
    eyebrow: rmAgilis.eyebrow,
    title: rmAgilis.title,
    description: rmAgilis.description,
    primaryCta: {
      href: rmAgilis.primaryCta.href,
      label: rmAgilis.primaryCta.label,
    },
    controlLabel: "R-M AGILIS",
    transitionFrom: "#06140f",
    transitionTo: "#1f7a52",
    progressColor: "#8ee06a",
    controlTheme: "on-dark",
  },
  {
    id: "rm-refinity",
    brand: "R-M",
    visual: "photo",
    desktopImage: rmRefinity.desktopImage,
    mobileImage: rmRefinity.mobileImage,
    imageAlt: rmRefinity.imageAlt,
    imageWidth: 1600,
    imageHeight: 900,
    mobileImageWidth: 960,
    mobileImageHeight: 720,
    focalPointDesktop: "64% 46%",
    focalPointMobile: "62% 44%",
    textAlign: "left",
    textTheme: "on-dark",
    gradientDirection: "to-right",
    backgroundColor: "#07101a",
    accentColor: "#3fb6e8",
    eyebrow: rmRefinity.eyebrow,
    title: rmRefinity.title,
    description: rmRefinity.description,
    // Anchor `#refinity` postoji na R-M brend stranici (RmBrandPage.tsx).
    primaryCta: { href: "/brendovi/rm#refinity", label: "Otkrijte Refinity" },
    controlLabel: "R-M REFINITY",
    transitionFrom: "#070d1c",
    transitionTo: "#2b2f8f",
    progressColor: "#7b5cf0",
    controlTheme: "on-dark",
  },
];
