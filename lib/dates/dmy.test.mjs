import assert from "node:assert/strict";
import test from "node:test";
import {
  danUNedelji, formatirajUnos, izUnosa, kursorPosle, mrezaMeseca, pomeri, precica, uPrikaz, danasBeograd,
} from "./dmy.mjs";

test("prikaz je dd/mm/yyyy, a ISO ostaje isti (bez pomeranja zbog zone)", () => {
  assert.equal(uPrikaz("2026-10-07"), "07/10/2026");
  assert.equal(uPrikaz("2026-01-01"), "01/01/2026");
  assert.equal(uPrikaz("2026-02-30"), "");
  assert.equal(uPrikaz(""), "");
  for (const iso of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31", "2024-02-29"]) {
    assert.equal(izUnosa(uPrikaz(iso)).iso, iso, `povratno ${iso}`);
  }
});

test("unos: razni separatori i jednocifreni dan/mesec", () => {
  for (const t of ["07/10/2026", "7/10/2026", "7.10.2026.", "07-10-2026", "07102026", " 7 10 2026 "]) {
    assert.equal(izUnosa(t).iso, "2026-10-07", t);
  }
});

test("nepostojeći i nepotpuni datumi se odbijaju", () => {
  assert.equal(izUnosa("31/04/2026").greska, "nepostojeci");
  assert.equal(izUnosa("29/02/2026").greska, "nepostojeci");
  assert.equal(izUnosa("29/02/2024").iso, "2024-02-29");
  assert.equal(izUnosa("00/10/2026").greska, "nepostojeci");
  assert.equal(izUnosa("07/13/2026").greska, "nepostojeci");
  assert.equal(izUnosa("07/10/26").greska, "nepotpuno");
  assert.equal(izUnosa("07/10").greska, "nepotpuno");
  assert.equal(izUnosa("").greska, "prazno");
});

test("automatske kose crte dok se kuca, bez smetanja pri brisanju", () => {
  const koraci = ["0", "07", "071", "0710", "07102", "071020", "0710202", "07102026"];
  const ocekivano = ["0", "07/", "07/1", "07/10/", "07/10/2", "07/10/20", "07/10/202", "07/10/2026"];
  koraci.forEach((k, i) => assert.equal(formatirajUnos(k), ocekivano[i], k));
  // Kucanje preko već formatiranog teksta.
  assert.equal(formatirajUnos("07/1"), "07/1");
  assert.equal(formatirajUnos("07/10/20261"), "07/10/2026");
  // Brisanje: kosa crta na kraju se ne vraća.
  assert.equal(formatirajUnos("07/10", true), "07/10");
  assert.equal(formatirajUnos("07/", true), "07");
  assert.equal(formatirajUnos("0", true), "0");
  // Ručno upisan separator zatvara deo.
  assert.equal(formatirajUnos("7/"), "07/");
  assert.equal(formatirajUnos("7.1."), "07/01/");
  // Ispravka u sredini: cifre ostaju na mestu.
  assert.equal(formatirajUnos("08/10/2026"), "08/10/2026");
});

test("kursor ostaje posle iste cifre posle formatiranja", () => {
  assert.equal(kursorPosle("07/10/2026", 2), 3);
  assert.equal(kursorPosle("07/10/2026", 1), 1);
  assert.equal(kursorPosle("07/10/2026", 8), 10);
  assert.equal(kursorPosle("07/1", 3), 4);
});

test("kalendar: ponedeljak prvi, tačan broj dana, prestupna godina", () => {
  assert.equal(danUNedelji(2026, 10, 7), 2, "7. oktobar 2026. je sreda");
  const okt = mrezaMeseca(2026, 10);
  assert.equal(okt.filter(Boolean).length, 31);
  assert.equal(okt.indexOf(1), 3, "1. oktobar 2026. je četvrtak");
  assert.equal(okt.length % 7, 0);
  assert.equal(mrezaMeseca(2024, 2).filter(Boolean).length, 29);
  assert.deepEqual(pomeri({ g: 2026, m: 1, d: 31 }, 0, 1), { g: 2026, m: 2, d: 28 });
  assert.deepEqual(pomeri({ g: 2026, m: 12, d: 31 }, 1), { g: 2027, m: 1, d: 1 });
  assert.deepEqual(pomeri({ g: 2026, m: 1, d: 15 }, 0, -1), { g: 2025, m: 12, d: 15 });
});

test("prečice perioda: granice uključene, preko kraja godine", () => {
  assert.deepEqual(precica("ovaj_mesec", { g: 2026, m: 10, d: 7 }), { od: "2026-10-01", do: "2026-10-31" });
  assert.deepEqual(precica("prethodni_mesec", { g: 2026, m: 10, d: 7 }), { od: "2026-09-01", do: "2026-09-30" });
  assert.deepEqual(precica("prethodni_mesec", { g: 2026, m: 1, d: 5 }), { od: "2025-12-01", do: "2025-12-31" });
  assert.deepEqual(precica("prethodni_mesec", { g: 2024, m: 3, d: 5 }), { od: "2024-02-01", do: "2024-02-29" });
  assert.deepEqual(precica("ova_godina", { g: 2026, m: 10, d: 7 }), { od: "2026-01-01", do: "2026-12-31" });
  assert.deepEqual(precica("sve", { g: 2026, m: 10, d: 7 }), { od: "", do: "" });
});

test("danas je beogradski datum i oko ponoći UTC", () => {
  assert.deepEqual(danasBeograd(new Date("2026-10-06T22:30:00Z")), { g: 2026, m: 10, d: 7 });
  assert.deepEqual(danasBeograd(new Date("2026-12-31T23:30:00Z")), { g: 2027, m: 1, d: 1 });
});

test("portal nema nijedno izvorno type=\"date\" polje — svuda je DateField (dd/mm/gggg)", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const koren = new URL("../../", import.meta.url).pathname;
  const nadjeno = [];
  async function obidji(dir) {
    for (const e of await readdir(join(koren, dir), { withFileTypes: true })) {
      const rel = join(dir, e.name);
      if (e.isDirectory()) await obidji(rel);
      else if (/\.tsx$/.test(e.name) && /type="date"/.test(await readFile(join(koren, rel), "utf8"))) nadjeno.push(rel);
    }
  }
  for (const d of ["app/portal", "app/kupac", "features/portal"]) await obidji(d);
  assert.deepEqual(nadjeno, []);
});
