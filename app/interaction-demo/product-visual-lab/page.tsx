import type { Metadata } from "next";
import {
  ProductVisualLab,
  isRainView,
  type RainView,
} from "@/components/interaction-demo/ProductVisualLab";

/**
 * Internal review surface for the catalog/PDP product visual system.
 *
 * Lives under `/interaction-demo`, which `app/interaction-demo/layout.tsx`
 * already marks `noindex, nofollow`. It is not linked from any public
 * navigation and is not in the sitemap.
 *
 * `?rain=v1 | v2 | compare` picks which icon-rain implementation the page
 * shows. The default lives in `ProductVisualLab.tsx` as `RAIN_DEFAULT_VIEW`;
 * changing that one constant to `"v1"` reverts the lab to V1 everywhere.
 */
export const metadata: Metadata = {
  title: "Product Visual Lab (interno)",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function ProductVisualLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.rain) ? params.rain[0] : params.rain;
  const rainView: RainView | undefined = isRainView(requested) ? requested : undefined;

  return <ProductVisualLab rainView={rainView} />;
}
