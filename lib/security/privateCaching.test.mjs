import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/*
 * Privatni podaci se ne keširaju. Strane naloga i portala su dinamičke (Next
 * šalje `private, no-store`); API rute to moraju reći same, jer middleware ne
 * radi na `/api`. Proveru stvarnih zaglavlja radi `.cache/demo/f10-headers.mts`
 * nad pokrenutim build-om; ovaj test čuva da nova ruta ne zaboravi pravilo.
 */
const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
async function walk(dir) {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(rel)));
    else out.push(rel);
  }
  return out;
}

test("svaka API ruta izričito zabranjuje keširanje", async () => {
  const routes = (await walk("app/api")).filter((f) => /route\.tsx?$/.test(f));
  const bez = [];
  for (const rel of routes) {
    if (rel.includes("[...nextauth]")) continue; // Auth.js sam postavlja no-store
    const src = await readFile(path.join(ROOT, rel), "utf8");
    if (!/no-store/i.test(src) && !/\bsyncJson\(/.test(src)) bez.push(rel);
  }
  assert.deepEqual(bez, []);
});

test("strane naloga kupca i portala su dinamičke", async () => {
  const pages = [...(await walk("app/kupac")), ...(await walk("app/portal"))].filter((f) => f.endsWith("page.tsx"));
  const bez = [];
  for (const rel of pages) {
    const src = await readFile(path.join(ROOT, rel), "utf8");
    // Dinamička: izričito, ili čita sesiju/kolačiće (što stranu čini dinamičkom), ili je čista skretnica.
    const dyn = /force-dynamic|revalidate = 0|require(Customer)?Session|requireCapability|requireUser|getPortalUser|getCustomerSession|cookies\(\)|headers\(\)/.test(src);
    const redirectOnly = /\bredirect\(/.test(src) && !/getDb|db\./.test(src);
    if (!dyn && !redirectOnly) bez.push(rel);
  }
  assert.deepEqual(bez, []);
});

test("preusmerenja sa privatnih putanja u middleware-u se ne keširaju", async () => {
  const mw = await readFile(path.join(ROOT, "middleware.ts"), "utf8");
  assert.match(mw, /function privateRedirect\(url: URL\)[\s\S]*?"Cache-Control", "private, no-store"/);
  const customerBlock = mw.slice(mw.indexOf("if (isCustomerRoute(pathname)"), mw.indexOf("return handleSiteRouting"));
  assert.doesNotMatch(customerBlock, /NextResponse\.redirect\(/, "kupčeva preusmerenja idu kroz privateRedirect");
  assert.match(mw.slice(mw.indexOf("function redirectToPortalLogin")), /return privateRedirect\(/);
});
