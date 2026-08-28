import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("./ProductDetailPage.tsx", import.meta.url);
const accordionUrl = new URL("./ProductInformationAccordion.tsx", import.meta.url);
const stageUrl = new URL("./ProductStickyStage.tsx", import.meta.url);
const stylesUrl = new URL("./ProductDetailExperience.module.css", import.meta.url);
const variantsUrl = new URL("./ProductVariantOptions.tsx", import.meta.url);
const dataUrl = new URL("../../lib/carsystem-data.ts", import.meta.url);
const routeUrl = new URL("../../app/proizvodi/[slug]/page.tsx", import.meta.url);
const typesUrl = new URL("../../types/product-detail.ts", import.meta.url);
const globalsUrl = new URL("../../app/globals.css", import.meta.url);
const headerUrl = new URL("../layout/Header.tsx", import.meta.url);

test("variant selector follows the declaration while accordion stays in the sticky narrative", async () => {
  const page = await readFile(pageUrl, "utf8");
  const narrativeStart = page.indexOf("<div className={styles.narrativeGrid}>");
  // Deklaracija identiteta (naslov, šifra, nijansa, status) je klijentska
  // komponenta otkad prati aktivnu varijantu; redosled koji štiti ovaj test je
  // isti — identitet, pa selektor, pa harmonika.
  const declaration = page.indexOf("<ProductIdentity", narrativeStart);
  const variants = page.indexOf("<ProductVariantOptions", declaration);
  const information = page.indexOf("<ProductInformationAccordion", variants);
  const continuation = page.indexOf(
    "<div className={styles.fullWidthContinuation}>",
    information,
  );
  const joinedProducts = page.indexOf("<ProductJoinedRecommendations", continuation);
  const compatible = page.indexOf("content={compatibleContent}", joinedProducts);
  const finalCta = page.indexOf('className={styles.finalCta}', compatible);

  assert.ok(narrativeStart > -1);
  assert.ok(declaration > narrativeStart);
  assert.ok(variants > declaration);
  assert.ok(information > variants);
  assert.ok(continuation > information);
  assert.ok(joinedProducts > continuation);
  assert.ok(compatible > joinedProducts);
  assert.ok(finalCta > compatible);
});

test("accordion uses stable controlled buttons and a pre-measured expansion well", async () => {
  const [accordion, styles, globals] = await Promise.all([
    readFile(accordionUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
    readFile(globalsUrl, "utf8"),
  ]);

  assert.match(accordion, /aria-expanded=\{open\}/);
  assert.match(accordion, /aria-controls=\{panelId\}/);
  assert.match(accordion, /aria-labelledby=\{buttonId\}/);
  assert.match(accordion, /setOpenSectionIds\(\(current\)/);
  assert.match(accordion, /useLayoutEffect/);
  assert.match(accordion, /ResizeObserver/);
  assert.match(accordion, /panelInnerRef\.current\?\.scrollHeight/);
  assert.match(accordion, /panelRef\.current\?\.style\.setProperty/);
  assert.match(accordion, /--accordion-panel-height/);
  assert.match(accordion, /inert=\{!open\}/);
  assert.match(accordion, /accordionPhantomBuffer/);
  assert.doesNotMatch(accordion, /scrollIntoView|<details|<summary/);
  assert.match(styles, /\.accordionPanel\s*\{[\s\S]*height:\s*0/);
  assert.match(styles, /\.accordionPanel\[data-open="true"\][\s\S]*height:\s*var\(--accordion-panel-height, 0\)/);
  assert.match(styles, /height 430ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(styles, /opacity 260ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(styles, /transform 390ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(styles, /\.accordionPanelContent[\s\S]*translateY\(-10px\)/);
  assert.match(styles, /\.accordionPhantomBuffer[\s\S]*height:\s*clamp\(0\.35rem, 0\.7vw, 0\.55rem\)/);
  assert.match(styles, /\.informationAccordion::after[\s\S]*height:\s*clamp\(1\.25rem, 2vw, 1\.75rem\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*height 100ms linear/);
  assert.match(styles, /\.accordionToggle[\s\S]*300ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(globals, /scrollbar-gutter:\s*stable/);
});

test("accordion state cannot key or remount the sticky media subtree", async () => {
  const [page, accordion, stage] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(accordionUrl, "utf8"),
    readFile(stageUrl, "utf8"),
  ]);

  // The stage is mounted once, with plain props and no `key`, so nothing the
  // accordion does can remount the media subtree. Slike su i dalje razrešene na
  // serveru (productVariantView.ts) upravo zato da stage ostane list.
  assert.match(page, /<ProductStickyStage\b[\s\S]{0,200}?stageFormat=\{stageFormat\}/);
  assert.doesNotMatch(page, /<ProductStickyStage[^>]*\skey=/);
  assert.match(page, /const variantViews = toProductVariantViews\(/);
  // Ni provider ne sme da remountuje stranu: promenljiv `key` na njemu bi
  // obesmislio ceo poduhvat — izgubili bi se skrol i stanje harmonike.
  assert.doesNotMatch(page, /<ProductVariantProvider[^>]*\skey=/);
  assert.doesNotMatch(page, /openSectionIds/);
  assert.doesNotMatch(stage, /openSectionIds|accordion|key=\{.*open/);
  // Indeks galerije je i dalje lokalno stanje scene; vezan je za ključ
  // varijante samo da bi se vratio na glavnu sliku kad se varijanta promeni.
  assert.match(stage, /const \[gallery, setGallery\] = useState\(\{ key: activeVariant\.key, index: 0 \}\)/);
  assert.match(accordion, /const \[openSectionIds, setOpenSectionIds\]/);
});

test("joined recommendations are manual, full-width and separate from compatibility", async () => {
  const [page, route, data, styles] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(routeUrl, "utf8"),
    readFile(dataUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(page, /title="Slični proizvodi"/);
  assert.match(page, /variant="joined-row"/);
  assert.match(route, /getManualProductRecommendations/);
  assert.match(route, /getProductCompatibleProducts/);
  assert.match(data, /product\.relatedProductSlugs/);
  assert.doesNotMatch(
    data.slice(data.indexOf("export function getManualProductRecommendations")),
    /score \+=/,
  );
  assert.match(styles, /\.joinedProductRow[\s\S]*grid-auto-flow:\s*column/);
  assert.match(styles, /\.joinedProductRow[\s\S]*gap:\s*0/);
  assert.match(styles, /scroll-snap-type:\s*x proximity/);
  assert.match(styles, /minmax\(220px, 72vw\)/);
});

test("family, commercial variant, catalog strategy and recommendation models are explicit", async () => {
  const [types, data, variants] = await Promise.all([
    readFile(typesUrl, "utf8"),
    readFile(dataUrl, "utf8"),
    readFile(variantsUrl, "utf8"),
  ]);

  assert.match(types, /export type ProductCatalogStrategy =/);
  assert.match(types, /"family-card"[\s\S]*"variant-cards"[\s\S]*"hybrid"/);
  assert.match(types, /export type ProductFamilyIdentity =/);
  assert.match(types, /export type ProductCommercialVariant =/);
  assert.match(types, /export type ProductRecommendation =/);
  assert.match(data, /id: "carsystem-f23"/);
  assert.match(data, /accent: "oklch\(0\.52 0\.15 300\)"/);
  assert.match(data, /id: "befar-polishing-pads"/);
  assert.match(variants, /aria-pressed=\{isSelected\}/);
  assert.match(variants, /aria-current=\{isSelected \? "page"/);
  assert.match(variants, /activeVariantDeclaration/);
});

test("header keeps only the Carsystem mark in desktop and mobile brand zones", async () => {
  const header = await readFile(headerUrl, "utf8");

  assert.doesNotMatch(header, />R-M Inđija</);
  assert.match(header, /aria-label="Carsystem početna"/);
  assert.match(header, /className=\{styles\.brandSymbol\}/);
  assert.match(header, /className=\{styles\.mobilePanelLogo\}/);
});

test("stage sizing and sticky boundary retain the approved narrative layout", async () => {
  const [stage, styles] = await Promise.all([
    readFile(stageUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  // Vizuelni preset se razrešava na serveru i stiže kroz aktivnu varijantu, pa
  // grafit i tip scene prate izbor umesto reprezentativne varijante.
  assert.match(stage, /const \{ activeVariant, interactive \} = useProductVariant\(\)/);
  assert.match(stage, /data-product-stage-treatment=\{activeVariant\.treatment\}/);
  assert.match(stage, /data-product-stage-type=\{activeVariant\.productType\}/);
  assert.match(stage, /style=\{activeVariant\.style\}/);
  assert.match(
    styles,
    /grid-template-columns:\s*minmax\(360px, 0\.86fr\) minmax\(0, 1fr\)/,
  );
  assert.match(styles, /\.stickyRail\s*\{[\s\S]*position:\s*sticky[\s\S]*top:\s*6\.5rem/);
  assert.match(
    styles,
    /@media \(max-width: 55\.99rem\)[\s\S]*\.stickyRail\s*\{[\s\S]*position:\s*static/,
  );
});
