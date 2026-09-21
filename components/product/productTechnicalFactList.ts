import type { CarsystemProduct } from "@/lib/carsystem-data";
import type { ProductTechnicalFact } from "@/types/product-detail";

/**
 * Tehnički podaci JEDNOG proizvoda, spremni za prikaz.
 *
 * Izdvojeno iz `ProductDetailPage` iz istog razloga kao `productDocumentList`: podaci pripadaju
 * AKTIVNOJ varijanti. Dok je funkcija živela u strani, tabela se računala jednom — iz zapisa koji je
 * server izabrao (predstavnik porodice) — pa su „Pakovanje", „Nijansa", „RAL" i šifra ostajali
 * predstavnikovi i kada je kupac izabrao drugu nijansu.
 *
 * Kod proizvoda čije su varijante REDOVI jedne tabele (Carsystem, C.A.R.FIT, Befar, SATA) sve
 * varijante dele isti zapis, pa i iste podatke — za njih se ništa ne menja.
 */
export function getProductTechnicalFacts(product: CarsystemProduct): ProductTechnicalFact[] {
  const isConfirmed = (status?: string) => status === "confirmed";
  const reviewedFacts = product.detail?.technicalFacts;
  if (product.detail) {
    return isConfirmed(reviewedFacts?.reviewStatus)
      ? reviewedFacts?.content.filter((fact) => isConfirmed(fact.reviewStatus)) ?? []
      : [];
  }

  return product.specifications
    .filter((fact) => fact.label && fact.value)
    .map((fact) => ({ ...fact, reviewStatus: "confirmed" as const }));
}
