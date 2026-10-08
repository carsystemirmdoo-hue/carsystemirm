import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DpapiError,
  MAX_PODATKA_BAJTOVA,
  NATIVNI_MODUL,
  NATIVNI_MODUL_SHA256,
  dpapiOperacija,
  proveri,
  sacuvaj,
  ucitaj,
  ucitajNativni,
} from "../src/keystore/windows-dpapi.mjs";

/**
 * Kanal DPAPI adaptera: nativni modul (`@primno/dpapi` 2.0.1) u istom procesu.
 *
 * Ranije: `powershell.exe` sa `-EncodedCommand`, pa sa `-File` — oba je
 * blokirala antivirusna heuristika (Avast IDP.HELU.PSE92 / PSD11).
 *
 * Ovi testovi ne traže Windows: `dlopen` i vezivanje se zamenjuju lažnim, koji
 * beleže TAČNO šta su dobili. Lažni DPAPI je reverzibilan XOR sa markerom —
 * dovoljno da se proveri tok i format, ne i kriptografija. Stvarni modul meri
 * `[WIN]` grupa u `windows-smoke.test.mjs`.
 */

/** Sintetički „ključ" — nikad pravi, i prepoznatljiv u izlazu. */
const KLJUC = new Uint8Array(Buffer.from("sinteticki-kljuc-samo-za-test-0123456789abcdef"));
const MARKER = Buffer.from("LAZNI-DPAPI:");

function lazanDpapi({ protectBaca, unprotectBaca, vrati } = {}) {
  const zapis = { pozivi: [] };
  const xor = (u) => Buffer.from(u).map((b) => b ^ 0x5a);
  return {
    zapis,
    vezivanje: {
      protectData(podatak, entropija, opseg) {
        zapis.pozivi.push({ fn: "protect", podatak: Buffer.from(podatak), entropija, opseg, tip: podatak?.constructor?.name });
        if (protectBaca) throw protectBaca;
        if (vrati !== undefined) return vrati;
        return new Uint8Array(Buffer.concat([MARKER, xor(podatak)]));
      },
      unprotectData(blob, entropija, opseg) {
        zapis.pozivi.push({ fn: "unprotect", podatak: Buffer.from(blob), entropija, opseg });
        if (unprotectBaca) throw unprotectBaca;
        if (vrati !== undefined) return vrati;
        const b = Buffer.from(blob);
        if (!b.subarray(0, MARKER.length).equals(MARKER)) throw new Error("Encryption/Decryption failed. Error code: 13");
        return new Uint8Array(xor(b.subarray(MARKER.length)));
      },
    },
  };
}

/** Opcije učitavanja za granu „Windows x64" na bilo kojoj mašini. */
function opcijeUcitavanja(bajtovi, dodatno = {}) {
  return {
    putanja: "C:\\nije\\bitno\\dpapi.node",
    ocekivanSha: createHash("sha256").update(bajtovi).digest("hex"),
    citaj: async () => bajtovi,
    platforma: "win32",
    arhitektura: "x64",
    ...dodatno,
  };
}

/* ------------------------------------------------------------- učitavanje */

test("isporučeni .node fajl odgovara pinovanom SHA-256", () => {
  const sha = createHash("sha256").update(readFileSync(NATIVNI_MODUL)).digest("hex");
  assert.equal(sha, NATIVNI_MODUL_SHA256);
});

test("isporučeni .node je PE32+ x64 DLL koji uvozi samo kernel32 i crypt32 (Crypt[Un]protectData)", () => {
  const b = readFileSync(NATIVNI_MODUL);
  assert.equal(b.toString("latin1", 0, 2), "MZ");
  const pe = b.readUInt32LE(0x3c);
  assert.equal(b.toString("latin1", pe, pe + 4), "PE\0\0");
  assert.equal(b.readUInt16LE(pe + 4), 0x8664, "nije x64");
  const tekst = b.toString("latin1");
  const dll = [...new Set((tekst.match(/[A-Za-z0-9_-]+\.dll/gi) ?? []).map((x) => x.toLowerCase()))].sort();
  assert.deepEqual(dll, ["crypt32.dll", "kernel32.dll"]);
  assert.match(tekst, /CryptProtectData/);
  assert.match(tekst, /CryptUnprotectData/);
  assert.match(tekst, /napi_register_module_v1/);
  // Bez mreže, procesa i registra.
  assert.doesNotMatch(tekst, /ws2_32|wininet|winhttp|CreateProcess|ShellExecute|RegSetValue|advapi32/i);
});

test("učitavanje odbija drugu platformu i arhitekturu pre čitanja fajla", async () => {
  let citano = false;
  const citaj = async () => {
    citano = true;
    return Buffer.alloc(1);
  };
  for (const [platforma, arhitektura] of [["darwin", "x64"], ["linux", "x64"], ["win32", "arm64"], ["win32", "ia32"]]) {
    await assert.rejects(ucitajNativni({ platforma, arhitektura, citaj }), { code: "dpapi_native_unsupported" });
  }
  assert.equal(citano, false);
});

test("nedostajući modul → dpapi_native_missing; izmenjen → dpapi_native_altered, bez učitavanja", async () => {
  let ucitano = 0;
  const dlopen = () => {
    ucitano += 1;
  };
  await assert.rejects(
    ucitajNativni({ ...opcijeUcitavanja(Buffer.from("x")), citaj: async () => { throw Object.assign(new Error("ENOENT C:\\Users\\x"), { code: "ENOENT" }); }, dlopen }),
    (e) => e.code === "dpapi_native_missing" && !/Users/.test(e.message),
  );
  await assert.rejects(
    ucitajNativni({ ...opcijeUcitavanja(Buffer.from("isporuceno")), citaj: async () => Buffer.from("izmenjeno"), dlopen }),
    { code: "dpapi_native_altered" },
  );
  assert.equal(ucitano, 0, "izmenjen ili nedostajući modul ne sme da se učita");
});

test("neuspeo dlopen i modul bez funkcija daju stabilan kod, bez poruke izvora", async () => {
  const b = Buffer.from("modul");
  await assert.rejects(
    ucitajNativni(opcijeUcitavanja(b, { dlopen: () => { throw new Error("\\\\?\\C:\\Program Files\\x.node: %1 is not a valid Win32 application"); } })),
    (e) => e.code === "dpapi_native_load_failed" && !/Program Files|Win32/.test(e.message),
  );
  await assert.rejects(
    ucitajNativni(opcijeUcitavanja(b, { dlopen: (m) => { m.exports = { protectData: () => {} }; } })),
    { code: "dpapi_native_invalid" },
  );
});

test("ispravan modul: dlopen dobija tačno proverenu putanju i vraća obe funkcije", async () => {
  const b = Buffer.from("modul");
  const viđeno = [];
  const v = await ucitajNativni(
    opcijeUcitavanja(b, {
      dlopen: (m, p) => {
        viđeno.push(p);
        m.exports = { protectData: () => 1, unprotectData: () => 2, visak: () => 3 };
      },
    }),
  );
  assert.deepEqual(viđeno, ["C:\\nije\\bitno\\dpapi.node"]);
  assert.deepEqual(Object.keys(v).sort(), ["protectData", "unprotectData"]);
  assert.ok(Object.isFrozen(v));
});

test("van Windowsa podrazumevano učitavanje odbija (fail closed)", { skip: process.platform === "win32" }, async () => {
  await assert.rejects(ucitajNativni(), { code: "dpapi_native_unsupported" });
  await assert.rejects(dpapiOperacija("zastiti", KLJUC), { code: "dpapi_native_unsupported" });
});

/* -------------------------------------------------------------- operacija */

test("poziv: opseg CurrentUser, entropija null, čist Uint8Array; ulaz obrisan posle poziva", async () => {
  const { vezivanje, zapis } = lazanDpapi();
  const blob = await dpapiOperacija("zastiti", KLJUC, { vezivanje });
  const nazad = await dpapiOperacija("otkljucaj", blob, { vezivanje });
  assert.deepEqual(Buffer.from(nazad), Buffer.from(KLJUC));
  for (const p of zapis.pozivi) {
    assert.equal(p.opseg, "CurrentUser");
    assert.equal(p.entropija, null);
  }
  assert.equal(zapis.pozivi[0].tip, "Uint8Array");
  assert.deepEqual(KLJUC.subarray(0, 10), new Uint8Array(Buffer.from("sinteticki")), "izvorni niz pozivaoca ne sme da se obriše");
});

test("neispravan režim i ulaz se odbijaju pre poziva", async () => {
  const { vezivanje, zapis } = lazanDpapi();
  await assert.rejects(dpapiOperacija("Bypass", KLJUC, { vezivanje }), { code: "dpapi_mode_invalid" });
  for (const los of [undefined, null, "AAAA", [], new Uint8Array(0), new Uint8Array(MAX_PODATKA_BAJTOVA + 1)]) {
    await assert.rejects(dpapiOperacija("zastiti", los, { vezivanje }), { code: "dpapi_input_invalid" });
  }
  assert.equal(zapis.pozivi.length, 0);
});

test("greška DPAPI-ja → kod sa Windows brojem u heksu; poruka bez sadržaja izvora", async () => {
  const pogresanNalog = new Error("Encryption/Decryption failed. Error code: 2148073483 C:\\Users\\Tajna sinteticki-kljuc");
  const { vezivanje } = lazanDpapi({ unprotectBaca: pogresanNalog, protectBaca: new TypeError("First argument, data, must be a valid Uint8Array") });
  await assert.rejects(dpapiOperacija("otkljucaj", KLJUC, { vezivanje }), (e) => {
    assert.ok(e instanceof DpapiError);
    assert.equal(e.code, "dpapi_unprotect_failed_8009000b");
    assert.match(e.code, /^dpapi_[a-z0-9_]{1,40}$/, "kod mora proći filter CLI-ja");
    assert.doesNotMatch(e.message, /Users|Tajna|sinteticki|Error code/);
    return true;
  });
  await assert.rejects(dpapiOperacija("zastiti", KLJUC, { vezivanje }), { code: "dpapi_protect_failed" });
});

test("prazan ili neispravan izlaz modula je greška, ne prazan ključ", async () => {
  for (const vrati of [new Uint8Array(0), "AAAA", null, new Uint8Array(MAX_PODATKA_BAJTOVA + 1)]) {
    const { vezivanje } = lazanDpapi({ vrati });
    await assert.rejects(dpapiOperacija("otkljucaj", KLJUC, { vezivanje }), { code: "dpapi_unprotect_empty" });
    await assert.rejects(dpapiOperacija("zastiti", KLJUC, { vezivanje }), { code: "dpapi_protect_empty" });
  }
});

/* ----------------------------------------------------- format fajla ključa */

test("sacuvaj/ucitaj: format cs-dpapi-v1 + base64 bloba, plaintext nikad u fajlu", async () => {
  const { vezivanje } = lazanDpapi();
  const baza = await mkdtemp(join(tmpdir(), "cs-dpapi-test-"));
  try {
    const p = join(baza, "device-key.bin");
    await sacuvaj({ putanja: p, privateKeyPkcs8Der: KLJUC }, { vezivanje });
    const fajl = await readFile(p, "utf8");
    assert.match(fajl, /^cs-dpapi-v1\n[A-Za-z0-9+/]+={0,2}\n$/);
    assert.ok(!fajl.includes(Buffer.from(KLJUC).toString("base64").slice(0, 24)));
    assert.ok(!fajl.includes("sinteticki"));
    assert.deepEqual(Buffer.from(await ucitaj({ putanja: p }, { vezivanje })), Buffer.from(KLJUC));
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("POSTOJEĆI fajl ključa (napisan ranijim PowerShell kanalom) se čita bez izmene formata", async () => {
  /*
   * Raniji kanal je pisao `cs-dpapi-v1\n<ToBase64String(ProtectedData.Protect(der))>\n`.
   * Novi `ucitaj` mora otključati tačno taj blob: ovde se proverava da u
   * `unprotectData` stižu ISTI bajtovi koje je stari kanal upisao, i da se fajl
   * ne prepisuje.
   */
  const { vezivanje, zapis } = lazanDpapi();
  const stariBlob = Buffer.from(await dpapiOperacija("zastiti", KLJUC, { vezivanje }));
  zapis.pozivi.length = 0;
  const baza = await mkdtemp(join(tmpdir(), "cs-dpapi-test-"));
  try {
    const p = join(baza, "device-key.bin");
    const sadrzaj = `cs-dpapi-v1\n${stariBlob.toString("base64")}\n`;
    await writeFile(p, sadrzaj, "utf8");
    const kljuc = await ucitaj({ putanja: p }, { vezivanje });
    assert.deepEqual(Buffer.from(kljuc), Buffer.from(KLJUC));
    assert.equal(zapis.pozivi.length, 1);
    assert.equal(zapis.pozivi[0].fn, "unprotect");
    assert.deepEqual(zapis.pozivi[0].podatak, stariBlob);
    assert.equal(await readFile(p, "utf8"), sadrzaj, "fajl ključa je izmenjen");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("neispravan fajl ključa → dpapi_key_file_invalid, bez poziva DPAPI-ja", async () => {
  const { vezivanje, zapis } = lazanDpapi();
  const baza = await mkdtemp(join(tmpdir(), "cs-dpapi-test-"));
  try {
    const p = join(baza, "device-key.bin");
    for (const s of ["", "cs-dpapi-v1\n", "-----BEGIN PRIVATE KEY-----\nAAAA\n", "cs-dpapi-v2\nAAAA\n", "cs-dpapi-v1\nAA AA;rm\n"]) {
      await writeFile(p, s, "utf8");
      await assert.rejects(ucitaj({ putanja: p }, { vezivanje }), { code: "dpapi_key_file_invalid" });
    }
    assert.equal(zapis.pozivi.length, 0);
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("proveri(): zastiti → otkljucaj nad konstantom; neslaganje je greška", async () => {
  const { vezivanje } = lazanDpapi();
  assert.deepEqual(await proveri({ vezivanje }), { adapter: "windows-dpapi-currentuser", ok: true, kanal: "nativni" });
  const pokvaren = {
    protectData: (d) => new Uint8Array(Buffer.from(d)),
    unprotectData: () => new Uint8Array(Buffer.from("drugo")),
  };
  await assert.rejects(proveri({ vezivanje: pokvaren }), { code: "dpapi_roundtrip_mismatch" });
});

/* --------------------------------------------------------- izvor adaptera */

test("adapter ne pokreće procese i ne zna za PowerShell", async () => {
  const izvor = await readFile(new URL("../src/keystore/windows-dpapi.mjs", import.meta.url), "utf8");
  const kod = izvor.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(kod, /child_process|spawn|(?<!\.)\bexec(File|Sync)?\(|powershell|ProtectedData|EncodedCommand/i);
  assert.match(kod, /process\.dlopen/);
  assert.doesNotMatch(kod, /console\.|process\.std(out|err)/, "adapter ne ispisuje ništa");
});
