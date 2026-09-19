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
  | "autofit";

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
    mono: { src: "/brands/mono/rm.svg", aspect: 100 / 114.5, railHeight: 42 },
  },
  carsystem: {
    name: "Carsystem",
    src: "/brands/carsystem.svg",
    width: 112,
    height: 112,
    mono: { src: "/brands/mono/carsystem.svg", aspect: 1, railHeight: 40 },
  },
  baslac: {
    name: "Baslac",
    src: "/brands/baslac.svg",
    width: 150,
    height: 100,
    mono: { src: "/brands/mono/baslac.svg", aspect: 100 / 67, railHeight: 36 },
  },
  norbin: {
    name: "Norbin",
    src: "/brands/norbin.svg",
    width: 170,
    height: 112,
    mono: { src: "/brands/mono/norbin.svg", aspect: 188 / 68, railHeight: 34 },
  },
  sata: {
    name: "SATA",
    src: "/brands/sata.svg",
    width: 170,
    height: 78,
    mono: { src: "/brands/mono/sata.svg", aspect: 500 / 172, railHeight: 28 },
  },
  carfit: {
    name: "Car Fit",
    src: "/brands/carfit.svg",
    width: 180,
    height: 70,
    mono: { src: "/brands/carfit.svg", aspect: 1989.2 / 328.3, railHeight: 17 },
  },
  cosmosLac: {
    name: "Cosmos Lac",
    src: "/brands/cosmos-spray.svg",
    width: 132,
    height: 132,
    mono: { src: "/brands/cosmos-spray.svg", aspect: 131 / 100, railHeight: 40 },
  },
  befar: {
    name: "Befar",
    width: 132,
    height: 70,
  },
  rupes: {
    name: "Rupes",
    width: 132,
    height: 70,
  },
  autofit: {
    name: "A.U.T.O. Fit",
    width: 132,
    height: 70,
  },
};

export const trustBrandKeys: BrandKey[] = [
  "rm",
  "carsystem",
  "baslac",
  "norbin",
  "sata",
  "carfit",
  "cosmosLac",
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
  const className = [
    styles.brandLogoPlate,
    variant === "header" ? styles.headerLogoPlate : "",
    variant === "rail" ? styles.brandRailLogo : "",
    mono ? styles.brandLogoPlateMono : "",
    !brand.src ? styles.brandLogoPending : "",
  ]
    .filter(Boolean)
    .join(" ");

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
