"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./CarsystemHomePage.module.css";

export type BrandKey =
  | "rm"
  | "carsystem"
  | "baslac"
  | "norbin"
  | "sata"
  | "carfit"
  | "cosmosLac"
  | "befar"
  | "rupes"
  | "yachtcare";

type BrandMonoLogo = {
  /**
   * Jednobojna verzija znaka: koristi se isključivo kao CSS maska, pa boja
   * dolazi iz `currentColor` roditelja. Fajl mora imati stvarno providne
   * izreze (bele površine nisu rupe u alpha maski).
   */
  src: string;
  /** Proporcija viewBox-a (širina / visina), da se znak ne rasteže. */
  aspect: number;
  /** Optička visina u traci brendova, u px, posle uklanjanja praznog prostora. */
  railHeight: number;
  /**
   * `image`: zvaničan znak nema jednobojnu verziju sa providnim izrezima, pa se prikazuje
   * kakav jeste, bez maske i bez izmena.
   */
  kind?: "mask" | "image";
};

type BrandLogo = {
  name: string;
  src?: string;
  width: number;
  height: number;
  mono?: BrandMonoLogo;
};

export const brandLogos: Record<BrandKey, BrandLogo> = {
  rm: {
    name: "R-M",
    src: "/brands/rm.svg",
    width: 140,
    height: 92,
    mono: { src: "/brands/mono/rm.svg", aspect: 100 / 114.5, railHeight: 34 },
  },
  carsystem: {
    name: "Carsystem",
    src: "/brands/carsystem.svg",
    width: 112,
    height: 112,
    // Pun kvadrat sa izrezom slova. Na 26 px natpis „CAR SYSTEM” nije bio čitljiv i znak je bio
    // najslabiji u nizu. Odluka vlasnika 2026-10-15: polazište 34 px, optički usklađeno na 32 px
    // (pun kvadrat je teži od R-M obrisa iste visine; 32 px izjednačava ga sa SATA i Befar poljem).
    mono: { src: "/brands/mono/carsystem.svg", aspect: 1, railHeight: 32 },
  },
  baslac: {
    name: "Baslac",
    src: "/brands/baslac.svg",
    width: 150,
    height: 100,
    mono: { src: "/brands/mono/baslac.svg", aspect: 100 / 67, railHeight: 30 },
  },
  norbin: {
    name: "Norbin",
    src: "/brands/norbin.svg",
    width: 170,
    height: 112,
    mono: { src: "/brands/mono/norbin.svg", aspect: 188 / 68, railHeight: 28 },
  },
  sata: {
    name: "SATA",
    src: "/brands/sata.svg",
    width: 170,
    height: 78,
    mono: { src: "/brands/mono/sata.svg", aspect: 500 / 172, railHeight: 22 },
  },
  carfit: {
    name: "C.A.R.FIT",
    src: "/brands/carfit.svg",
    width: 180,
    height: 70,
    // Zvanični znak uvek nosi i podnaslov „Rebel Flair” (carfitrepair.com nema varijantu bez
    // njega, provera 2026-10-15); znak se ne skraćuje, samo optički izjednačava.
    mono: { src: "/brands/carfit.svg", aspect: 1989.2 / 328.3, railHeight: 17 },
  },
  cosmosLac: {
    name: "Cosmos Lac",
    src: "/brands/cosmos-spray.svg",
    width: 132,
    height: 132,
    mono: { src: "/brands/cosmos-spray.svg", aspect: 131 / 100, railHeight: 32 },
  },
  befar: {
    name: "Befar",
    src: "/brands/befar.svg",
    width: 132,
    height: 70,
    // Traka je jednobojna kao ostali znakovi (odluka vlasnika 2026-10-17): maska iz istog
    // vernog vektora (scripts/trace-befar-logo.py) — puno polje u boji trake, izrezana
    // slova i lice. Meni i Befar stranica zadržavaju crveno-beli znak. Visina = SATA.
    mono: { src: "/brands/mono/befar.svg", aspect: 635 / 192, railHeight: 22 },
  },
  rupes: {
    name: "RUPES",
    width: 132,
    height: 70,
  },
  yachtcare: {
    // Odobren logo fajl ne postoji: naziv se prikazuje tekstom, kao u meniju i futeru.
    name: "Yachtcare",
    width: 132,
    height: 70,
  },
};

/**
 * Traka „Programski brendovi” prati listu brendova iz menija
 * (components/layout/navigation-data.ts → BRAND_LINKS), istim redom, plus Yachtcare,
 * koji je 2026-10-17 izostavljen samo iz menija „Brendovi”.
 * RUPES nije zaseban brend u meniju (deo je Carsystem ponude), pa ga ovde nema.
 */
export const trustBrandKeys: BrandKey[] = [
  "rm",
  "carsystem",
  "baslac",
  "norbin",
  "cosmosLac",
  "befar",
  "carfit",
  "sata",
  "yachtcare",
];

export function BrandLogoPlate({
  brandKey,
  variant = "stack",
  tone = "brand",
}: {
  brandKey: BrandKey;
  variant?: "header" | "rail" | "stack";
  /**
   * `mono` crta znak kao CSS masku u `currentColor` (jedna boja po temi),
   * bez pločice. Uključuje se eksplicitno, samo tamo gde blok to traži;
   * ostali potrošači zadržavaju originalne logotipe u boji.
   */
  tone?: "brand" | "mono";
}) {
  const brand = brandLogos[brandKey];
  const mono = tone === "mono" ? brand.mono : undefined;

  // Jednobojna traka, brend bez odobrenog znaka (Yachtcare): naziv
  // tekstom u istoj boji, bez pločice „Brend u najavi”.
  if (tone === "mono" && !mono) {
    return (
      <span
        className={[
          styles.brandLogoPlate,
          variant === "rail" ? styles.brandRailLogo : "",
          styles.brandLogoPlateMono,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.brandLogoWordmark}>{brand.name}</span>
      </span>
    );
  }

  const className = [
    styles.brandLogoPlate,
    variant === "header" ? styles.headerLogoPlate : "",
    variant === "rail" ? styles.brandRailLogo : "",
    mono ? styles.brandLogoPlateMono : "",
    !brand.src ? styles.brandLogoPending : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (mono?.kind === "image") {
    return (
      <span className={className}>
        <Image
          src={mono.src}
          alt={brand.name}
          width={Math.round(mono.railHeight * mono.aspect)}
          height={mono.railHeight}
          className={styles.brandLogoRailImage}
          style={{ height: mono.railHeight, width: "auto" }}
        />
      </span>
    );
  }

  if (mono) {
    const monoStyle = {
      "--mono-src": `url("${mono.src}")`,
      "--mono-aspect": mono.aspect,
      "--mono-h": `${mono.railHeight}px`,
    } as CSSProperties;

    return (
      <span className={className}>
        <span
          aria-label={brand.name}
          className={styles.brandLogoMonoMark}
          role="img"
          style={monoStyle}
        />
      </span>
    );
  }

  return (
    <span className={className}>
      {brand.src ? (
        <Image
          src={brand.src}
          alt={brand.name}
          width={brand.width}
          height={brand.height}
          className={styles.brandLogoImage}
        />
      ) : (
        <span className={styles.pendingLogoContent}>
          <strong>{brand.name}</strong>
          <small>Brend u najavi</small>
        </span>
      )}
    </span>
  );
}
