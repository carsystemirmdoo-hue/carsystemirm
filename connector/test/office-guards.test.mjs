import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Kancelarijske zaštite (docs/b2b/49): storno ne nestaje među nepodržanima,
 * istorija pre `posaljiOdDatuma` se ne šalje, a folder nove godine se vidi.
 */
const FIXTURES = fileURLToPath(new URL("../../fixtures/dev/biznisoft/", import.meta.url));
const dist = (m) => new URL(`../dist/connector/src/${m}`, import.meta.url);
const [pipeline, store, config, cli] = await Promise.all(["pipeline.mjs", "store.mjs", "config.mjs", "cli.mjs"].map((m) => import(dist(m))));

async function okruzenje(posaljiOdDatuma = null) {
  const dir = await mkdtemp(join(tmpdir(), "cs-office-"));
  const izvor = join(dir, "Fakture", "Fakture 2026");
  await mkdir(izvor, { recursive: true });
  const st = store.otvoriStore({ putanja: join(dir, "queue.db"), identitet: { origin: "https://pilot.invalid", deviceCode: "KANC-01" } });
  const konfiguracija = config.proveriKonfiguraciju({
    serverOrigin: "https://pilot.invalid", deviceCode: "KANC-01", keyId: "k1", sourceSystem: "biznisoft", issuerCode: "CSRM",
    izvorniFolder: izvor, ...(posaljiOdDatuma ? { posaljiOdDatuma } : {}),
  });
  const granice = { maxBajtova: 20 * 1024 * 1024, maxNovihPoCiklusu: 200, maxPopisa: 200_000, stabilnostMs: 5, stabilnostPokusaja: 3 };
  const ciklus = () => pipeline.skenirajURed({ store: st, konfiguracija, granice, log: { zapisi: () => {} } });
  return { dir, izvor, st, konfiguracija, ciklus, zatvori: async () => { st.zatvori(); await rm(dir, { recursive: true, force: true }); } };
}

test("storno se beleži sa posebnim razlogom i vidi u spisku za ručni upload", async () => {
  const o = await okruzenje();
  try {
    await cp(join(FIXTURES, "storno.pdf"), join(o.izvor, "Fak.storno-1.pdf"));
    await o.ciklus();
    const lista = o.st.stornaZaRucniUpload();
    assert.equal(lista.length, 1, "storno nije u spisku za ručni upload");
    assert.match(lista[0].putanja, /Fak\.storno-1\.pdf$/);
  } finally {
    await o.zatvori();
  }
});

test("dokument izdat pre posaljiOdDatuma je poznat i nikad nije spreman za slanje", async () => {
  const o = await okruzenje("2999-01-01");
  try {
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(o.izvor, "Fak.1.pdf"));
    await o.ciklus();
    assert.equal(o.st.brojPoRazlogu(pipeline.RAZLOG_PRE_POCETKA), 1);
    assert.equal(o.st.zaSlanje({ limit: 50, lokalniDatum: "2026-10-06" }).length, 0, "istorija je stavljena u red za slanje");
    const drugi = await o.ciklus();
    assert.equal(drugi.poznato, 1, "ponovni prolaz ne prepoznaje već viđen dokument");
  } finally {
    await o.zatvori();
  }
});

test("bez posaljiOdDatuma isti dokument ide u red (ponašanje kao ranije)", async () => {
  const o = await okruzenje();
  try {
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(o.izvor, "Fak.1.pdf"));
    await o.ciklus();
    assert.equal(o.st.zaSlanje({ limit: 50, lokalniDatum: "2026-10-06" }).length, 1);
  } finally {
    await o.zatvori();
  }
});

test("pogrešan posaljiOdDatuma odbija konfiguraciju", () => {
  assert.throws(() => config.proveriKonfiguraciju({ serverOrigin: "https://x.invalid", deviceCode: "K", keyId: "k1", sourceSystem: "b", issuerCode: "C", izvorniFolder: "/x", posaljiOdDatuma: "6.10.2026" }), /ISO/);
});

test("folder nove godine pored izvora se prijavljuje, isti i stariji ne", async () => {
  const o = await okruzenje();
  try {
    assert.equal(await cli.noviGodisnjiFolder(o.izvor), null);
    await mkdir(join(o.dir, "Fakture", "Fakture 2025"));
    assert.equal(await cli.noviGodisnjiFolder(o.izvor), null);
    await mkdir(join(o.dir, "Fakture", "Fakture 2027"));
    assert.equal((await cli.noviGodisnjiFolder(o.izvor))?.folder, "Fakture 2027");
  } finally {
    await o.zatvori();
  }
});

test("zaštita pristupa (Vercel) ide kao zaglavlje samo kada je podešena; potpis ostaje", async () => {
  const { generateKeyPairSync } = await import("node:crypto");
  const client = await import(dist("client.mjs"));
  const { privateKey } = generateKeyPairSync("ed25519");
  const der = privateKey.export({ format: "der", type: "pkcs8" });
  const viđeno = [];
  const fetchImpl = async (_url, init) => {
    viđeno.push(init.headers);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const osnovno = { origin: "https://pilot.invalid", deviceCode: "KANC-01", keyId: "k1", privateKeyPkcs8Der: der, fetchImpl };
  await client.posaljiHeartbeat({ ...osnovno, zastitaPristupa: "tajna-zastite" });
  await client.posaljiHeartbeat(osnovno);
  assert.equal(viđeno[0]["x-vercel-protection-bypass"], "tajna-zastite");
  assert.ok(Object.values(viđeno[0]).some((v) => typeof v === "string" && v.length > 40), "nema potpisa");
  assert.equal(viđeno[1]["x-vercel-protection-bypass"], undefined);
  assert.equal(config.proveriKonfiguraciju({ serverOrigin: "https://x.invalid", deviceCode: "K", keyId: "k1", sourceSystem: "b", issuerCode: "C", izvorniFolder: "/x", vercelZastita: " t " }).vercelZastita, "t");
});

test("stariji račun izvezen POSLE početka slanja se izdvaja za ručnu proveru; stari fajl iz arhive ne", async () => {
  const { utimes } = await import("node:fs/promises");
  const danas = new Date();
  const iso = `${danas.getFullYear()}-${String(danas.getMonth() + 1).padStart(2, "0")}-${String(danas.getDate()).padStart(2, "0")}`;
  const o = await okruzenje(iso);
  try {
    // Isti dokument (datum pre danas) dva puta: jednom kao stari fajl arhive, jednom kao današnji izvoz.
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(o.izvor, "Fak.kasni.pdf"));
    await cp(join(FIXTURES, "vise-stavki.pdf"), join(o.izvor, "Fak.arhiva.pdf"));
    const staro = new Date("2020-01-15T10:00:00");
    await utimes(join(o.izvor, "Fak.arhiva.pdf"), staro, staro);
    await o.ciklus();
    assert.equal(o.st.brojPoRazlogu(pipeline.RAZLOG_KASNI_IZVOZ), 1, "naknadni izvoz nije izdvojen");
    assert.equal(o.st.brojPoRazlogu(pipeline.RAZLOG_PRE_POCETKA), 1, "stari fajl arhive nije tiho zabeležen");
    const rucno = o.st.zaRucnuProveru();
    assert.equal(rucno.length, 1);
    assert.match(rucno[0].putanja, /Fak\.kasni\.pdf$/);
    assert.equal(o.st.zaSlanje({ limit: 50, lokalniDatum: iso }).length, 0, "ništa od toga ne sme samo da ode");
  } finally {
    await o.zatvori();
  }
});
