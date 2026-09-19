"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { useProductVariant } from "@/components/product/ProductVariantProvider";
import { findVariantByKey } from "@/components/product/productVariantState.mjs";
import type {
  ProductCommercialVariant,
  ProductVariantOption,
  ProductVariantSelectorSection,
} from "@/types/product-detail";
import styles from "./ProductDetailExperience.module.css";

type FamilyStyle = CSSProperties & {
  "--family-accent"?: string;
  "--family-accent-soft"?: string;
  "--variant-swatch"?: string;
};

export function ProductVariantOptions({
  currentSlug,
  section,
  selectInPlace = false,
}: {
  currentSlug: string;
  section: ProductVariantSelectorSection;
  /**
   * Na canonical family ruti varijanta se bira u mestu — klik ne vodi na
   * zaseban variant URL, nego menja izbor i `?varijanta=` parametar.
   */
  selectInPlace?: boolean;
}) {
  const { activeKey, findVariant, inquiryHref: activeInquiryHref, selectVariant } =
    useProductVariant();

  const initialVariant =
    section.variants.find((variant) => variant.id === section.initialVariantId) ??
    section.variants[0];

  /*
   * Izbor se NE drži ovde.
   *
   * Ranije je aktivna varijanta bila lokalni `useState` ove komponente, pa su
   * naslov, šifra, slika i grafit ostajali na varijanti koju je izabrao server —
   * menjala se samo kartica. Sada je izvor istine `ProductVariantProvider`, a
   * ovaj red se samo preslikava na njega.
   */
  const activeVariant =
    (findVariantByKey(section.variants, activeKey) as
      | ProductCommercialVariant
      | null) ?? initialVariant;
  const selectedOptions = activeVariant.optionValueIds;

  const familyStyle = useMemo<FamilyStyle>(
    () => ({
      "--family-accent": section.family.visualIdentity?.accent,
      "--family-accent-soft": section.family.visualIdentity?.softAccent,
    }),
    [section.family.visualIdentity],
  );

  /** Varijanta koja odgovara izboru u jednoj grupi, uz zadržane ostale grupe. */
  function variantForOption(groupId: string, optionId: string) {
    return section.variants.find((variant) =>
      section.groups.every((group) => {
        const expectedOption = group.id === groupId ? optionId : selectedOptions[group.id];
        return !expectedOption || variant.optionValueIds[group.id] === expectedOption;
      }),
    );
  }

  /**
   * Klik na red selektora → izbor u zajedničkom kontekstu.
   *
   * Red se preslikava na varijantu preko id-a, pa šifre, pa slug-a: dva modela
   * ne moraju deliti isto polje, a poklapanje mora biti pouzdano. Id je prvi
   * jer je jedini uvek jedinstven — redovi jednog proizvoda (granulacije,
   * pakovanja, boje) dele slug proizvoda, pa bi slug uvek pogodio prvi red. Ako
   * varijanta nema odgovarajući zapis, izbor se ne menja — bolje nego tiho
   * odvesti korisnika na pogrešan proizvod.
   */
  function chooseVariant(candidate: ProductCommercialVariant) {
    const view =
      findVariant(candidate.id) ??
      findVariant(candidate.sku) ??
      findVariant(candidate.slug);
    if (view) selectVariant(view);
  }

  return (
    <section
      className={styles.optionSection}
      aria-labelledby="product-variants-title"
      data-family-id={section.family.id}
      data-option-shape={section.family.visualIdentity?.optionShape}
      style={familyStyle}
    >
      <header className={styles.optionHeader}>
        <p>{section.family.label}</p>
        <h2 id="product-variants-title">{section.title}</h2>
        {section.description ? <span>{section.description}</span> : null}
      </header>

      <div className={styles.variantGroups}>
        {section.groups.map((group) => (
          <fieldset className={styles.variantGroup} key={group.id}>
            <legend>{group.label}</legend>
            <div
              className={styles.variantOptionList}
              data-option-kind={group.kind}
              data-option-count={group.options.length > 12 ? "many" : undefined}
            >
              {group.options.map((option) => {
                const candidate = variantForOption(group.id, option.id);
                const isSelected = selectedOptions[group.id] === option.id;
                const content = (
                  <VariantOptionContent option={option} selected={isSelected} />
                );

                if (!candidate) {
                  return (
                    <button
                      className={styles.variantOptionControl}
                      data-selected={isSelected || undefined}
                      type="button"
                      disabled
                      key={option.id}
                    >
                      {content}
                    </button>
                  );
                }

                if (!selectInPlace && candidate.slug && candidate.slug !== currentSlug) {
                  return (
                    <Link
                      className={styles.variantOptionControl}
                      data-selected={isSelected || undefined}
                      href={`/proizvodi/${candidate.slug}`}
                      aria-current={isSelected ? "page" : undefined}
                      scroll={false}
                      data-variant-option
                      key={option.id}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    className={styles.variantOptionControl}
                    data-selected={isSelected || undefined}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => chooseVariant(candidate)}
                    data-variant-option
                    key={option.id}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div
        className={styles.activeVariantDeclaration}
        aria-live="polite"
        key={activeVariant.id}
      >
        <div>
          <small>Aktivna varijanta</small>
          <strong>
            {section.family.label} · {activeVariant.label}
          </strong>
        </div>
        <dl>
          {activeVariant.sku ? (
            <div>
              <dt>Šifra</dt>
              <dd>{activeVariant.sku}</dd>
            </div>
          ) : null}
          {activeVariant.dimension ? (
            <div>
              <dt>Dimenzija</dt>
              <dd>{activeVariant.dimension}</dd>
            </div>
          ) : null}
          {activeVariant.package ? (
            <div>
              <dt>Pakovanje</dt>
              <dd>{activeVariant.package}</dd>
            </div>
          ) : null}
          {activeVariant.status ? (
            <div>
              <dt>Status</dt>
              <dd>{activeVariant.status}</dd>
            </div>
          ) : null}
        </dl>
        <Link
          className={styles.variantInquiryLink}
          href={activeInquiryHref}
          data-product-inquiry
        >
          Upit za ovu varijantu
          <ArrowIcon />
        </Link>
      </div>

      {section.note ? <p className={styles.optionNote}>{section.note}</p> : null}
    </section>
  );
}

function VariantOptionContent({
  option,
  selected,
}: {
  option: ProductVariantOption;
  selected: boolean;
}) {
  const swatchStyle: FamilyStyle | undefined = option.swatch
    ? { "--variant-swatch": option.swatch }
    : undefined;

  return (
    <>
      {option.swatch || option.image ? (
        <span className={styles.variantOptionVisual} style={swatchStyle} aria-hidden="true">
          {option.image ? <Image src={option.image} alt="" fill sizes="3rem" /> : null}
        </span>
      ) : null}
      <span className={styles.variantOptionCopy}>
        <strong>{option.label}</strong>
        {option.code ? <small>{option.code}</small> : null}
        {option.detail ? <small>{option.detail}</small> : null}
      </span>
      <span className={styles.variantSelectedMark} aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
    </>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}
