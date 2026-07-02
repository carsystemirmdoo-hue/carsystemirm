"use client";

import Image from "next/image";
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

type BrandLogo = {
  name: string;
  src?: string;
  width: number;
  height: number;
};

export const brandLogos: Record<BrandKey, BrandLogo> = {
  rm: {
    name: "R-M",
    src: "/brands/rm.svg",
    width: 140,
    height: 92,
  },
  carsystem: {
    name: "Carsystem",
    src: "/brands/carsystem.svg",
    width: 112,
    height: 112,
  },
  baslac: {
    name: "Baslac",
    src: "/brands/baslac.svg",
    width: 150,
    height: 100,
  },
  norbin: {
    name: "Norbin",
    src: "/brands/norbin.svg",
    width: 170,
    height: 112,
  },
  sata: {
    name: "SATA",
    src: "/brands/sata.svg",
    width: 170,
    height: 78,
  },
  carfit: {
    name: "Car Fit",
    src: "/brands/carfit.svg",
    width: 180,
    height: 70,
  },
  cosmosLac: {
    name: "Cosmos Lac",
    src: "/brands/cosmos-spray.svg",
    width: 132,
    height: 132,
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
}: {
  brandKey: BrandKey;
  variant?: "header" | "rail" | "stack";
}) {
  const brand = brandLogos[brandKey];
  const className = [
    styles.brandLogoPlate,
    variant === "header" ? styles.headerLogoPlate : "",
    variant === "rail" ? styles.brandRailLogo : "",
    !brand.src ? styles.brandLogoPending : "",
  ]
    .filter(Boolean)
    .join(" ");

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
