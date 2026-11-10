import { legacyCategoryTarget } from "@/lib/seo/legacyRedirect.mjs";

/** Stare kategorije (`/proizvodi-kategorije/<brend>/...`) → stranica brenda (308), inače katalog. */
export function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return params.then(({ path }) => Response.redirect(new URL(legacyCategoryTarget(path), request.url), 308));
}
