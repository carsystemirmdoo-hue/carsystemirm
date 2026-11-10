import assert from "node:assert/strict";
import test from "node:test";
import { matchCustomer, repForSheet } from "./customerMatch.mjs";
import { nameKey, parseReceivables, placeOf } from "./receivablesParse.mjs";

const C = [
  { id: "antonijev", name: "ANTONIJEV ZTR", city: "Pančevo" },
  { id: "aron", name: "ARON NAGY PR NAD", city: "KANJIZA" },
  { id: "duga-ns", name: "AUTO DUGA DOO NOVI SAD", city: "NOVI SAD" },
  { id: "duga-color", name: "DUGA COLOR DOO", city: "Kraljevo" },
  { id: "kole", name: "AUTO KUĆA KOLE DOO", city: "Beograd" },
  { id: "lazar-t", name: "AUTO LAZAR", city: "Temerin" },
  { id: "lazar-b", name: "AUTO LAZAR", city: "Beograd" },
  { id: "bast", name: "BAST DOO", city: "Sremska Kamenica" },
  { id: "nesa-bg", name: "AUTOLIMARSKA RADNJA NEŠA", city: "BEOGRAD-ZEMUN" },
  { id: "stilby", name: "STILBY DOO BACKI PETROVAC", city: "Bački Petrovac" },
  { id: "aca-s", name: "ACA - S", city: "VELIKA PLANA" },
];

test("naziv bez mesta i pravnog oblika; đ i d su isto", () => {
  assert.equal(nameKey("ARON NAGY PR NAĐ, KANJIŽA"), "aron nagy nad");
  assert.equal(placeOf("ARON NAGY PR NAĐ, KANJIŽA"), "kanjiza");
  assert.equal(nameKey("AUTO-LAK D.O.O."), "auto lak");
});

test("poklapanje: tačno, sa pravnim oblikom, đ/d, mesto u nazivu kupca", () => {
  assert.equal(matchCustomer("ANTONIJEV, PANČEVO", C), "antonijev");
  assert.equal(matchCustomer("ARON NAGY PR NAĐ, KANJIŽA", C), "aron");
  assert.equal(matchCustomer("AUTO DUGA, NOVI SAD", C), "duga-ns");
  assert.equal(matchCustomer("AUTO KUĆA KOLE DOO, FIAT", C, new Set(["kole"])), "kole", "posle zareza marka umesto mesta — važi za kupca tog komercijaliste");
  assert.equal(matchCustomer("BAST DOO, NOVI SAD", C, new Set(["bast"])), "bast", "drugo mesto, ali kupac je tog komercijaliste");
});

test("stvarne greške iz prve probe: delimična reč i drugo mesto ne povezuju", () => {
  assert.equal(matchCustomer("AUTO NEŠA SZTR, NOVI SAD", C), null);
  assert.equal(matchCustomer("STR STIL, BEŠKA", C), null);
  assert.equal(matchCustomer("ACA DOO, NOVI SAD", C), null);
  assert.equal(matchCustomer("BAST DOO, NOVI SAD", C), null, "drugo mesto i nije kupac tog komercijaliste");
});

test("dva ista naziva: odlučuje mesto, inače bez veze", () => {
  assert.equal(matchCustomer("AUTO LAZAR, TEMERIN", C), "lazar-t");
  assert.equal(matchCustomer("AUTO LAZAR", C), null);
  assert.equal(matchCustomer("AUTO LAZAR, NIŠ", C), null);
});

test("kupci komercijaliste imaju prednost", () => {
  assert.equal(matchCustomer("AUTO LAZAR", C, new Set(["lazar-b"])), "lazar-b");
});

test("nepoznat ili prekratak naziv → bez veze", () => {
  assert.equal(matchCustomer("NEPOZNATA FIRMA, NIŠ", C), null);
  assert.equal(matchCustomer(", NIŠ", C), null);
});

test("tabela → komercijalista po imenu", () => {
  const reps = [{ id: "m", name: "Milan Vračar" }, { id: "a", name: "Aleksandar Stojšić" }, { id: "s", name: "SINT Milan Analitika" }];
  assert.equal(repForSheet("Milan", reps)?.id, "m");
  assert.equal(repForSheet("Aleksandar", reps)?.id, "a");
  assert.equal(repForSheet("Miroslav", reps), null);
});

test("tabela kancelarije: prva kolona „t“, kompenzacije se preskaču, spisak kupaca i bez duga", () => {
  const r = parseReceivables([
    ["t", "faktura", "datum", "valuta", "iznos ", "pretplata ", "kompenzacija ", "knjižna odobrenja ", "datum "],
    ["AUTO SERVIS RMV LUKOVIĆ, IVANJICA"],
    [],
    ["AUTO KUĆA VESIĆ, OBRENOVAC", "Fak.1511/2026", "20/10/26", "19/11/26", "19.982,40 din"],
    [null, "Fak.1515/2026", "22/10/26", "21/11/26", "10.383,36 din"],
    ["BMC BOJA MIX, POŽAREVAC", null, null, null, null, null, "77.233,74 din", null, "26/6/2025"],
    [null, "Fak.1164/2026", "18/08/26", "17/09/26", "38.181,12 din"],
    ["ALEX CARS NEŠKOVIĆ DOO, S.PAZOVA", null, null, null, null, "122,02 din"],
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.customers.map((c) => c.label), ["AUTO SERVIS RMV LUKOVIĆ, IVANJICA", "AUTO KUĆA VESIĆ, OBRENOVAC", "BMC BOJA MIX, POŽAREVAC", "ALEX CARS NEŠKOVIĆ DOO, S.PAZOVA"]);
  assert.deepEqual(r.lines.map((l) => [l.customerLabel, l.invoiceNumber, l.remaining, l.dueOn]), [
    ["AUTO KUĆA VESIĆ, OBRENOVAC", "Fak.1511/2026", 19982.4, "2026-11-19"],
    ["AUTO KUĆA VESIĆ, OBRENOVAC", "Fak.1515/2026", 10383.36, "2026-11-21"],
    ["BMC BOJA MIX, POŽAREVAC", "Fak.1164/2026", 38181.12, "2026-09-17"],
  ]);
  assert.equal(r.warnings.length, 0, "kompenzacije i pretplate nisu upozorenja");
});
