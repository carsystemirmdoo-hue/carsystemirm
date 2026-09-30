import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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

const kupacActions = (await walk("app/kupac")).filter((f) => f.endsWith("actions.ts"));

test("svaka kupčeva server akcija traži kupčevu sesiju u svom telu", async () => {
  assert.ok(kupacActions.length > 0);
  const bez = [];
  for (const rel of kupacActions) {
    const source = await readFile(path.join(ROOT, rel), "utf8");
    if (!source.includes('"use server"')) continue;
    for (const m of source.matchAll(/export async function (\w+)/g)) {
      const start = m.index;
      const next = source.indexOf("export async function", start + 10);
      const body = source.slice(start, next === -1 ? undefined : next);
      if (!/\brequireCustomerSession\(/.test(body)) bez.push(`${rel}:${m[1]}`);
    }
  }
  assert.deepEqual(bez, []);
});

test("kupčeva akcija ne prima firmu ni cenu od pregledača", async () => {
  for (const rel of kupacActions) {
    const source = await readFile(path.join(ROOT, rel), "utf8");
    for (const m of source.matchAll(/export async function (\w+)\(([^)]*)\)/g)) {
      // Nazivi POLJA ulaza (npr. `price:`), ne vrednosti — `kind: "no_price"` nije cena.
      assert.doesNotMatch(m[2], /\b(customerId|\w*price|cena|\w*amount)\s*\??:/i, `${rel}:${m[1]} prima ${m[2]}`);
    }
  }
});

test("korpa na portalu (osoblje) ostaje odvojena od kupčeve korpe", async () => {
  const cart = await readFile(path.join(ROOT, "app/kupac/korpa/page.tsx"), "utf8");
  assert.match(cart, /requireCustomerSession\("\/kupac\/korpa"\)/);
  assert.doesNotMatch(cart, /getPortalUser|requireCapability/);
});

test("stražar hvata polje cene ili firme u ulazu akcije", () => {
  const re = /\b(customerId|\w*price|cena|\w*amount)\s*\??:/i;
  assert.match("input: { netPrice: number }", re);
  assert.match("input: { customerId: string }", re);
  assert.match("input: { price?: number }", re);
  assert.doesNotMatch('input: { kind: "no_price" | "special_terms"; quantity: string }', re);
});
