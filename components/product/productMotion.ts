import type { CSSProperties } from "react";
import type {
  CarsystemProduct,
  ProductVisualType,
  ProductVisualMode,
  RefinishPhaseSlug,
} from "@/lib/carsystem-data";

export type ProductVisualTreatment =
  | "paint"
  | "clearcoat"
  | "fabric"
  | "foam"
  | "matte"
  | "abrasive"
  | "polish";

export type ProductVisualPreset = {
  treatment: ProductVisualTreatment;
  productType?: ProductVisualType;
  visualMode?: ProductVisualMode;
  accent?: string;
  complement?: string;
};

const brandAccent: Record<string, string> = {
  rm: "oklch(0.58 0.22 27)",
  carsystem: "oklch(0.55 0.075 245)",
  sata: "oklch(0.68 0.12 80)",
  carfit: "oklch(0.58 0.12 145)",
  "cosmos-lac": "oklch(0.62 0.12 305)",
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

const productVisualPresets: Record<string, ProductVisualPreset> = {
  "rm-diamont-bazna-boja": {
    treatment: "paint",
    productType: "color",
    visualMode: "color-on-hover",
    accent: "oklch(0.58 0.22 27)",
    complement: "oklch(0.68 0.12 195)",
  },
  "rm-diamont-bezbojni-lak": {
    treatment: "clearcoat",
    productType: "clearcoat",
    accent: "oklch(0.78 0.075 84)",
  },
  "baslac-30-s510-s-serija": {
    treatment: "paint",
    productType: "color",
    visualMode: "color-on-hover",
    accent: "oklch(0.55 0.16 248)",
    complement: "oklch(0.72 0.13 76)",
  },
  "baslac-35-m214": {
    treatment: "clearcoat",
    productType: "clearcoat",
    accent: "oklch(0.78 0.075 84)",
  },
  "baslac-60-20-razredjivac": {
    treatment: "paint",
    productType: "neutral",
    accent: "oklch(0.62 0.14 47)",
    complement: "oklch(0.6 0.13 245)",
  },
  "norbin-n15-020-5l": {
    treatment: "clearcoat",
    productType: "clearcoat",
    accent: "oklch(0.54 0.09 235)",
  },
  "norbin-n15-020-1l": {
    treatment: "clearcoat",
    productType: "clearcoat",
    accent: "oklch(0.54 0.09 235)",
  },
  "cosmos-spray-335-crni": {
    treatment: "paint",
    productType: "spray",
    visualMode: "color-on-hover",
    accent: "oklch(0.24 0.022 255)",
    complement: "oklch(0.78 0.13 82)",
  },
  "cosmos-spray-300": {
    treatment: "paint",
    productType: "spray",
    visualMode: "color-on-hover",
    accent: "oklch(0.53 0.2 26)",
    complement: "oklch(0.68 0.12 190)",
  },
  "cosmos-flame-blue-fb-904-deep-black": {
    treatment: "paint",
    productType: "color",
    visualMode: "color-on-hover",
    accent: "oklch(0.22 0.03 260)",
    complement: "oklch(0.76 0.12 82)",
  },
  "cosmos-flame-orange-fo-420-viola-dark": {
    treatment: "paint",
    productType: "color",
    visualMode: "color-on-hover",
    accent: "oklch(0.55 0.16 315)",
    complement: "oklch(0.7 0.12 145)",
  },
  "rm-body-filler-white-b-2e11": {
    treatment: "matte",
    productType: "filler",
    visualMode: "color-on-hover",
    accent: "oklch(0.86 0.018 88)",
  },
  "carsystem-git-multi-green": {
    treatment: "matte",
    productType: "filler",
    visualMode: "color-on-hover",
    accent: "oklch(0.62 0.12 145)",
  },
  "carsystem-git-elastic-weiss": {
    treatment: "matte",
    productType: "filler",
    visualMode: "color-on-hover",
    accent: "oklch(0.9 0.012 95)",
  },
  "carsystem-soft-plus-git": {
    treatment: "matte",
    productType: "filler",
    visualMode: "color-on-hover",
    accent: "oklch(0.72 0.055 76)",
  },
  "car-fit-prajmer": {
    treatment: "matte",
    productType: "primer",
    accent: "oklch(0.66 0.065 225)",
  },
  "carsystem-p19-brusni-diskovi": {
    treatment: "abrasive",
    productType: "abrasive",
    accent: "oklch(0.6 0.055 245)",
  },
  "carsystem-f19-brusni-diskovi": {
    treatment: "abrasive",
    productType: "abrasive",
    accent: "oklch(0.6 0.055 245)",
  },
  "carsystem-f23-brusni-diskovi": {
    treatment: "abrasive",
    productType: "abrasive",
    accent: "oklch(0.56 0.06 230)",
  },
  "carsystem-p23-brusni-diskovi": {
    treatment: "abrasive",
    productType: "abrasive",
    accent: "oklch(0.56 0.06 230)",
  },
  "carsystem-finish-serija": {
    treatment: "abrasive",
    productType: "abrasive",
    accent: "oklch(0.68 0.035 250)",
  },
  "rm-pasta-190-1l": { treatment: "polish", accent: "oklch(0.78 0.04 245)" },
  "rm-pasta-190-5l": { treatment: "polish", accent: "oklch(0.78 0.04 245)" },
  "baslac-35-m331-pasta": { treatment: "polish", accent: "oklch(0.76 0.055 78)" },
  "befar-sundjer-narandzasti-25x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.68 0.14 48)",
  },
  "befar-sundjer-narandzasti-50x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.68 0.14 48)",
  },
  "befar-sundjer-crni-25x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.28 0.018 250)",
  },
  "befar-sundjer-crni-50x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.28 0.018 250)",
  },
  "befar-sundjer-beli-25x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.9 0.008 250)",
  },
  "befar-sundjer-beli-50x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.9 0.008 250)",
  },
  "befar-sundjer-plavi-25x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.56 0.14 255)",
  },
  "befar-sundjer-plavi-50x150": {
    treatment: "foam",
    productType: "foam",
    visualMode: "color-on-hover",
    accent: "oklch(0.56 0.14 255)",
  },
  "satajet-x-5500": { treatment: "matte", accent: "oklch(0.64 0.06 235)" },
  "carsystem-zastitno-odelo": { treatment: "fabric", accent: "oklch(0.82 0.018 245)" },
};

function getFallbackTreatment(product: CarsystemProduct): ProductVisualTreatment {
  if (product.slug.includes("sundjer")) return "foam";
  if (product.slug.includes("odelo")) return "fabric";
  if (product.programSlug === "abrazivi") return "abrasive";
  if (product.phaseSlug === "poliranje" || product.programSlug === "poliranje") return "polish";
  if (product.phaseSlug === "boja" || product.programSlug === "aerosoli") {
    return "paint";
  }
  if (product.phaseSlug === "lak") {
    return "clearcoat";
  }
  if (product.programSlug === "boje-i-lakovi") return "paint";
  if (product.phaseSlug === "priprema" || product.phaseSlug === "podloga") return "matte";

  return "matte";
}

function getFallbackProductType(
  product: CarsystemProduct,
  treatment: ProductVisualTreatment,
): ProductVisualType {
  const identity = `${product.slug} ${product.name}`.toLocaleLowerCase("sr-Latn");

  if (identity.includes("sundjer") || identity.includes("sunđer")) return "foam";
  if (treatment === "abrasive" || product.programSlug === "abrazivi") {
    return "abrasive";
  }
  if (
    identity.includes("prajmer") ||
    identity.includes("primer") ||
    identity.includes("filer-primer") ||
    identity.includes("filler-primer")
  ) {
    return "primer";
  }
  if (
    identity.includes("git") ||
    identity.includes("kit") ||
    identity.includes("putty") ||
    identity.includes("body filler")
  ) {
    return "filler";
  }
  if (
    treatment === "clearcoat" ||
    identity.includes("bezbojni lak") ||
    identity.includes("clearcoat") ||
    identity.includes("varnish")
  ) {
    return "clearcoat";
  }
  if (
    identity.includes("razredjivac") ||
    identity.includes("razređivač") ||
    identity.includes("ucvrscivac") ||
    identity.includes("učvršćivač") ||
    identity.includes("hardener") ||
    identity.includes("reducer") ||
    identity.includes("thinner") ||
    identity.includes("cistac") ||
    identity.includes("čistač") ||
    identity.includes("cleaner") ||
    identity.includes("aditiv") ||
    identity.includes("additive")
  ) {
    return "neutral";
  }
  if (
    identity.includes("sprej") ||
    identity.includes("spray") ||
    product.programSlug === "aerosoli"
  ) {
    return "spray";
  }
  if (product.phaseSlug === "boja" || product.programSlug === "boje-i-lakovi") {
    return "color";
  }

  return "neutral";
}

function getFallbackAccent(product: CarsystemProduct) {
  return brandAccent[product.brandSlug] ?? phaseAccent[product.phaseSlug] ?? "oklch(0.58 0.045 245)";
}

function getFallbackComplement(treatment: ProductVisualTreatment) {
  if (treatment === "paint") return "oklch(0.68 0.12 195)";
  if (treatment === "clearcoat") return "oklch(0.86 0.045 95)";
  return "oklch(0.68 0.06 245)";
}

export function getProductVisualPreset(product: CarsystemProduct): Required<ProductVisualPreset> {
  if (product.visual) {
    return {
      treatment: product.visual.treatment,
      productType: product.visual.productType,
      visualMode: product.visual.visualMode,
      accent: product.visual.backgroundColor,
      complement: product.visual.backgroundColor,
    };
  }

  const preset = productVisualPresets[product.slug];
  const treatment = preset?.treatment ?? getFallbackTreatment(product);
  const productType =
    preset?.productType ?? getFallbackProductType(product, treatment);

  return {
    treatment,
    productType,
    visualMode: preset?.visualMode ?? "neutral",
    accent: preset?.accent ?? getFallbackAccent(product),
    complement: preset?.complement ?? getFallbackComplement(treatment),
  };
}

export function shouldRenderProductHeroSpray(product: CarsystemProduct) {
  const { productType } = getProductVisualPreset(product);
  return productType === "spray" || productType === "color";
}

export function getProductVisualStyle(product: CarsystemProduct): CSSProperties {
  const { accent, complement } = getProductVisualPreset(product);

  return {
    "--product-visual-accent": accent,
    "--product-visual-complement": complement,
    "--product-visual-background-color": product.visual?.backgroundColor ?? accent,
    "--product-active-color": product.visual?.backgroundColor ?? accent,
  } as CSSProperties;
}
