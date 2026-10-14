import { getProductSearchIndex } from "@/lib/search/buildSearchIndex";

/**
 * Jedinstveni search indeks — build-time statički asset, ne runtime API.
 *
 * `force-static` znači da Next ovu rutu prerenderuje jednom tokom `next build`
 * i servira rezultat kao fajl: ništa se ne računa po zahtevu i nema backend-a. U
 * `next dev` se računa na zahtev iz iste funkcije, pa dev i `build:check`
 * izvršavaju identičan ugovor.
 *
 * Zašto prerenderovana ruta a ne `public/*.json`: indeks mora da nastane iz
 * `getCatalogListingData()`, iste funkcije koju koristi katalog. Samostalni
 * generator skript ne može da uveze taj TypeScript modul, pa bi morao da
 * ponovi grupisanje po porodicama, tokenizaciju i razrešavanje vizuelnih
 * podataka — drugi model koji tiho odlazi od prvog. Ovako postoji tačno jedna
 * implementacija.
 *
 * Ova ruta je nasledila raniji `/katalog/variant-index.json`: isti generator,
 * ali sada nosi i porodice i samostalne proizvode, pa Header, Homepage i
 * Katalog dele jedan asset umesto da svaki ima svoj.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getProductSearchIndex(), {
    headers: {
      /*
       * Indeks se menja samo novim deploy-em. Deset minuta svežine i dan „stale-while-revalidate”
       * znače da se pri sledećoj stranici ili pretrazi ne preuzima ponovo (ranije: provera pri
       * svakom otvaranju pretrage). Posle deploy-a pregledač još do deset minuta (i jednom posle toga,
       * dok u pozadini proverava) koristi stari indeks; promenjene adrese pokrivaju preusmerenja.
       */
      "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
    },
  });
}
