import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const provider = await read("./ProductVariantProvider.tsx");
const pdp = await read("./ProductDetailPage.tsx");
const stage = await read("./ProductStickyStage.tsx");
const identity = await read("./ProductIdentity.tsx");
const options = await read("./ProductVariantOptions.tsx");
const experienceCss = await read("./ProductDetailExperience.module.css");

test("jedan izvor istine za aktivnu varijantu", () => {
  assert.match(provider, /const \[activeKey, setActiveKey\] = useState\(initialKey\)/);
  assert.match(provider, /selectVariant/);
  // Svi variant-sensitive potrosaci citaju isti provider.
  for (const [name, source] of [["stage", stage], ["identity", identity], ["options", options]]) {
    assert.match(source, /useProductVariant\(\)/, `${name} ne koristi provider`);
  }
});

test("izbor ne pokrece App Router navigaciju", () => {
  // Komentar sme da pomene `router.push`; kod ne sme da ga poziva.
  const code = provider.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /router\.(push|replace|refresh)|window\.location\s*=/);
  assert.match(provider, /history\.(pushState|replaceState)/);
  assert.match(provider, /addEventListener\("popstate"/);
});

test("stage format je na nivou porodice, ne varijante", () => {
  // Menjanje okvira dok korisnik bira boju pomerilo bi stranu pod njim.
  assert.match(stage, /stageFormat: ProductStageFormat/);
  assert.match(pdp, /const stageFormat = getProductStageFormat\(/);
});

test("grafit se mesa u oklab da nijansa ne rotira", () => {
  const block = experienceCss.slice(
    experienceCss.indexOf(".stage {\n  --product-art-color"),
    experienceCss.lastIndexOf("--product-art-color") + 400,
  );
  // `oklch` interpolira hue: zuta + neutral hue 250 daje tirkiz.
  assert.doesNotMatch(block, /in oklch/);
  assert.match(block, /in oklab/);
});

test("kartice varijanti su prava dugmad sa selected stanjem", () => {
  assert.match(options, /aria-pressed=\{isSelected\}/);
  assert.match(options, /data-selected=\{isSelected \|\| undefined\}/);
});
