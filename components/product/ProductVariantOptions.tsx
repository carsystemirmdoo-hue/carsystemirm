"use client";

import { formatMeasureSr } from "@/lib/measure-format.mjs";
import Image from "next/image";
import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { useProductVariant } from "@/components/product/ProductVariantProvider";
import { findVariantByKey } from "@/components/product/productVariantState.mjs";
import { ALL_PACKS } from "@/components/product/variantPacks.mjs";
import { useVariantPackChoice } from "@/components/product/useVariantPackChoice";
import type {
  ProductCommercialVariant,
  ProductVariantOption,
  ProductVariantSelectorSection,
} from "@/types/product-detail";
import styles from "./ProductDetailExperience.module.css";
import { CustomerStatus } from "@/components/customer-buy/CustomerStatus";

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
  function chooseVariant(candidate: ProductCommercialVariant, keepAllPacks = true) {
    const view =
      findVariant(candidate.id) ??
      findVariant(candidate.sku) ??
      findVariant(candidate.slug);
    // Izbor unutar porodice menja prikaz i adresu, ali NE dodaje korak istorije
    // (2026-10-20): posle deset pregledanih boja jedan „Nazad“ vraća na katalog.
    if (view) selectVariant(view, false);
    // „Sva pakovanja“ ostaje i posle izbora baze (i posle povratka „Nazad“ na ovu stranu).
    // Ne kada izbor dolazi iz promene zapremine (`keepAllPacks = false`): tada je zapremina već izabrana.
    if (view && keepAllPacks && hasPackChoice && currentPack === ALL_PACKS) choosePack(ALL_PACKS);
  }

  /*
   * Pakovanja (2026-10-20). Kada varijante jedne grupe postoje u više
   * zapremina, prvo se bira zapremina: podrazumevano je zapremina aktivne
   * varijante (iz `?varijanta=` ili kartice sa koje je korisnik došao), a
   * „Sva pakovanja“ prikazuje grupe po zapremini. `?pakovanje=` čuva izbor.
   */
  const { packIndex, hasPackChoice, currentPack, choosePack: writePack } = useVariantPackChoice(
    section.variants,
    section.groups.length,
    activeVariant.id,
  );

  function choosePack(label: string) {
    if (writePack(label)) return;
    // Zapremina i izabrana varijanta moraju se poklapati: prelazak na drugu
    // zapreminu bira prvu varijantu te zapremine.
    const first = section.variants.find((variant) =>
      (packIndex.packsByVariant.get(variant.id) ?? []).includes(label),
    );
    if (first) chooseVariant(first, false);
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

      {hasPackChoice ? (
        <div className={styles.packSwitch} role="group" aria-label="Pakovanje">
          <span className={styles.packSwitchLabel}>Pakovanje</span>
          <div className={styles.packSwitchOptions}>
            {packIndex.packs.map((pack) => (
              <button
                type="button"
                key={pack.slug}
                aria-pressed={currentPack === pack.label}
                data-selected={currentPack === pack.label || undefined}
                onClick={() => choosePack(pack.label)}
              >
                {pack.label}
                <small>{pack.count}</small>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={currentPack === ALL_PACKS}
              data-selected={currentPack === ALL_PACKS || undefined}
              onClick={() => choosePack(ALL_PACKS)}
            >
              Sva pakovanja
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.variantGroups}>
        {section.groups.map((group) => {
          const renderOption = (option: ProductVariantOption) => {
            const candidate = variantForOption(group.id, option.id);
            const isSelected = selectedOptions[group.id] === option.id;
            const content = (
              <VariantOptionContent
                option={option}
                selected={isSelected}
                pack={hasPackChoice && candidate ? candidate.package : undefined}
              />
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
          };

          const optionPacks = (option: ProductVariantOption) => {
            const candidate = variantForOption(group.id, option.id);
            return candidate ? (packIndex.packsByVariant.get(candidate.id) ?? []) : [];
          };

          if (hasPackChoice && currentPack === ALL_PACKS) {
            return (
              <fieldset className={styles.variantGroup} key={group.id}>
                <legend>{group.label}</legend>
                {packIndex.packs.map((pack) => (
                  <section className={styles.packGroup} key={pack.slug} aria-label={`Pakovanje ${pack.label}`}>
                    <h3 className={styles.packGroupTitle}>
                      {pack.label}
                      <small>{pack.count}</small>
                    </h3>
                    <div className={styles.variantOptionList} data-option-kind={group.kind} data-equal-tiles>
                      {group.options
                        .filter((option) => optionPacks(option).includes(pack.label))
                        .map(renderOption)}
                    </div>
                  </section>
                ))}
              </fieldset>
            );
          }

          const options = hasPackChoice
            ? group.options.filter((option) => optionPacks(option).includes(currentPack))
            : group.options;

          return (
            <fieldset className={styles.variantGroup} key={group.id}>
              <legend>{group.label}</legend>
              <div
                className={styles.variantOptionList}
                data-option-kind={group.kind}
                data-option-count={options.length > 12 ? "many" : undefined}
                data-equal-tiles={hasPackChoice || undefined}
              >
                {options.map(renderOption)}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div
        className={styles.activeVariantDeclaration}
        aria-live="polite"
        key={activeVariant.id}
      >
        <div>
          <small>Aktivna varijanta</small>
          <strong>
            {section.family.label} · {formatMeasureSr(activeVariant.label)}
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
              <dd>{formatMeasureSr(activeVariant.package)}</dd>
            </div>
          ) : null}
          {activeVariant.status ? (
            <div>
              <dt>Status</dt>
              <dd><CustomerStatus publicStatus={activeVariant.status} fallbackSlug={activeVariant.slug ?? currentSlug} /></dd>
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

      {/* `section.note` je interna beleška o izvoru podataka (npr. „Oznake sa etiketa
          pakovanja; zvanični nazivi: …"); podatak ostaje u katalogu, kupcu se ne prikazuje. */}
    </section>
  );
}

function VariantOptionContent({
  option,
  selected,
  pack,
}: {
  option: ProductVariantOption;
  selected: boolean;
  /** Pakovanje varijante — prikazuje se kada se bira i zapremina. */
  pack?: string;
}) {
  const swatchStyle: FamilyStyle | undefined = option.swatch
    ? { "--variant-swatch": option.swatch }
    : undefined;

  return (
    <>
      {option.swatch || option.image || option.swatchFinish ? (
        <span
          className={styles.variantOptionVisual}
          style={swatchStyle}
          data-finish={option.swatchFinish}
          aria-hidden="true"
        >
          {option.image ? <Image src={option.image} alt="" fill sizes="3rem" /> : null}
        </span>
      ) : null}
      <span className={styles.variantOptionCopy}>
        <strong>{formatMeasureSr(option.label)}</strong>
        {option.code ? <small>{option.code}</small> : null}
        {option.detail ? <small>{formatMeasureSr(option.detail)}</small> : null}
        {pack ? <small className={styles.variantOptionPack}>{formatMeasureSr(pack)}</small> : null}
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
