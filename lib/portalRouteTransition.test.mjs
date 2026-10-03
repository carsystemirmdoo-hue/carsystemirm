import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { isPortalPath, PORTAL_ROUTE_TRANSITION_RELEASE, releasePortalRouteTransition } from "./portalRouteTransition.mjs";

/** Minimalan dokument: koreni layout ga servira u stanju „booting“. */
function bootingDocument({ withBody }) {
  const busy = new Map([["aria-busy", "true"]]);
  const body = { removeAttribute: (n) => busy.delete(n), getAttribute: (n) => busy.get(n) ?? null };
  const listeners = [];
  const doc = {
    documentElement: { dataset: { routeTransition: "booting" } },
    body: withBody ? body : null,
    addEventListener: (type, fn) => listeners.push([type, fn]),
  };
  return { doc, body, fireDomContentLoaded: () => { doc.body = body; for (const [t, fn] of listeners) if (t === "DOMContentLoaded") fn(); } };
}

const run = (path, doc) => vm.runInNewContext(`(function(){ var path = ${JSON.stringify(path)};${PORTAL_ROUTE_TRANSITION_RELEASE}})()`, { document: doc });

test("puno učitavanje portala ne zadržava zaključan skrol (regresija: filter u preporukama)", () => {
  // Skript u <head>: body još ne postoji.
  const { doc, body, fireDomContentLoaded } = bootingDocument({ withBody: false });
  run("/portal/preporuke", doc);
  assert.equal(doc.documentElement.dataset.routeTransition, undefined, "html ostaje u stanju booting");
  fireDomContentLoaded();
  assert.equal(body.getAttribute("aria-busy"), null, "body ostaje aria-busy");

  const root = bootingDocument({ withBody: true });
  run("/portal", root.doc);
  assert.equal(root.doc.documentElement.dataset.routeTransition, undefined);
  assert.equal(root.body.getAttribute("aria-busy"), null);
});

test("javni sajt i dalje prolazi kroz prelaz stranica", () => {
  for (const path of ["/", "/katalog", "/prijava", "/portalx"]) {
    const { doc } = bootingDocument({ withBody: true });
    run(path, doc);
    assert.equal(doc.documentElement.dataset.routeTransition, "booting", path);
  }
  assert.equal(isPortalPath("/portal/kupci/1"), true);
  assert.equal(isPortalPath("/portalx"), false);
});

test("React rezerva skida isto stanje", () => {
  const { doc, body } = bootingDocument({ withBody: true });
  releasePortalRouteTransition(doc);
  assert.equal(doc.documentElement.dataset.routeTransition, undefined);
  assert.equal(body.getAttribute("aria-busy"), null);
});

test("isečak je ugrađen u inline skript i u portalsku granu MotionSystem-a", () => {
  const script = readFileSync(new URL("../components/layout/SiteAccessHandoffScript.tsx", import.meta.url), "utf8");
  assert.match(script, /var path = window\.location\.pathname;\n\$\{PORTAL_ROUTE_TRANSITION_RELEASE\}/);
  const motion = readFileSync(new URL("../components/motion/MotionSystem.tsx", import.meta.url), "utf8");
  assert.match(motion, /startsWith\("\/portal"\)\) return <PortalNoMotion>/);
  assert.match(motion, /releasePortalRouteTransition\(document\)/);
});
