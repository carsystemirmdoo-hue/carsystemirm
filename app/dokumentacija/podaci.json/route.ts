import { getDocumentLibrary } from "@/lib/sistemi/document-library";

/** Ceo spisak biblioteke za filtere na /dokumentacija; isti izvor kao brojači na strani. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getDocumentLibrary().items, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
