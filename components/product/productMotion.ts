import type { CSSProperties } from "react";
import type { CarsystemProduct, RefinishPhaseSlug } from "@/lib/carsystem-data";

const brandAccent: Record<string, string> = {
  rm: "oklch(0.58 0.22 27)",
  carsystem: "oklch(0.55 0.075 245)",
  sata: "oklch(0.68 0.12 80)",
  carfit: "oklch(0.58 0.12 145)",
  "cosmos-spray": "oklch(0.62 0.12 305)",
  baslac: "oklch(0.58 0.16 35)",
  norbin: "oklch(0.55 0.1 220)",
  befar: "oklch(0.62 0.1 165)",
};

const phaseAccent: Record<RefinishPhaseSlug, string> = {
  priprema: "oklch(0.56 0.045 245)",
  podloga: "oklch(0.58 0.07 230)",
  boja: "oklch(0.58 0.22 27)",
  lak: "oklch(0.7 0.12 35)",
  poliranje: "oklch(0.72 0.04 245)",
};

export function getProductMotionStyle(product: CarsystemProduct): CSSProperties {
  const accent = brandAccent[product.brandSlug] ?? phaseAccent[product.phaseSlug];

  return {
    "--product-accent": accent,
    "--product-hover-bg": `color-mix(in oklch, ${accent}, transparent 94%)`,
  } as CSSProperties;
}
