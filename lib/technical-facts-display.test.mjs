import assert from "node:assert/strict";
import test from "node:test";
import { formatTechnicalValueSr, presentTechnicalFacts } from "./technical-facts-display.mjs";

const fact = (label, value, detail) => ({ label, value, ...(detail ? { detail } : {}), reviewStatus: "confirmed" });

test("R-M: sirovi red istog podatka se izostavlja, lokalizovani ostaje", () => {
  const out = presentTechnicalFacts([
    fact("Mlaznica (mm)", "1–1,2"),
    fact("VOC (IIB.e)", "839 g/l · granica 840 g/l"),
    fact("Mlaznica", "1 -1.2 mm"),
    fact("VOC", "839 g/l", "EU granica za kategoriju IIB.e: 840 g/l"),
  ]);
  assert.deepEqual(out.map((f) => `${f.label}: ${f.value}`), ["Mlaznica (mm): 1–1,2", "VOC (IIB.e): 839 g/l · granica 840 g/l"]);
});

test("Norbin: red sa dodatnom vrednošću ostaje (napomena o česticama uz VOC)", () => {
  const out = presentTechnicalFacts([
    fact("VOC", "419 g/l"),
    fact("VOC", "Sadržaj VOC ovog proizvoda je 419 g/l. Ne može se isključiti da proizvod sadrži čestice manje od 0,1 μm."),
    fact("Rok upotrebe", "24 meseca"),
    fact("Rok upotrebe", "24 months"),
    fact("Mlaznica", "1,3-1,4"),
    fact("Mlaznica", "1.3"),
  ]);
  assert.equal(out.length, 4);
  assert.ok(out.some((f) => f.value.includes("0,1 μm")));
});

test("različite vrednosti iste oznake se ne gube", () => {
  const out = presentTechnicalFacts([
    fact("Šifra u sistemu", "7-401-1000"),
    fact("Šifra u sistemu", "7-401-5000"),
    fact("Karakteristika", "Papirna krpa za čišćenje"),
    fact("Karakteristika", "Perforirana rolna"),
    fact("Pakovanje", "Dozator sa 370 listova"),
    fact("Pakovanje", "370 listova / 36 x 40 cm"),
  ]);
  assert.equal(out.length, 6);
});

test("format: decimalni zarez, opseg, srpske jedinice", () => {
  assert.equal(formatTechnicalValueSr("Mlaznica", "1.4 -1.5 mm"), "1,4–1,5 mm");
  assert.equal(formatTechnicalValueSr("Pritisak", "0.5 - 2.4 bar"), "0,5–2,4 bar");
  assert.equal(formatTechnicalValueSr("Vreme upotrebe smeše", "1.5 h (at 20°C)"), "1,5 h (na 20°C)");
  assert.equal(formatTechnicalValueSr("Vreme upotrebe smeše", "na 20°C 7 days"), "na 20°C 7 dana");
  assert.equal(formatTechnicalValueSr("Rok upotrebe", "24 months"), "24 meseca");
  assert.equal(formatTechnicalValueSr("Rok upotrebe", "36 months"), "36 meseci");
  assert.equal(formatTechnicalValueSr("Brzina", "Podesiv do 10.000 o/min"), "Podesiv do 10.000 o/min");
  assert.equal(formatTechnicalValueSr("Šifra artikla", "152.596"), "152.596");
  assert.equal(formatTechnicalValueSr("Zvanični SATA naziv", "1.0 l aluminium pressure pot"), "1.0 l aluminium pressure pot");
  assert.equal(formatTechnicalValueSr("Oznaka", "N75-020"), "N75-020");
  assert.equal(formatTechnicalValueSr("Partner", "N75-020 (2:1)"), "N75-020 (2:1)");
});
