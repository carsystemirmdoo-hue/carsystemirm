import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Označavanje ranijih smoke paketa kao NEVAŽEĆIH za predaju.
 *
 * Poziva ga ISKLJUČIVO `verify-smoke-package.mjs`, i to tek kada je provera
 * novog paketa prošla bez ijednog pada. Ranije ga je zvao `package-smoke.mjs`
 * odmah posle pakovanja: novi ZIP koji verifikacija zatim odbije ostavljao je
 * stari paket već proglašen nevažećim — i nijedan paket za predaju.
 *
 * Ništa se ne briše. Stari paket može trebati za poređenje; pored njega ostaje
 * samo pisan trag da se ne predaje.
 */

const ZIP_OBRAZAC = /^carsystem-windows-smoke-([0-9a-f]{7})\.zip$/;

/**
 * @param {{ izlaz: string, zipIme: string, kratki: string, handoffIme: string }} ulaz
 * @returns {string[]} imena ranijih ZIP-ova koji su označeni
 */
export function oznaciRanijeNevazecim({ izlaz, zipIme, kratki, handoffIme }) {
  if (!existsSync(join(izlaz, zipIme))) {
    // Bez potvrđenog zamenskog paketa se ništa ne proglašava nevažećim.
    throw new Error(`zamenski paket ${zipIme} ne postoji`);
  }
  const raniji = readdirSync(izlaz)
    .filter((f) => ZIP_OBRAZAC.test(f) && f !== zipIme)
    .sort();
  for (const stari of raniji) {
    const [, stariKratki] = stari.match(ZIP_OBRAZAC);
    writeFileSync(
      join(izlaz, `NEVAZECI-${stariKratki}.md`),
      [
        "# NEVAŽEĆI paket — ne predavati",
        "",
        `\`${stari}\``,
        "",
        `Zamenjuje ga **\`${zipIme}\`** (HEAD \`${kratki}\`), uz \`${handoffIme}\`.`,
        "",
        "Stari se čuva samo radi poređenja. Za predaju i za pokretanje na Windowsu",
        "važi isključivo paket imenovan iznad.",
        "",
      ].join("\n"),
    );
  }
  return raniji;
}
