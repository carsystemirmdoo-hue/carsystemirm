import Link from "next/link";
import {
  getProductPublicStatus,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import { companyContact } from "@/lib/company-contact";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import styles from "./ProductDetailPage.module.css";

export function ProductInquiryCard({ product }: { product: CarsystemProduct }) {
  const publicStatus = getProductPublicStatus(product);

  return (
    <aside className={styles.inquiryCard} aria-labelledby="product-inquiry-title">
      <p className={styles.inquiryKicker}>Podrška</p>
      <h2 id="product-inquiry-title" className={styles.inquiryTitle}>
        Provera proizvoda pre upita
      </h2>
      <p className={styles.inquiryText}>
        Tim Carsystem i R-M proverava dostupnost, dokumentaciju i najbližu
        partnersku prodavnicu za ovaj proizvod.
      </p>
      <dl className={styles.inquiryFacts}>
        <div>
          <dt>Status</dt>
          <dd>{publicStatus}</dd>
        </div>
        <div>
          <dt>Odgovor</dt>
          <dd>Prodajna mreža</dd>
        </div>
        {companyContact.phone && companyContact.phoneHref ? (
          <div>
            <dt>Telefon</dt>
            <dd>
              <a href={companyContact.phoneHref}>{companyContact.phone}</a>
            </dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.inquiryActions}>
        <SplitContactCta inquiryHref={`/kontakt?tema=proizvod&proizvod=${product.slug}`} />
        <Link
          className={`${styles.secondaryAction} cs-interactive-surface`}
          href="/prodavnice"
          data-cursor="button"
          data-motion-surface
        >
          Pronađi prodavnicu
        </Link>
      </div>
    </aside>
  );
}
