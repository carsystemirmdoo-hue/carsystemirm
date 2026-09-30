/**
 * V6A generator — `measure_subject` na SINTETIČKIM alfa kanalima.
 *
 * Generator je Python (`scripts/extract-product-image-metrics.py`), pa test
 * izvršava STVARNU funkciju kroz `python3`, bez ijedne slike sa diska: brz je i
 * ne zavisi od asseta. Puna determinističnost nad 1843 slike proverava
 * `npm run images:metrics:check` (dva uzastopna prolaza moraju dati čist diff).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const HARNESS = String.raw`
import importlib.util, json, sys
import numpy as np
spec = importlib.util.spec_from_file_location("gen", sys.argv[1]); gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)

def canvas(): return np.zeros((400, 660), dtype=np.uint8)
def can(a, x0=230, x1=430, y0=60, y1=300): a[y0:y1, x0:x1] = 255; return a
def legacy(a): return gen._bbox(a > gen.ALPHA_FLOOR)

cases = {}
a = can(canvas()); cases["plain"] = a.copy()
a = can(canvas()); a[300:330, 200:520] = 70; cases["shadow_below"] = a.copy()          # wide soft band under the can
a = can(canvas()); a[250:305, 430:560] = 60; cases["shadow_lateral"] = a.copy()        # side shadow at ground level
a = can(canvas()); a[20:60, 250:410] = 200; cases["translucent_lid"] = a.copy()        # half-visible lid ABOVE the core
a = can(canvas()); a[0, :] = 55; a[-1, :] = 55; a[:, 0] = 55; a[:, -1] = 55; cases["frame"] = a.copy()
a = can(canvas()); a[300:306, 232:428] = 60; cases["thin_glow"] = a.copy()             # narrow contact glow
cases["opaque"] = np.full((400, 660), 255, dtype=np.uint8)
a = canvas(); a[60:300, 230:430] = 120; cases["no_core"] = a.copy()                     # nothing opaque at all

out = {}
for name, alpha in cases.items():
    first = gen.measure_subject(alpha, legacy(alpha))
    second = gen.measure_subject(alpha.copy(), legacy(alpha))
    out[name] = {"result": first, "deterministic": first == second, "legacy": legacy(alpha)}
out["_constants"] = {"prefixes": list(gen.SUBJECT_FIT_PREFIXES), "version": gen.FIT_MODEL_VERSION,
                     "overrides": gen.OFFICIAL_SHADOW_OVERRIDES}
rgba = np.zeros((400, 660, 4), dtype=np.uint8); rgba[..., 3] = cases["shadow_below"]
out["_scope"] = {
  "carsystem": gen._subject_fields(rgba, "/products/carsystem/catalog/x.webp", legacy(cases["shadow_below"]), "alpha"),
  "other_brand": gen._subject_fields(rgba, "/products/rm/x.webp", legacy(cases["shadow_below"]), "alpha"),
  "opaque_border": gen._subject_fields(rgba, "/products/carsystem/catalog/x.webp", legacy(cases["shadow_below"]), "opaque-border"),
  "override": gen._subject_fields(rgba, "/products/carsystem/catalog/carsystem-glass-fibre-reinforced-putty.webp", legacy(cases["shadow_below"]), "alpha"),
  "derivative": gen._subject_fields(rgba, "/remastered/products/carsystem/catalog/x.webp", legacy(cases["shadow_below"]), "alpha"),
  "derivative_override": gen._subject_fields(rgba, "/remastered/products/carsystem/catalog/carsystem-glass-fibre-reinforced-putty.webp", legacy(cases["shadow_below"]), "alpha"),
  "other_derivative": gen._subject_fields(rgba, "/remastered/products/rm/x.webp", legacy(cases["shadow_below"]), "alpha"),
}
print(json.dumps(out))
`;

const run = () =>
  JSON.parse(
    execFileSync("python3", ["-c", HARNESS, path.join(ROOT, "scripts/extract-product-image-metrics.py")], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    }),
  );

const CORE = [230, 60, 200, 240];
const out = run();

/**
 * Subject box = jezgro + antialias rub od najviše 2 px (SUBJECT_RIM_PX). Tamo gde
 * meka masa dodiruje jezgro, rub sme da zahvati ta 2 px — ne i samu senku.
 */
function assertCoreWithRim(box, message) {
  box.forEach((value, index) => {
    const delta = value - CORE[index];
    assert.ok(delta >= 0 && delta <= 2, `${message}: ${JSON.stringify(box)} vs jezgro ${JSON.stringify(CORE)}`);
  });
}

test("12. generator je determinističan: ista alfa → isti rezultat, i u drugom procesu", () => {
  for (const [name, entry] of Object.entries(out)) {
    if (name.startsWith("_")) continue;
    assert.equal(entry.deterministic, true, name);
  }
  assert.deepEqual(run(), out, "drugi proces mora dati identičan izlaz");
});

test("subject box isključuje zapečenu senku ispod proizvoda, a legacy box je uključuje", () => {
  const { result, legacy } = out.shadow_below;
  assert.deepEqual(legacy, [200, 60, 320, 270], "legacy box = proizvod + senka");
  assertCoreWithRim(result.subjectBox, "senka od 30 px ne sme ući u subjekt");
  assert.equal(result.officialShadow, "strong");
  const [x, y, w, h] = result.subjectBox;
  assert.deepEqual(result.subjectCenter, [(x + w / 2) / 660, Number(((y + h / 2) / 400).toFixed(4))]);
  assert.equal(result.subjectAspect, Number((w / h).toFixed(4)));
});

test("bočna senka u prizemnom pojasu je `strong` i ne širi subject box", () => {
  assertCoreWithRim(out.shadow_lateral.result.subjectBox, "bočna senka od 130 px ne sme ući u subjekt");
  assert.equal(out.shadow_lateral.result.officialShadow, "strong");
});

test("poluprovidan poklopac IZNAD jezgra ostaje deo subjekta", () => {
  const [, y, , h] = out.translucent_lid.result.subjectBox;
  assert.equal(y, 20, "vrh poklopca je vrh subjekta");
  assert.equal(h, 280);
  assert.equal(out.translucent_lid.result.officialShadow, "none");
});

test("rubni okvir od 1 px ne ulazi u subject box i nije senka", () => {
  assert.deepEqual(out.frame.legacy, [0, 0, 660, 400], "legacy box = celo platno");
  // Okvir toliko naduva legacy box da bi povećanje prešlo sanity granicu → legacy fit.
  assert.equal(out.frame.result, null);
});

test("uzak sjaj uz dno je `thin`; proizvod bez ičega je `none`", () => {
  assert.equal(out.thin_glow.result.officialShadow, "thin");
  assertCoreWithRim(out.thin_glow.result.subjectBox, "sjaj uz dno");
  assert.equal(out.plain.result.officialShadow, "none");
});

test("neprovidan fajl i fajl bez neprovidnog jezgra → None (legacy fit)", () => {
  assert.equal(out.opaque.result, null);
  assert.equal(out.no_core.result, null);
});

test("opseg: samo Carsystem putanje, samo alfa-izveden box; override ostaje `unknown`", () => {
  assert.deepEqual(out._constants.prefixes, ["/products/carsystem/", "/remastered/products/carsystem/"]);
  assert.equal(out._constants.version, 1);
  assert.equal(out._scope.carsystem.officialShadow, "strong");
  assert.deepEqual(out._scope.other_brand, {});
  assert.deepEqual(out._scope.opaque_border, {});
  assert.equal(out._scope.override.officialShadow, "unknown");
});

test("derivat za prikaz (public/remastered) Carsystem slike meri se na svojim pikselima i nasleđuje override", () => {
  assert.equal(out._scope.derivative.officialShadow, "strong");
  assert.equal(out._scope.derivative_override.officialShadow, "unknown");
  assert.deepEqual(out._scope.other_derivative, {});
});
