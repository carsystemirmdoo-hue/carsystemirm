import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const heroUrl = new URL("./BaslacHero.tsx", import.meta.url);
const dataUrl = new URL("./baslacBrandData.ts", import.meta.url);
const cssUrl = new URL("./BaslacBrandPage.module.css", import.meta.url);
const publicDir = new URL("../../public/", import.meta.url);

test("Baslac hero koristi deljeni carousel hook, bez paralelnog sistema", async () => {
  const source = await readFile(heroUrl, "utf8");

  assert.match(
    source,
    /import \{ useBrandCampaignCarousel \} from "@\/components\/motion\/useBrandCampaignCarousel";/,
  );
  assert.match(source, /slideCount: baslacCampaignSlides\.length/);
  assert.doesNotMatch(source, /setInterval|setTimeout\(/);
  assert.doesNotMatch(source, /visibilitychange|addEventListener/);
});

test("hero ima tacno dva slajda sa stvarnim rutama", async () => {
  const source = await readFile(dataUrl, "utf8");

  const start = source.indexOf("export const baslacCampaignSlides");
  const slides = source.slice(start, source.indexOf("\n];", start));
  const ids = [...slides.matchAll(/^\s{4}id: "([^"]+)",$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(ids, ["20-years", "surventis"]);

  // CTA-ovi moraju voditi na postojeci katalog filter i postojeci anchor.
  assert.match(source, /label: "Pogledajte Baslac proizvode"/);
  assert.match(source, /href: baslacCatalogHref\(\)/);
  assert.match(source, /label: "Upoznajte Baslac"/);
  assert.match(source, /href: "#overview"/);
  assert.match(source, /sectionId: "overview"/);
});

test("tekst heroja je pravi HTML, ne deo slike", async () => {
  const source = await readFile(heroUrl, "utf8");

  assert.match(source, /<h1 id="baslac-hero-title"/);
  assert.match(source, /\{slide\.title\}/);
  assert.match(source, /\{slide\.description\}/);
  assert.match(source, /\{slide\.eyebrow\}/);
  // Dekorativna slika nema alt tekst; opis nosi role="img" wrapper.
  assert.match(source, /alt=""/);
  assert.match(source, /aria-label=\{slide\.imageAlt\}/);
});

test("samo prvi slajd je LCP kandidat i svaka slika ima sizes", async () => {
  const source = await readFile(heroUrl, "utf8");

  assert.match(source, /priority=\{index === 0\}/);
  assert.match(source, /fetchPriority=\{priority \? "high" : "auto"\}/);
  assert.match(source, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(source, /sizes=\{/);
});

test("izvedeni kampanjski asseti postoje u public folderu", async () => {
  const source = await readFile(dataUrl, "utf8");
  const files = [
    ...source.matchAll(/\$\{BASLAC_CAMPAIGN_DIR\}\/([a-z0-9-]+\.webp)/g),
  ].map((match) => match[1]);

  assert.ok(files.length >= 3, "ocekivana su bar tri kampanjska asseta");

  for (const file of new Set(files)) {
    const asset = new URL(`images/brands/baslac/campaign/${file}`, publicDir);
    const info = await stat(asset);
    assert.ok(info.size > 0, `prazan asset: ${file}`);
  }
});

test("hero visina je stabilna izmedju slajdova", async () => {
  const css = await readFile(cssUrl, "utf8");

  // Visina dolazi iz jedne promenljive, nezavisne od aktivnog slajda.
  assert.match(css, /--baslac-campaign-height: 44rem;/);
  assert.match(css, /min-height: var\(--baslac-campaign-height\);/);
  assert.doesNotMatch(
    css,
    /\[data-active-slide[^\]]*\][^{]*\{[^}]*--baslac-campaign-height/,
  );

  // Providni artwork se uvek uklapa u okvir, bez isecanja.
  assert.match(css, /data-visual="artwork"\][\s\S]{0,400}object-fit: contain/);

  // Reduced motion uklanja autoplay wipe i copy animaciju.
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.campaignWipe \{\s*display: none;/,
  );
});
