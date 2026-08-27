import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CAPABILITIES,
  PACKAGE_KEYS,
  ROLES,
  can,
  resolveCapabilities,
} from "./permissions.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const PROCUREMENT = "procurement:order_create";
const CUSTOMER_ORDERS = "customer_orders:create";

const asUser = (role, permissions = []) => ({ role, permissions });

/* -------------------------------------------------------------------------
 * Razdvajanje nabavke i kupčeve porudžbine
 * ---------------------------------------------------------------------- */

test("dvoznacni orders:create vise ne postoji", () => {
  assert.ok(!CAPABILITIES.includes("orders:create"), "stara dozvola je i dalje tu");
  assert.ok(CAPABILITIES.includes(PROCUREMENT));
  assert.ok(CAPABILITIES.includes(CUSTOMER_ORDERS));
});

test("nabavni capability nikada ne otvara portal korpu", () => {
  // Paket „porucivanje" je nabavka od dobavljača.
  const nabavljac = asUser("komercijalista", ["porucivanje"]);
  assert.equal(can(nabavljac, PROCUREMENT), true, "nabavka je izgubljena");
  assert.equal(
    can(nabavljac, CUSTOMER_ORDERS),
    false,
    "nabavni paket i dalje otvara kupcevu porudzbinu",
  );
});

test("nijedan paket ne dodeljuje kupcevu porudzbinu", () => {
  for (const role of ROLES.map((entry) => entry.key)) {
    if (role === "gazda") continue; // gazda ima sve po definiciji
    for (const paket of PACKAGE_KEYS) {
      assert.equal(
        can(asUser(role, [paket]), CUSTOMER_ORDERS),
        false,
        `${role} + paket ${paket} je dobio ${CUSTOMER_ORDERS}`,
      );
    }
  }
});

test("nijedna uloga bez paketa nema nijednu od dve porudzbine", () => {
  for (const role of ROLES.map((entry) => entry.key)) {
    if (role === "gazda") continue;
    assert.equal(can(asUser(role), PROCUREMENT), false, `${role} ima nabavku`);
    assert.equal(
      can(asUser(role), CUSTOMER_ORDERS),
      false,
      `${role} ima kupcevu porudzbinu`,
    );
  }
});

test("magacioner ne moze kreirati kupcevu porudzbinu ni sa jednim paketom", () => {
  for (const paket of PACKAGE_KEYS) {
    assert.equal(can(asUser("magacioner", [paket]), CUSTOMER_ORDERS), false, paket);
  }
});

test("kancelarija se ne prosiruje bez dokaza iz ugovora", () => {
  const kancelarija = asUser("kancelarija");
  assert.equal(can(kancelarija, PROCUREMENT), false);
  assert.equal(can(kancelarija, CUSTOMER_ORDERS), false);
});

test("gazda zadrzava pun pristup", () => {
  const gazda = asUser("gazda");
  for (const capability of CAPABILITIES) {
    assert.equal(can(gazda, capability), true, `gazdi nedostaje ${capability}`);
  }
});

test("nepoznata uloga i nepoznat paket ne daju nista", () => {
  assert.equal(resolveCapabilities("nepostojeca").size, 0);
  const sNepoznatim = resolveCapabilities("magacioner", ["ne-postoji"]);
  const bez = resolveCapabilities("magacioner");
  assert.deepEqual([...sNepoznatim].sort(), [...bez].sort());
});

/* -------------------------------------------------------------------------
 * Jedan model dozvola — legacy mora biti nedostižan iz aplikacije
 * ---------------------------------------------------------------------- */

const LEGACY_MODULE = "permissions/portal-permissions";

/**
 * Svi izvorni fajlovi ispod datog korena.
 *
 * Testovi se izostavljaju: oni ne postoje u isporučenom kodu, a sam ovaj fajl
 * pominje staru putanju u konstanti — bez izuzimanja bi uhvatio samog sebe.
 */
async function collectSources(dir, { includeTests = false } = {}) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectSources(full, { includeTests })));
      continue;
    }
    if (!/\.(ts|tsx|mjs|js)$/.test(entry.name)) continue;
    if (!includeTests && /\.test\.(ts|tsx|mjs|js)$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

/** Uvozi iz jednog fajla, razrešeni na putanje u repozitorijumu. */
async function importsOf(file) {
  const source = await readFile(file, "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const specifiers = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

  return specifiers
    .filter((spec) => spec.startsWith("@/") || spec.startsWith("."))
    .map((spec) =>
      spec.startsWith("@/")
        ? resolve(ROOT, spec.slice(2))
        : resolve(file, "..", spec),
    );
}

/**
 * Prati graf uvoza počev od `app/` i vraća sve dostignute module.
 *
 * Ovo je jedini pošten dokaz da je stari model dozvola stvarno mrtav: samo
 * odsustvo uvoza u jednom fajlu ne kaže ništa o tome šta taj fajl dalje uvozi.
 */
async function reachableFromApp() {
  const seen = new Set();
  const queue = await collectSources(join(ROOT, "app"));

  while (queue.length > 0) {
    const file = queue.pop();
    const key = file.replace(/\.(ts|tsx|mjs|js)$/, "");
    if (seen.has(key)) continue;
    seen.add(key);

    let targets = [];
    try {
      targets = await importsOf(file);
    } catch {
      continue; // direktorijum ili nepostojeći modul — nije uvoz izvora
    }

    for (const target of targets) {
      const candidates = [
        `${target}.ts`,
        `${target}.tsx`,
        `${target}.mjs`,
        `${target}.js`,
        join(target, "index.ts"),
        join(target, "index.tsx"),
      ];
      for (const candidate of candidates) {
        const candidateKey = candidate.replace(/\.(ts|tsx|mjs|js)$/, "");
        if (!seen.has(candidateKey)) queue.push(candidate);
      }
    }
  }
  return seen;
}

test("stari model dozvola nije dostizan ni iz jedne rute", async () => {
  const reachable = await reachableFromApp();
  const legacyKey = resolve(ROOT, LEGACY_MODULE);

  assert.ok(
    !reachable.has(legacyKey),
    `stari model je dostizan iz app/: ${relative(ROOT, legacyKey)}`,
  );
});

test("zivi sloj ne uvozi stari model ni posredno", async () => {
  for (const root of ["app", "components", "lib"]) {
    for (const file of await collectSources(join(ROOT, root))) {
      const source = await readFile(file, "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      assert.ok(
        !code.includes(LEGACY_MODULE),
        `${relative(ROOT, file)} uvozi stari model`,
      );
    }
  }
});

test("stari model postoji samo u izolovanom, nemontiranom sloju", async () => {
  const importers = [];
  for (const root of ["app", "components", "lib", "features"]) {
    for (const file of await collectSources(join(ROOT, root))) {
      const source = await readFile(file, "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      if (code.includes(LEGACY_MODULE)) importers.push(relative(ROOT, file));
    }
  }

  // Preostali korisnici su isključivo moduli ranije verzije, koji nisu vezani
  // ni za jednu rutu (vidi fixtures/dev/README.md). Nijedan nije u `app/`,
  // `components/` ni `lib/`.
  for (const importer of importers) {
    assert.ok(
      importer.startsWith("features/portal/"),
      `stari model se koristi van izolovanog sloja: ${importer}`,
    );
  }
});

test("serverska kapija je i dalje jedina prava provera", async () => {
  const session = await readFile(
    new URL("./session.ts", import.meta.url),
    "utf8",
  );
  assert.match(session, /export async function requireCapability/);
  assert.match(session, /if \(!can\(user, capability\)\) forbidden\(\)/);
  // Autorizacija se ne sme oslanjati na putanju.
  const code = session.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /pathname/);
});
