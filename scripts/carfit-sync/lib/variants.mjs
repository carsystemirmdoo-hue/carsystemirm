/**
 * Zajedničko za plan i apply: koje šifre proizvod PRIKAZUJE i hash zvaničnog
 * sadržaja iz kog je nastao SR tekst.
 */

import { createHash } from "node:crypto";

/** Sve što proizvod prikazuje na PDP-u, u stabilnom redosledu (ulaz za hash i za lokalizaciju). */
export function displayVariants(product) {
  return [
    ...product.variants
      .filter((variant) => variant.owned)
      .map((variant) => ({
        articleNumber: variant.articleNumber,
        component: variant.component,
        componentRole: variant.componentRole,
        descriptor: variant.descriptor,
        attributes: variant.attributes,
        pcsPerPack: variant.cataloguePcsPerPack,
        onWebsite: true,
        inCatalogue: variant.inCatalogue,
        shorthandOf: variant.shorthandOf,
        alternateArticleNumbers: variant.alternateArticleNumbers ?? [],
        // PDF red ulazi u oznaku samo kada sajt sam ne razlikuje šifre (skraćenica ili kopiran opis).
        catalogueRowText: variant.shorthandOf || variant.descriptorRepeatedOnWebsite ? variant.catalogueRowText : null,
      })),
    ...product.catalogueOnlyVariants.map((variant) => ({
      articleNumber: variant.articleNumber,
      component: null,
      componentRole: "main",
      descriptor: variant.descriptionEn ?? variant.rowText,
      attributes: variant.attributes,
      pcsPerPack: variant.pcsPerPack,
      onWebsite: false,
      inCatalogue: true,
      shorthandOf: null,
      alternateArticleNumbers: [],
      catalogueRowText: variant.rowText,
    })),
  ];
}

/** Hash zvaničnog sadržaja iz kog je SR tekst nastao: promena izvora → zastareo prevod. */
export function contentHash(product) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        product.officialName,
        product.content,
        displayVariants(product).map((variant) => [variant.articleNumber, variant.component, variant.descriptor, variant.catalogueRowText]),
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}
