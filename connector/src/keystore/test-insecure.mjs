import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * SAMO ZA TEST. Ključ stoji nešifrovan na disku.
 *
 * Postoji zato što se ostatak konektora — red, raspored, klijent, ishodi — mora
 * moći razvijati i testirati bez Windows mašine. Ne postoji zato što je
 * plaintext ključ prihvatljiv.
 *
 * Adapter se NE bira sam. Aktivira se isključivo izričitom promenljivom, i
 * `keystore/index.mjs` ga odbija čim proces radi kao produkcioni paket. Bez tog
 * dvostrukog uslova bi jedna zaboravljena promenljiva na kancelarijskom
 * računaru ostavila ključ u čitljivom fajlu.
 */

export const adapterIme = "test-insecure";
export const PROMENLJIVA = "CS_CONNECTOR_INSECURE_KEYSTORE";

export function dostupan(env = process.env) {
  return env[PROMENLJIVA] === "1";
}

export async function sacuvaj({ putanja, privateKeyPkcs8Der }) {
  await mkdir(dirname(putanja), { recursive: true });
  await writeFile(
    putanja,
    `test-insecure-v1\n${Buffer.from(privateKeyPkcs8Der).toString("base64")}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await chmod(putanja, 0o600).catch(() => {});
  return { adapter: adapterIme };
}

export async function ucitaj({ putanja }) {
  const [zaglavlje, telo] = (await readFile(putanja, "utf8")).split("\n");
  if (zaglavlje !== "test-insecure-v1" || !telo) {
    throw new Error("Fajl ključa nije u očekivanom test obliku.");
  }
  return new Uint8Array(Buffer.from(telo.trim(), "base64"));
}

export async function proveri() {
  return { adapter: adapterIme, ok: true, upozorenje: "TEST adapter — ključ nije šifrovan." };
}
