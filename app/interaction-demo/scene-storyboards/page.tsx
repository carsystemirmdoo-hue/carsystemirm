import type { Metadata } from "next";
import {
  SceneStoryboards,
  type StoryboardCase,
} from "@/components/interaction-demo/SceneStoryboards";
import { getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { getProductImageMetrics } from "@/lib/product-image-metrics";
import { getProductCategorySlug } from "@/lib/product-taxonomy";

/**
 * Internal storyboards for the three leading scene concepts.
 *
 * Under `/interaction-demo`, which `app/interaction-demo/layout.tsx` already
 * marks `noindex, nofollow`. Not linked anywhere, not in the sitemap, imported
 * by nothing else. Static — no animation.
 */
export const metadata: Metadata = {
  title: "Scene storyboards (interno)",
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * Real products from the non-paint groups, all with genuine alpha — the first
 * two concepts build the scene out of the product's own silhouette, so a JPG
 * with a baked white background would produce a white rectangle rather than an
 * echo. Those files are recorded as a gap in the handoff, not worked around.
 */
const CASES: { slug: string; note: string }[] = [
  { slug: "carsystem-p19-brusni-diskovi", note: "Abraziv, kružan, srednji ton" },
  { slug: "carsystem-f19-brusni-diskovi", note: "Abraziv, kružan, vrlo taman" },
  { slug: "carsystem-finish-serija", note: "Poliranje, sadržaj popunjava 97% platna" },
  { slug: "b-2p93-uv-bodyfill-r", note: "Kit, najveće transparentne margine" },
  { slug: "carsystem-git-elastic-weiss", note: "Kit, širok" },
  { slug: "carsystem-zastitno-odelo", note: "Zaštita, vrlo taman" },
  {
    slug: "cosmos-lac-automotive-250-400-ml-antichip-250-white",
    note: "Zaštita, antichip sprej",
  },
];

export default function SceneStoryboardsPage() {
  const cases: StoryboardCase[] = CASES.flatMap((entry) => {
    const product = getCarsystemProductBySlug(entry.slug);
    const image = product?.productImage;
    if (!product || !image) return [];

    const metrics = getProductImageMetrics(image.src);
    // Only alpha-trimmed renders: the echo concept needs a real silhouette.
    if (!metrics || metrics.boxSource !== "alpha") return [];

    const aspect = metrics.aspect;
    return [
      {
        slug: product.slug,
        label: product.name,
        group: getProductCategorySlug(product) ?? "—",
        note: entry.note,
        imageSrc: image.src,
        imageAlt: image.alt,
        format: aspect < 0.8 ? "portrait" : aspect < 1.45 ? "square" : "landscape",
        tone: metrics.tone,
      },
    ];
  });

  return <SceneStoryboards cases={cases} />;
}
