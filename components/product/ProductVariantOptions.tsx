"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
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
  inquiryHref,
  section,
}: {
  currentSlug: string;
  inquiryHref: string;
  section: ProductVariantSelectorSection;
}) {
  const initialVariant =
    section.variants.find((variant) => variant.id === section.initialVariantId) ??
    section.variants[0];
  const [activeVariantId, setActiveVariantId] = useState(initialVariant.id);
  const activeVariant =
    section.variants.find((variant) => variant.id === activeVariantId) ?? initialVariant;
  const [selectedOptions, setSelectedOptions] = useState(
    activeVariant.optionValueIds,
  );
  const familyStyle = useMemo<FamilyStyle>(
    () => ({
      "--family-accent": section.family.visualIdentity?.accent,
      "--family-accent-soft": section.family.visualIdentity?.softAccent,
    }),
    [section.family.visualIdentity],
  );

  function findVariant(groupId: string, optionId: string) {
    return section.variants.find((variant) =>
      section.groups.every((group) => {
        const expectedOption = group.id === groupId ? optionId : selectedOptions[group.id];
        return !expectedOption || variant.optionValueIds[group.id] === expectedOption;
      }),
    );
  }

  function selectVariant(variant: ProductCommercialVariant) {
    setActiveVariantId(variant.id);
    setSelectedOptions(variant.optionValueIds);
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
                const candidate = findVariant(group.id, option.id);
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

                if (candidate.slug && candidate.slug !== currentSlug) {
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
                    onClick={() => selectVariant(candidate)}
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
          href={`${inquiryHref}&varijanta=${encodeURIComponent(activeVariant.id)}`}
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
