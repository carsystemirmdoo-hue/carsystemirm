import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  bezbedanKod,
  izmeri,
  KODOVI,
  PROBA_OCEKIVANO,
  PROBA_SKRIPTA,
  redigovan,
  sastaviIzvestaj,
  STDIN_PROBA,
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

test("stdin kanal se meri odvojeno od pokretanja", async () => {
  /*
   * Mehanizam koji se pokreće ali nema stdin: `D06` mora pasti, a `D01` proći.
   * Bez tog razdvajanja bi „PowerShell ne radi" i „stdin ne radi" izgledali isto,
   * a adapter zavisi baš od stdin-a.
   */
  const rezultat = await izmeri({
    mehanizmi: [
      {
        id: "bez-stdina",
        opis: "bez stdin kanala",
        pokreni: async (skripta, ulaz) => {
          if (ulaz !== undefined) throw Object.assign(new Error("x"), { code: "ENOTSUP" });
          return { kod: 0, stdout: skripta === PROBA_SKRIPTA ? PROBA_OCEKIVANO : "x", stderr: "" };
        },
      },
    ],
  });

  assert.equal(rezultat.nalazi.find((n) => n.id === "D01").ishod, "OK");
  const d06 = rezultat.nalazi.find((n) => n.id === "D06");
  assert.equal(d06.ishod, "PAD");
  assert.match(d06.detalj, /ENOTSUP/);
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

  assert.equal(rezultat.nalazi.filter((n) => n.id.startsWith("D")).length, 7);
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

  const preko = MEHANIZMI.find((m) => m.id === "spawn-stdin");
  const r = await preko.pokreni("[Console]::In.ReadLine()", STDIN_PROBA);
  assert.equal(String(r.stdout ?? "").trim(), STDIN_PROBA, "stdin kanal ne radi");
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
