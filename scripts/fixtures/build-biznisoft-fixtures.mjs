/**
 * Sintetički BizniSoft fixtures.
 *
 * Svaka vrednost je IZMIŠLJENA. Nijedan naziv, PIB, adresa, šifra, iznos ni
 * broj dokumenta ne potiče iz stvarnog dokumenta. Struktura, geometrija kolona
 * i nazivi kolona prate ono što je revizija dokaza potvrdila nad realnim
 * uzorcima (`docs/b2b/16-biznisoft-pdf-evidence-audit.md`).
 *
 *   npm run fixtures:biznisoft
 */
import { mkdir, writeFile } from "node:fs/promises";
import { document } from "./biznisoft-document.mjs";
import { writePdf } from "./pdf-writer.mjs";

const OUT = new URL("../../fixtures/dev/biznisoft/", import.meta.url);

const ART = (n) => ({
  sifra: String(900000 + n), naziv: `SINTETICKI ARTIKAL ${n}`, jm: n % 2 ? "KOM" : "LIT",
  kol: 1 + n * 0.5, cena: 100 + n * 10, rabat: n % 3 === 0 ? 10 : 0, pdv: n % 4 === 0 ? 10 : 20,
});

const FIXTURES = {
  // Jedna stavka — najprostiji dokazani oblik.
  "jedna-stavka.pdf": document({
    broj: "99-RN900000001", partner: "09001", datum: "01.01.2026", items: [ART(1)],
  }),
  // Više stavki, mešane stope i rabati.
  "vise-stavki.pdf": document({
    broj: "99-RN900000002", partner: "09002", datum: "02.01.2026",
    items: [1, 2, 3, 4, 5, 6, 7].map(ART),
  }),
  // Dvostrani sa PONOVLJENIM zaglavljem i bez stavki na strani 2 — dokazani oblik.
  "dve-strane-ponovljeno-zaglavlje.pdf": document({
    broj: "99-RN900000003", partner: "09003", datum: "03.01.2026",
    items: [1, 2, 3].map(ART), pages: 2,
  }),
  // Vodeća nula u šifri partnera — dokazana osobina.
  "vodeca-nula-partner.pdf": document({
    broj: "99-RN900000004", partner: "00042", datum: "04.01.2026", items: [ART(2)],
  }),
  // Odštampan zbir se NE poklapa sa izračunatim — mora biti odbijen.
  "zbir-se-ne-poklapa.pdf": document({
    broj: "99-RN900000005", partner: "09005", datum: "05.01.2026",
    items: [ART(1), ART(2)], totalOverride: 1,
  }),
  // Strana 2 počinje numeraciju ispočetka — nije jedna tabela, ide čoveku.
  "nastavak-tabele.pdf": document({
    broj: "99-RN900000006", partner: "09006", datum: "06.01.2026",
    items: [ART(1), ART(2)], pages: 2, continuationOnPage2: "prekinuto",
  }),
  // Numeracija se nastavlja na strani 2 i zbir obuhvata obe strane — VALIDNO.
  "nastavak-tabele-neprekidno.pdf": document({
    broj: "99-RN900000008", partner: "09008", datum: "08.01.2026",
    items: [ART(1), ART(2)], pages: 2, continuationOnPage2: "neprekidno",
  }),
  // Negativne količine (povrat pod naslovom fakture) — nikad u promet.
  "negativne-stavke.pdf": document({
    broj: "99-RN900000009", partner: "09009", datum: "09.01.2026",
    items: [{ ...ART(1), kol: -2 }],
  }),
  // Bez zaglavlja dokumenta — neupotrebljiv ulaz.
  "neispravan-bez-zaglavlja.pdf": writePdf([[
    { x: 30, y: 700, text: "Ovo nije BizniSoft dokument." },
  ]]),
};

await mkdir(OUT, { recursive: true });
for (const [name, bytes] of Object.entries(FIXTURES)) {
  await writeFile(new URL(name, OUT), bytes);
  console.log(`  ${name}  ${bytes.length} B`);
}
console.log(`\n${Object.keys(FIXTURES).length} sintetickih fixtures u fixtures/dev/biznisoft/`);
