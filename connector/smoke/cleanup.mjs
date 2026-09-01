/**
 * Brisanje smoke foldera — ZASEBNA, izričita odluka.
 *
 * Briše isključivo `%TEMP%\Carsystem Smoke ČĆŽŠĐ`, folder koji je runner sam
 * napravio. Ne dodiruje izvorne fakture, korisnički profil, BizniSoft izlaz ni
 * bilo šta van te jedne putanje — i odbija da radi ako ta putanja ne izgleda
 * tačno onako kako ju je runner napravio.
 */
import { existsSync, rmSync, statSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";

const SMOKE = join(tmpdir(), "Carsystem Smoke ČĆŽŠĐ");

if (platform() !== "win32") {
  console.error("Cleanup se pokreće samo na Windows-u.");
  process.exit(2);
}
if (!existsSync(SMOKE)) {
  console.log("Nema šta da se briše: smoke folder ne postoji.");
  process.exit(0);
}
if (!statSync(SMOKE).isDirectory()) {
  console.error("Meta nije folder. Ništa nije obrisano.");
  process.exit(1);
}
/*
 * Sigurnosna kapija.
 *
 * Ime mora biti tačno ono koje runner pravi. Bez ove provere bi izmenjena
 * TEMP promenljiva usmerila brisanje na tuđi folder.
 */
if (!SMOKE.endsWith("Carsystem Smoke ČĆŽŠĐ")) {
  console.error("Neočekivana putanja. Ništa nije obrisano.");
  process.exit(1);
}

rmSync(SMOKE, { recursive: true, force: true });
console.log("Obrisan samo smoke folder: %TEMP%\\Carsystem Smoke ČĆŽŠĐ");
console.log("Izvorne fakture i korisnički folderi nisu dirani (runner ih nikad nije ni otvarao).");
