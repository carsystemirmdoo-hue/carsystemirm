/*
 * GAP-008: interne demo strane su zatvorene na Vercel Production i Preview,
 * a dostupne samo lokalno i u `vercel dev`.
 *
 *   npm run test:internal-routes
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INTERNAL_DEMO_NOT_FOUND_PATH,
  internalDemoRoutesAllowed,
  isInternalDemoRoute,
} from "./internal-demo-routes.mjs";

test("prepoznaje sve interne demo rute i samo njih", () => {
  for (const pathname of [
    "/interaction-demo",
    "/interaction-demo/cursor-states",
    "/interaction-demo/split-contact-cta-wide",
    "/social-exports",
    "/social-exports/spray-reveal",
  ]) {
    assert.equal(isInternalDemoRoute(pathname), true, pathname);
  }
  for (const pathname of ["/", "/kontakt", "/interaction-demos", "/social-exports-x", "/proizvodi/interaction-demo"]) {
    assert.equal(isInternalDemoRoute(pathname), false, pathname);
  }
});

test("zatvorene na Production i Preview, dostupne samo lokalno i u vercel dev", () => {
  assert.equal(internalDemoRoutesAllowed("production"), false);
  assert.equal(internalDemoRoutesAllowed("preview"), false);
  assert.equal(internalDemoRoutesAllowed(undefined), true);
  assert.equal(internalDemoRoutesAllowed(""), true);
  assert.equal(internalDemoRoutesAllowed("development"), true);
});

test("middleware primenjuje pravilo pre održavanja, kanonskog hosta i noindex-a", () => {
  const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const gate = source.indexOf("isInternalDemoRoute(pathname) && !internalDemoRoutesAllowed(process.env.VERCEL_ENV)");
  assert.ok(gate > 0, "middleware ne poziva pravilo");
  const routing = source.indexOf("async function handleSiteRouting");
  assert.ok(gate > routing, "pravilo nije u handleSiteRouting");
  assert.ok(gate < source.indexOf("const isProductionDeployment"), "pravilo mora biti pre ostalog rutiranja");
  assert.match(source.slice(gate, gate + 300), /NextResponse\.rewrite\(new URL\(INTERNAL_DEMO_NOT_FOUND_PATH/);
  // Ciljna putanja zaista nema stranu.
  assert.match(INTERNAL_DEMO_NOT_FOUND_PATH, /^\/__/);
});
