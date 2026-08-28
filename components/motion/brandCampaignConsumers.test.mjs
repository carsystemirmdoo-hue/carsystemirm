/**
 * SOURCE-CONTRACT: potrosaci zajednickog carousel jezgra.
 *
 * Sve tvrdnje ovde citaju IZVORNI TEKST potrosaca. To NIJE dokaz da autoplay
 * radi — nista se ne izvrsava, nijedan DOM se ne montira, nijedan tajmer ne
 * otkucava. Ono sto se brani je OBLIK: da nijedan brend hero nije napravio
 * drugi carousel pored zajednickog.
 *
 * Ponasanje samog jezgra izvrsno dokazuje `campaignAutoplayPolicy.test.mjs`
 * (vidljivost, uslovi autoplaya, fokus, tastatura, swipe). Da hook stvarno
 * pauzira i nastavlja u pretrazivacu proverava se browser dokazom, ne ovde.
 *
 * Istorija: tvrdnja je izdvojena iz `brandCampaignCarousel.test.mjs` pri commitu
 * jezgra, jer tada nijedan potrosac jos nije bio prelazen na hook. Sada su sva tri
 * potrosaca u repozitorijumu, pa vazi kao zajednicki ugovor.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const POTROSACI = [
  ["BaslacHero.tsx", new URL("../baslac-brand/BaslacHero.tsx", import.meta.url)],
  ["RmCampaignStage.tsx", new URL("../rm-brand/RmCampaignStage.tsx", import.meta.url)],
  ["HomeCampaignCarousel.tsx", new URL("../home/HomeCampaignCarousel.tsx", import.meta.url)],
];

/** Izvor bez komentara — komentar sme da pomene ono sto kod ne sme da radi. */
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("[source-contract] sva tri potrosaca uvoze isti hook", async () => {
  for (const [ime, url] of POTROSACI) {
    const code = codeOf(await readFile(url, "utf8"));
    assert.match(
      code,
      /useBrandCampaignCarousel\s*\}\s*from\s*"@\/components\/motion\/useBrandCampaignCarousel"/,
      `${ime} ne uvozi zajednicki hook`,
    );
    assert.match(code, /useBrandCampaignCarousel\(\{/, `${ime} ne poziva hook`);
  }
});

test("[source-contract] nijedan potrosac nema sopstveni autoplay tajmer", async () => {
  for (const [ime, url] of POTROSACI) {
    const code = codeOf(await readFile(url, "utf8"));
    assert.doesNotMatch(code, /setInterval/, `${ime}: sopstveni setInterval`);
    assert.doesNotMatch(code, /setTimeout\(/, `${ime}: sopstveni setTimeout`);
    // Progress petlja pripada hooku; potrosac je samo prijavljuje kroz
    // `registerProgressFill`.
    assert.doesNotMatch(
      code,
      /requestAnimationFrame/,
      `${ime}: sopstvena rAF petlja`,
    );
  }
});

test("[source-contract] nijedan potrosac nema sopstveni globalni listener sistem", async () => {
  for (const [ime, url] of POTROSACI) {
    const code = codeOf(await readFile(url, "utf8"));
    assert.doesNotMatch(code, /visibilitychange/, `${ime}: sopstveni visibilitychange`);
    assert.doesNotMatch(
      code,
      /(window|document)\.addEventListener/,
      `${ime}: sopstveni globalni listener`,
    );
    assert.doesNotMatch(
      code,
      /IntersectionObserver/,
      `${ime}: sopstveno merenje vidljivosti`,
    );
  }
});

test("[source-contract] nijedan potrosac ne drzi paralelnu reduced-motion logiku", async () => {
  // Odluka o reduced motion je deo `shouldCampaignAutoplay`; druga kopija bi se
  // razisla sa njom.
  for (const [ime, url] of POTROSACI) {
    const code = codeOf(await readFile(url, "utf8"));
    assert.doesNotMatch(
      code,
      /usePrefersReducedMotion|prefers-reduced-motion/,
      `${ime}: sopstvena reduced-motion provera`,
    );
  }
});
