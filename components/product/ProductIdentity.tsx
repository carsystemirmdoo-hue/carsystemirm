"use client";

import { useProductVariant } from "@/components/product/ProductVariantProvider";
import styles from "./ProductDetailExperience.module.css";

/**
 * Identitet proizvoda: naslov, uvod i referentni podaci.
 *
 * Klijentska komponenta zato što naziv, šifra i oznaka nijanse pripadaju
 * AKTIVNOJ varijanti, a ne onoj koju je server izabrao. Sadržaj koji je isti za
 * celu porodicu (`kicker`, `subtype`, pregledani `lead`) i dalje stiže sa
 * servera kao prop — nema razloga da putuje kroz kontekst.
 *
 * Namerno bez `aria-live`: promenu izbora već najavljuje jedno mesto,
 * deklaracija aktivne varijante u selektoru. Druga najava istog događaja bi
 * čitaču ekrana isporučila isti podatak dvaput.
 */
export function ProductIdentity({
  kicker,
  lead,
  subtype,
}: {
  kicker?: string;
  lead?: string;
  subtype?: string;
}) {
  const { activeVariant } = useProductVariant();

  return (
    <>
      {kicker ? <p className={styles.heroKicker}>{kicker}</p> : null}
      <h1 id="product-title" className={styles.heroTitle} data-cursor="headline">
        {activeVariant.name}
      </h1>
      {subtype ? <p className={styles.heroSubtype}>{subtype}</p> : null}
      <p className={styles.heroLead} data-cursor="text">
        {lead ?? activeVariant.shortDescription}
      </p>

      <div className={styles.heroReference} data-variant-key={activeVariant.key}>
        {activeVariant.sku ? (
          <span>
            <small>Šifre artikala</small>
            <strong data-variant-sku>{activeVariant.sku}</strong>
          </span>
        ) : null}
        {/* Oznaka nijanse se prikazuje samo kada je izvor zaista ima. */}
        {activeVariant.shadeLabel ? (
          <span>
            <small>{activeVariant.ralLabel ? "Nijansa" : "Izvedba"}</small>
            <strong data-variant-shade>
              {activeVariant.ralLabel &&
              activeVariant.ralLabel !== activeVariant.shadeLabel
                ? `${activeVariant.shadeLabel} · ${activeVariant.ralLabel}`
                : activeVariant.shadeLabel}
            </strong>
          </span>
        ) : null}
        <span>
          <small>Status</small>
          <strong className={styles.statusValue}>{activeVariant.status}</strong>
        </span>
      </div>
    </>
  );
}
