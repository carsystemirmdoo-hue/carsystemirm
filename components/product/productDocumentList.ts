import type { CarsystemProduct } from "@/lib/carsystem-data";
import type { ProductDetailDocument } from "@/types/product-detail";

/**
 * Dokumenti JEDNOG proizvoda, spremni za prikaz.
 *
 * Ime fajla je namerno `productDocumentList`, a ne `productDocuments`: macOS ima
 * case-insensitive sistem fajlova, pa bi se sudarilo sa komponentom `ProductDocuments.tsx`
 * i uvoz bi tiho pokazivao na pogrešan modul.
 *
 * Izdvojeno iz `ProductDetailPage` zato što isti skup sada treba i sloju varijanti:
 * dokumentacija pripada AKTIVNOJ varijanti, kao što joj pripadaju šifra, pakovanje i slika.
 * Dok je funkcija živela u strani, skup se računao jednom — iz zapisa koji je server izabrao —
 * pa je bezbednosni list pakovanja od 1 L ostajao na ekranu i kada je kupac izabrao 5 L.
 *
 * Dve vrste zapisa se namerno različito čitaju:
 *   `detail.documents`  — pregledani sloj (sync brendovi): poštuje `reviewStatus` i
 *                         „u pripremi" redove bez linka;
 *   `documents`         — stariji ručni zapisi: `placeholder` se ne prikazuje.
 */
export function getProductDocuments(product: CarsystemProduct): ProductDetailDocument[] {
  const reviewed = product.detail?.documents;
  const isConfirmed = (status?: string) => status === "confirmed";

  if (product.detail) {
    return isConfirmed(reviewed?.reviewStatus)
      ? reviewed?.content.filter(
          (document) => isConfirmed(document.reviewStatus) && (document.availability === "preparing" || Boolean(document.href)),
        ) ?? []
      : [];
  }

  return product.documents.flatMap((document, index) => {
    if (document.status === "placeholder") return [];
    if (document.status === "available" && !document.href) return [];

    return [
      {
        id: `${product.slug}-${index}`,
        title: document.title,
        kind: legacyDocumentKind(document.title),
        availability: document.status === "available" ? ("available" as const) : ("preparing" as const),
        href: document.status === "available" ? document.href : undefined,
        note: document.note,
        reviewStatus: "confirmed" as const,
      },
    ];
  });
}

export function legacyDocumentKind(title: string): ProductDetailDocument["kind"] {
  const normalized = title.toLocaleLowerCase("sr-Latn");
  if (normalized.includes("tehnički")) return "tds";
  if (normalized.includes("bezbednosni")) return "sds";
  if (normalized.includes("uputstvo")) return "instructions";
  return "other";
}
