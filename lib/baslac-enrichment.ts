/**
 * Kontrolisano obogaćivanje generisanih Baslac zapisa.
 *
 * Zašto postoji: dva Baslac artikla su do sada imala DVA runtime zapisa — jedan
 * generisan iz `lib/baslac-systems.ts` i jedan ručno pisan u
 * `lib/carsystem-data.ts`. Kod `35-M214` su oba nosila isti slug, pa je jedan
 * bio nedostižan; kod `35-M331` su nosili dva sluga sa istim imenom.
 *
 * Vlasništvo je sada eksplicitno: **generisani zapis je canonical**, jer on
 * jedini nosi potvrđeno pakovanje, pripadnost porodici, `variantId`,
 * `catalogMetadata` i (kod `35-M214`) stvarni packshot. Ručni zapisi su
 * uklonjeni, a ono malo podataka koje su imali a generator nema prelazi ovde —
 * u uzak, tipizovan sloj koji NE SME da dodirne identitet.
 *
 * Šta ovaj sloj NIKADA ne dira, po konstrukciji (nema polja za to):
 * `slug`, `name`, `sku`, `externalSku`, `variantId`, `packages`,
 * `catalogMetadata`, `productImage`, `specifications`, `documents`,
 * `shortDescription`, `longDescription`, `badges`.
 *
 * Dopuna je uvek **samo popunjavanje praznine**: ako generisani zapis već ima
 * vrednost, enrichment se preskače. Tako obogaćivanje ne može da degradira
 * podatak koji generator zna bolje.
 */

import type { CarsystemProduct } from "@/lib/carsystem-data";

/** Jedina polja koja enrichment sme da dopuni. */
export type BaslacEnrichment = {
  /**
   * Preporuke preuzete iz ranijeg ručnog zapisa. Primenjuju se samo kada
   * generator nije dao nijednu, i samo ako svi slugovi zaista postoje.
   */
  relatedProductSlugs?: readonly string[];
  /** Izvorni listing proizvođača na osnovu kog je varijanta potvrđena. */
  imageSourceUrl?: string;
  /** Zašto ovaj unos postoji. Interno; ne prikazuje se javno. */
  note: string;
};

/**
 * Eksplicitno nabrojani ključevi. Nepoznat slug je greška, ne tiho preskakanje —
 * vidi `assertBaslacEnrichmentKeys`.
 */
export const BASLAC_ENRICHMENT: Readonly<Record<string, BaslacEnrichment>> = {
  "baslac-35-m214": {
    // Preneto sa uklonjenog ručnog zapisa `sku: "BASLAC-35-M214"`.
    // Generator ne izvodi preporuke, pa ovde nema šta da se pregazi.
    relatedProductSlugs: [
      "baslac-30-s510-s-serija",
      "baslac-60-20-razredjivac",
      "satajet-x-5500",
    ],
    imageSourceUrl:
      "https://www.baslac.de/basislack/35-m214-silver-dollar-bright-35-l-53224337.html",
    note:
      "Ručni zapis `BASLAC-35-M214` uklonjen 2026-08-25; delio je slug sa generisanim. " +
      "Napomena iz izvornog koda o ranije pogrešnoj fotografiji (limenka `45-W1120`) " +
      "ostaje interna i namerno se NE prenosi u javni sadržaj.",
  },
  "baslac-35-m331": {
    /*
     * `relatedProductSlugs` sa ručnog zapisa (`befar-sundjer-beli-50x150`,
     * `rm-pasta-190-1l`, `carsystem-finish-serija`) se NE prenose. Sva tri su
     * izvedena iz ranije, pogrešne klasifikacije „pasta za poliranje". Sam
     * ručni zapis je u komentaru već ispravio identitet: `35-M331 Red Xirallic
     * 0,5 L` je mixing toner linije 35. Preporuke za poliranje uz mixing toner
     * bile bi netačne, a prenosi se samo ono što je i korisno i tačno.
     */
    imageSourceUrl:
      "https://www.baslac.de/basislack/35-m331-red-xirallic-05-54464538.html",
    note:
      "Ručni zapis `baslac-35-m331-pasta` uklonjen 2026-08-25; isti artikal, drugi slug. " +
      "Stari slug ostaje dostupan kroz legacy redirect.",
  },
};

/**
 * Obara build ako enrichment mapa pokazuje na slug koji ne postoji.
 *
 * Tiho preskakanje bi značilo da preimenovanje varijante nečujno ugasi
 * obogaćivanje — greška koja se primeti tek kad neko pogleda stranicu.
 *
 * @param slugs slugovi zapisa koje je generator zaista proizveo
 */
export function assertBaslacEnrichmentKeys(slugs: Iterable<string>): void {
  const known = new Set(slugs);
  const unknown = Object.keys(BASLAC_ENRICHMENT).filter((slug) => !known.has(slug));
  if (unknown.length) {
    throw new Error(
      `BASLAC_ENRICHMENT pokazuje na nepostojeće Baslac zapise: ${unknown.join(", ")}. ` +
        "Ili je varijanta preimenovana, ili unos više nije potreban.",
    );
  }
}

/**
 * Primenjuje dopunu na jedan generisani zapis.
 *
 * Vraća isti objekat kada dopune nema, pa se identitet ne može promeniti
 * slučajnim kopiranjem.
 *
 * @param product generisani Baslac zapis
 * @param exists  predikat „slug postoji u katalogu"; nevalidne preporuke otpadaju
 */
export function applyBaslacEnrichment(
  product: CarsystemProduct,
  exists: (slug: string) => boolean,
): CarsystemProduct {
  const enrichment = BASLAC_ENRICHMENT[product.slug];
  if (!enrichment) return product;

  let next = product;

  // Preporuke: samo kada generator nije dao nijednu i samo postojeći slugovi.
  if (enrichment.relatedProductSlugs && product.relatedProductSlugs.length === 0) {
    const valid = enrichment.relatedProductSlugs.filter(
      (slug) => slug !== product.slug && exists(slug),
    );
    if (valid.length) next = { ...next, relatedProductSlugs: [...valid] };
  }

  // Izvorni URL: samo kada ga generisani zapis nema.
  if (enrichment.imageSourceUrl && next.visualIdentity && !next.visualIdentity.imageSourceUrl) {
    next = {
      ...next,
      visualIdentity: {
        ...next.visualIdentity,
        imageSourceUrl: enrichment.imageSourceUrl,
      },
    };
  }

  return next;
}
