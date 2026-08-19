import type { Metadata } from "next";
import {
  SprayCompositionStudy,
  type StudyCase,
} from "@/components/interaction-demo/SprayCompositionStudy";
import { getProductVisualStyle } from "@/components/product/productMotion";
import { getProductStageFormat, getProductStageImages } from "@/components/product/productStageImages";
import { getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { getProductVisualRecipe } from "@/lib/product-visual-recipe";
import { resolveProductVolume, resolveSizeClass } from "@/lib/product-scale";

/**
 * Internal composition study for the existing spray/paint animation.
 *
 * Under `/interaction-demo`, which `app/interaction-demo/layout.tsx` already
 * marks `noindex, nofollow`. Not linked from any navigation, not in the sitemap,
 * and imported by nothing else.
 */
export const metadata: Metadata = {
  title: "Spray kompoziciona studija (interno)",
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * The five cases the review asked for.
 *
 * The fourth — "a short or wider paint product, if one exists" — is R-M Diamont
 * BC 100, a 0,5 L tin at content aspect 0.76. It is the widest product in the
 * catalogue that the spray backdrop is actually gated to: every Cosmos aerosol
 * sits between 0.25 and 0.33, and the genuinely wide records (Putties, Wood
 * putties, body fillers) are filler types, which
 * `shouldRenderProductHeroSpray` deliberately excludes. That gap is real and is
 * recorded rather than worked around.
 */
const CASES: { slug: string; name: string; label: string; why: string }[] = [
  {
    slug: "cosmos-lac-effect-451-400-ml-gold-effect-451",
    name: "effect-gold-451",
    label: "Cosmos Lac Effect Gold Effect 451",
    why: "Proizvod sa dostavljenog snimka. Zlatna limenka, srednji ton — potez se meri upravo na njoj.",
  },
  {
    slug: "cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black",
    name: "flame-booster-black",
    label: "Cosmos Lac Flame Booster B-901 Thick Black",
    why: "Crn proizvod: proverava da li širi art sloj ugrožava razdvajanje siluete u tamnoj temi.",
  },
  {
    slug: "cosmos-lac-home-400-400-ml-white-smalto-400-white",
    name: "white-smalto-400",
    label: "Cosmos Lac Home White Smalto 400",
    why: "Veoma svetao sprej — obrnuti kontrastni rizik na svetloj podlozi.",
  },
  {
    slug: "rm-diamont-bazna-boja",
    name: "rm-diamont-wide",
    label: "R-M Diamont BC 100 (0,5 L)",
    why: "Najširi proizvod koji uopšte dobija spray (aspect 0.76). Trenutno art pojas ne prelazi njegovu siluetu ni sa jedne strane.",
  },
  {
    slug: "cosmos-lac-molotow-burner-600-ml-mb-600ml-copper",
    name: "molotow-burner-tall",
    label: "Cosmos Lac Molotow Burner Copper 600 ml",
    why: "Ekstremno visok sprej (aspect 0.257) — najgori odnos visine proizvoda i horizontalnog art pojasa.",
  },
];

export default function SprayCompositionPage() {
  const cases: StudyCase[] = CASES.flatMap((entry) => {
    const product = getCarsystemProductBySlug(entry.slug);
    if (!product?.productImage) return [];

    const recipe = getProductVisualRecipe(product);
    const images = getProductStageImages(product);

    return [
      {
        ...entry,
        imageSrc: product.productImage.src,
        imageAlt: product.productImage.alt,
        sizeClass: resolveSizeClass(resolveProductVolume(product)),
        stageFormat: getProductStageFormat(images),
        contrastMode: recipe.contrastMode,
        // Exactly what the production stage passes, so the art colour and the
        // contrast decision are unchanged.
        visualStyle: getProductVisualStyle(product) as Record<string, string>,
      },
    ];
  });

  return <SprayCompositionStudy cases={cases} />;
}
