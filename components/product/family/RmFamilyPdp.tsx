import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs, type SeoBreadcrumbItem } from "@/components/seo/SeoBreadcrumbs";
import { buildProductVariantViews } from "@/components/product/ProductDetailPage";
import { ProductVariantProvider } from "@/components/product/ProductVariantProvider";
import { ProductSystemNavigation } from "@/components/product/ProductSystemNavigation";
import { getProductDocuments } from "@/components/product/productDocumentList";
import { RmFamilyPicker } from "@/components/product/family/RmFamilyPicker";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { rmFamilyBases, rmFamilyPackshots, type RmFamilyConfig } from "@/lib/rm-family-bases";
import { RM_SWATCH_NOTE } from "@/lib/rm-mixing-bases";
import catalogStyles from "@/components/catalog/CatalogPage.styles";
import styles from "./FamilyBasePdp.styles";

/**
 * R-M porodica baza u istom rasporedu kao Baslac (2026-10-21). Izbor reda ide kroz
 * `ProductVariantProvider`, pa panel kupovine i korpa dobijaju tačan red i pakovanje.
 */
export function RmFamilyPdp({
  product,
  config,
  breadcrumbItems,
}: {
  product: CarsystemProduct;
  config: RmFamilyConfig;
  breadcrumbItems: SeoBreadcrumbItem[];
}) {
  const { variantViews, initialVariantKey } = buildProductVariantViews(product);
  const bases = rmFamilyBases(config);
  const packshots = rmFamilyPackshots(config);
  const documents = getProductDocuments(product).filter((document) => document.href);

  return (
    <ProductVariantProvider initialKey={initialVariantKey} variants={variantViews}>
      <div className={catalogStyles.catalogShell}>
        <main className={catalogStyles.main}>
          <SeoBreadcrumbs items={breadcrumbItems} />
          <RmFamilyPicker
            familyName={config.familyName}
            systemName={config.systemName}
            eyebrow={config.eyebrow}
            intro={config.intro}
            bases={bases}
            packshots={packshots}
            swatchNote={RM_SWATCH_NOTE}
            stageNote={
              config.system
                ? `Jedna generička limenka po sistemu i pakovanju (Surventis Brand Portal). Baze se razlikuju šifrom i nijansom, ne limenkom.`
                : "Zvanična fotografija ambalaže nije dostupna: linija ovih pasta nije potvrđena, pa se ne prikazuje limenka drugog sistema."
            }
          >
            <ProductSystemNavigation slug={product.slug} />
            {documents.length ? (
              <section className={styles.documents} aria-label="Dokumentacija">
                <h3 className={styles.kicker}>Dokumentacija</h3>
                {documents.map((document) => (
                  <a key={document.href} href={document.href!} target="_blank" rel="noopener">
                    {document.title}
                    <small>PDF · R-M</small>
                  </a>
                ))}
              </section>
            ) : null}
          </RmFamilyPicker>
        </main>
        <Footer />
      </div>
    </ProductVariantProvider>
  );
}
