import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  bezbedanKod,
  izmeri,
  KODOVI,
  oceniLockdown,
  PROBA_OCEKIVANO,
  PROBA_SKRIPTA,
  redigovan,
  sastaviIzvestaj,
  STDIN_PROBA,
  STDIN_PROGRAM,
} from "../smoke/diagnose-core.mjs";

/**
 * Dijagnostika mora da preživi sopstveni pokretač.
 *
 * Na stvarnom Windows 10 Pro / Node 24.20.0 prva verzija je pala u `spawnSync`
 * PRE ijednog merenja i na ekran ispisala stack trace sa `file:///C:/…`
 * putanjom i korisničkim folderom. Dva odvojena propusta, pa i dva sloja
 * testova ovde: kontrolisan pad, i redakcija svega što izlazi.
 */

const META = { shortHead: "b26618b", sourceHead: "b26618b19d1f558b70bc466ef36f09da01f29d40" };
const OKOLINA = { os: "Windows 10 Pro", build: "10.0.19045", arch: "x64", node: "24.20.0" };

/** Tačan oblik izuzetka koji je pao na kancelarijskom računaru. */
function einval() {
  return Object.assign(
    new Error(
      "spawnSync powershell.exe EINVAL\n" +
        "    at Object.spawnSync (node:internal/child_process:1120:20)\n" +
        "    at ps (file:///C:/Users/Vlasnik/Desktop/Carsystem%20Smoke/smoke/diagnose.mjs:95:13)",
    ),
    { code: "EINVAL", syscall: "spawnSync powershell.exe", path: "powershell.exe" },
  );
}

/** Sve što izveštaj i ekran NE smeju da sadrže. */
const ZABRANJENO = [
  [/file:\/\/\//i, "file:/// putanja"],
  [/[A-Za-z]:[\\/]/, "apsolutna Windows putanja"],
  [/\/Users\/|\\Users\\/i, "korisnički folder"],
  [/\n\s+at\s|\bat Object\.|\bat ps\b/, "stack trace"],
  [/ErrorActionPreference|Add-Type|ProtectedData|\[Console\]|PSVersionTable/, "sadržaj skripte"],
  [/[A-Za-z0-9+/]{40,}={0,2}/, "dugačak base64"],
  [/-----BEGIN/, "PEM blok"],
];

function proveriRedakciju(tekst, gde) {
  for (const [obrazac, opis] of ZABRANJENO) {
    assert.ok(!obrazac.test(tekst), `${gde} sadrži ${opis}`);
  }
}

/* =========================================================================
 * Kontrolisan pad
 * ====================================================================== */

test("EINVAL u pokretaču daje kontrolisan ishod, ne izuzetak", async () => {
  const linije = [];
  const rezultat = await izmeri({
    mehanizmi: [
      { id: "spawn-stdin", opis: "spawn + stdin", pokreni: () => Promise.reject(einval()) },
      { id: "spawnSync-input", opis: "spawnSync + input", pokreni: () => { throw einval(); } },
    ],
    log: (r) => linije.push(r),
  });

  assert.equal(rezultat.kod, KODOVI.nemaMehanizma);
  assert.equal(rezultat.radniMehanizam, null);
  assert.equal(rezultat.nalazi.length, 2, "oba pokušaja moraju ostati zapisana");
  for (const n of rezultat.nalazi) {
    assert.equal(n.ishod, "PAD");
    assert.match(n.detalj, /EINVAL/, "kod greške mora ostati vidljiv");
  }
});

test("izveštaj NASTAJE i kada nijedno merenje nije uspelo", async () => {
  const rezultat = await izmeri({
    mehanizmi: [{ id: "a", opis: "a", pokreni: () => { throw einval(); } }],
  });
  const tekst = sastaviIzvestaj({ meta: META, okolina: OKOLINA, ...rezultat });

  assert.match(tekst, /diagnostic_no_working_spawn/);
  assert.match(tekst, /Radni mehanizam pokretanja \| nijedan/);
  assert.match(tekst, /nije izvršena|nisu izvršena/);
  proveriRedakciju(tekst, "izveštaj");
});

test("ni ekran ni izveštaj ne nose putanju, stack trace ni skriptu", async () => {
  const linije = [];
  const rezultat = await izmeri({
    mehanizmi: [{ id: "spawn-stdin", opis: "spawn + stdin", pokreni: () => { throw einval(); } }],
    log: (r) => linije.push(r),
  });

  proveriRedakciju(linije.join("\n"), "ekran");
  proveriRedakciju(sastaviIzvestaj({ meta: META, okolina: OKOLINA, ...rezultat }), "izveštaj");
});

test("poruka izuzetka se NIKAD ne prenosi — samo kod", () => {
  /*
   * Ovo je strukturna odbrana, ne filter: `bezbedanKod` čita `e.code`, pa ni
   * najduža poruka sa putanjom nema kuda da uđe.
   */
  assert.equal(bezbedanKod(einval()), "EINVAL");
  assert.equal(bezbedanKod(new Error("C:\\Users\\Vlasnik\\tajna")), "Error");
  assert.equal(bezbedanKod({ code: "E../../etc/passwd" }), "Eetcpasswd");
  assert.equal(bezbedanKod(undefined), "unknown");
  assert.equal(bezbedanKod({ code: "x".repeat(200) }).length, 32);
});

/* =========================================================================
 * Redakcija
 * ====================================================================== */

test("redakcija briše svaki oblik putanje, ključa i stack trace-a", () => {
  const uzorci = [
    "file:///C:/Users/Vlasnik/Desktop/x.mjs:95:13",
    "C:\\Users\\Vlasnik\\AppData\\Local\\Temp",
    "C:/Users/Vlasnik/Desktop",
    "\\\\server\\share\\fakture",
    "/Users/miledulic/Desktop/Projects",
    "kupac@primer.rs",
    `-----BEGIN PRIVATE KEY-----`,
    "A".repeat(64),
    "    at Object.spawnSync (node:internal/child_process:1120:20)",
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security",
  ];
  for (const u of uzorci) {
    const r = redigovan(u);
    proveriRedakciju(r, `redakcija „${u.slice(0, 24)}…"`);
    assert.ok(r.length > 0, "redakcija je obrisala ceo tekst");
  }
});

test("redakcija ne guta korisne, bezbedne vrednosti", () => {
  assert.match(redigovan("PowerShell 5.1.19041.4522"), /5\.1\.19041/);
  assert.match(redigovan("ConstrainedLanguage"), /ConstrainedLanguage/);
  assert.match(redigovan("MachinePolicy=AllSigned CurrentUser=Undefined"), /AllSigned/);
  assert.match(redigovan("izlaz 1"), /izlaz 1/);
});

/* =========================================================================
 * Izbor mehanizma
 * ====================================================================== */

test("prvi ISPRAVAN mehanizam se koristi, pali ostaju zapisani", async () => {
  const pozvano = [];
  const dobar = async (skripta, ulaz) => {
    pozvano.push(skripta);
    if (skripta === PROBA_SKRIPTA) return { kod: 0, stdout: PROBA_OCEKIVANO, stderr: "" };
    if (ulaz === STDIN_PROBA) return { kod: 0, stdout: STDIN_PROBA, stderr: "" };
    return { kod: 0, stdout: "FullLanguage", stderr: "" };
  };

  const rezultat = await izmeri({
    mehanizmi: [
      { id: "spawnSync-input", opis: "pao", pokreni: () => { throw einval(); } },
      { id: "spawn-stdin", opis: "radi", pokreni: dobar },
    ],
  });

  assert.equal(rezultat.radniMehanizam, "spawn-stdin");
  assert.equal(rezultat.kod, KODOVI.izmereno);

  const pali = rezultat.nalazi.find((n) => n.id === "M-spawnSync-input");
  assert.equal(pali.ishod, "PAD", "pali mehanizam mora ostati u izveštaju");
  assert.match(pali.detalj, /EINVAL/);

  // Sva D-merenja su izvršena kroz mehanizam koji radi.
  for (const id of ["D01", "D02", "D03", "D04", "D05", "D06", "D07"]) {
    assert.ok(rezultat.nalazi.some((n) => n.id === id), `nedostaje ${id}`);
  }
});

/** Mehanizam koji uvek pokreće PowerShell, ali NEMA stdin kanal. */
const bezStdina = {
  id: "bez-stdina",
  opis: "bez stdin kanala",
  pokreni: async (skripta, ulaz) => {
    if (ulaz !== undefined) throw Object.assign(new Error("x"), { code: "ENOTSUP" });
    return { kod: 0, stdout: skripta === PROBA_SKRIPTA ? PROBA_OCEKIVANO : "FullLanguage", stderr: "" };
  },
};

test("D06 meri PRODUKCIJSKI kanal adaptera, ne mehanizme dijagnostike", async () => {
  /*
   * Mehanizmi dijagnostike ovde nemaju stdin. Da D06 i dalje ide kroz njih,
   * pao bi sa ENOTSUP. Prolazi zato što ide kroz `kanalAdaptera` — isti
   * `pokreniPowerShell` koji konektor koristi.
   */
  const pozivi = [];
  const rezultat = await izmeri({
    mehanizmi: [bezStdina],
    kanalAdaptera: {
      pokreni: async (program, ulaz) => {
        pozivi.push({ program, ulaz });
        return ulaz;
      },
      proveri: async () => {},
    },
  });

  const d06 = rezultat.nalazi.find((n) => n.id === "D06");
  assert.equal(d06.ishod, "OK", d06.detalj);
  assert.equal(pozivi.length, 1, "D06 nije pozvao kanal adaptera tačno jednom");
  assert.equal(pozivi[0].program, STDIN_PROGRAM);
  assert.equal(pozivi[0].ulaz, STDIN_PROBA);
  assert.match(STDIN_PROBA, /^[A-Za-z0-9+/]+={0,2}$/, "proba nije oblika koji adapter prima");
});

test("D06 pada sa kodom kanala, bez poruke i putanje", async () => {
  const rezultat = await izmeri({
    mehanizmi: [bezStdina],
    kanalAdaptera: {
      pokreni: async () => {
        throw Object.assign(new Error("C:\\Users\\Vlasnik\\x.mjs"), { code: "dpapi_process_failed" });
      },
      proveri: async () => {},
    },
  });
  const d06 = rezultat.nalazi.find((n) => n.id === "D06");
  assert.equal(d06.ishod, "PAD");
  assert.match(d06.detalj, /dpapi_process_failed/);
  proveriRedakciju(d06.detalj, "D06 detalj");
});

test("bez učitanog kanala adaptera D06 i D08 kažu to izričito", async () => {
  const rezultat = await izmeri({ mehanizmi: [bezStdina] });
  for (const id of ["D06", "D08"]) {
    const n = rezultat.nalazi.find((x) => x.id === id);
    assert.equal(n.ishod, "PAD");
    assert.match(n.detalj, /nije učitan/);
  }
});

test("D08 izvršava proveri() adaptera i prijavljuje samo kod", async () => {
  const rezultat = await izmeri({
    mehanizmi: [bezStdina],
    kanalAdaptera: {
      pokreni: async (_p, ulaz) => ulaz,
      proveri: async () => {
        throw Object.assign(new Error("tajna AAAA"), { code: "dpapi_timeout" });
      },
    },
  });
  const d08 = rezultat.nalazi.find((n) => n.id === "D08");
  assert.equal(d08.ishod, "PAD");
  assert.match(d08.detalj, /dpapi_timeout/);
  assert.doesNotMatch(d08.detalj, /tajna/);
});

/* =========================================================================
 * D07 — lockdown
 * ====================================================================== */

test("D07: __PSLockdownPolicy = 0 NIJE aktivan AppLocker/WDAC", () => {
  // Tačno stanje sa kancelarijskog računara: FullLanguage, promenljiva = 0.
  const r = oceniLockdown({ rezim: "None", vrednost: "0" });
  assert.equal(r.ishod, "OK");
  assert.match(r.detalj, /__PSLockdownPolicy = 0/, "ime promenljive mora ostati čitljivo");

  // I kada se režim ne može očitati, 0 ne sme postati „aktivno".
  assert.equal(oceniLockdown({ rezim: "nepoznato", vrednost: "0" }).ishod, "OK");
});

test("D07: presuđuje stvarni režim sprovođenja, ne postojanje promenljive", () => {
  assert.equal(oceniLockdown({ rezim: "None", vrednost: "nije_postavljeno" }).ishod, "OK");
  assert.equal(oceniLockdown({ rezim: "None", vrednost: "4" }).ishod, "OK");
  assert.equal(oceniLockdown({ rezim: "Enforce", vrednost: "nije_postavljeno" }).ishod, "PAŽNJA");
  assert.equal(oceniLockdown({ rezim: "Audit", vrednost: "0" }).ishod, "PAŽNJA");
  assert.equal(oceniLockdown({ rezim: "nepoznato", vrednost: "4" }).ishod, "PAŽNJA");
});

test("redakcija NE briše ime dijagnostičke promenljive", () => {
  const r = redigovan("sprovođenje: None; __PSLockdownPolicy = 0");
  assert.match(r, /__PSLockdownPolicy = 0/);
  assert.doesNotMatch(r, /\[skripta\]/);
});

test("neuspeh jednog merenja ne prekida ostala", async () => {
  let poziv = 0;
  const rezultat = await izmeri({
    mehanizmi: [
      {
        id: "m",
        opis: "m",
        pokreni: async (skripta) => {
          poziv += 1;
          if (skripta === PROBA_SKRIPTA) return { kod: 0, stdout: PROBA_OCEKIVANO, stderr: "" };
          if (poziv === 3) throw Object.assign(new Error("x"), { code: "EACCES" });
          return { kod: 0, stdout: "FullLanguage", stderr: "" };
        },
      },
    ],
  });

  assert.equal(rezultat.nalazi.filter((n) => n.id.startsWith("D")).length, 8);
  assert.ok(rezultat.nalazi.some((n) => n.detalj.includes("EACCES")));
});

/* =========================================================================
 * Stvarni PowerShell — samo na Windowsu
 * ====================================================================== */

test("[WIN] trivijalan PowerShell poziv i stdin kanal", async (t) => {
  if (process.platform !== "win32") {
    t.skip(`Zahteva Windows; tekuća platforma je ${process.platform}. NIJE IZVRŠENO.`);
    return;
  }
  const { MEHANIZMI } = await import("../smoke/diagnose.mjs");

  /*
   * Bez ključa i bez ijednog poslovnog podatka: jedan ASCII red i jedna
   * konstanta kroz stdin. Meri se KANAL, ne DPAPI.
   */
  const nalazi = [];
  for (const m of MEHANIZMI) {
    try {
      const r = await m.pokreni(PROBA_SKRIPTA);
      nalazi.push({ id: m.id, kod: r.kod, izlaz: String(r.stdout ?? "").trim() });
    } catch (e) {
      nalazi.push({ id: m.id, greska: bezbedanKod(e) });
    }
  }
  assert.ok(
    nalazi.some((n) => n.kod === 0 && n.izlaz === PROBA_OCEKIVANO),
    `nijedan mehanizam nije pokrenuo PowerShell: ${JSON.stringify(nalazi)}`,
  );

  /*
   * stdin se meri kroz PRODUKCIJSKI kanal adaptera, ne kroz `-Command -`
   * mehanizam — taj je na kancelarijskom računaru pao baš zato što program i
   * podatak dele stdin.
   */
  const { ucitajKanalAdaptera } = await import("../smoke/diagnose.mjs");
  const kanal = await ucitajKanalAdaptera();
  assert.ok(kanal, "produkcijski kanal adaptera nije nađen");
  const izlaz = await kanal.pokreni(STDIN_PROGRAM, STDIN_PROBA);
  assert.equal(String(izlaz).trim(), STDIN_PROBA, "produkcijski stdin kanal ne vraća podatak");
});

test("[WIN] pokretač dijagnostike ne ispisuje putanju ni stack trace", async (t) => {
  if (process.platform !== "win32") {
    t.skip(`Zahteva Windows; tekuća platforma je ${process.platform}. NIJE IZVRŠENO.`);
    return;
  }
  const put = fileURLToPath(new URL("../smoke/diagnose.mjs", import.meta.url));
  const r = spawnSync(process.execPath, [put], { encoding: "utf8", timeout: 120_000 });
  proveriRedakciju(`${r.stdout ?? ""}${r.stderr ?? ""}`, "ispis pokretača");
  assert.notEqual(r.status, null, "pokretač se nije završio");
});
