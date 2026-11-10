import { getProductSearchIndex } from "@/lib/search/buildSearchIndex";
import { legacyProductTarget } from "@/lib/seo/legacyRedirect.mjs";

/**
 * Stare adrese proizvoda (`/proizvod/<naziv>`, WooCommerce) → trajno preusmerenje (308) na
 * isti proizvod kada je poklapanje jednoznačno, inače na brend ili katalog. Pravilo je u
 * `lib/seo/legacyRedirect.mjs`; indeks je isti koji koristi pretraga kataloga.
 */
export function GET(request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  return params.then(({ slug }) => {
    const { destination } = legacyProductTarget(slug.join("-"), getProductSearchIndex().records);
    return Response.redirect(new URL(destination, request.url), 308);
  });
}
