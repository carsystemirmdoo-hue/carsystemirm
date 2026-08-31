import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

/**
 * Konfiguracija konektora — učitava se sa diska i STROGO proverava.
 *
 * Nema podrazumevanih vrednosti za ono što određuje gde se šalje i šta se čita.
 * Podrazumevani origin ili izvorni folder bi značili da pogrešno podešen
 * konektor ipak nešto radi, i to najčešće nad pogrešnim folderom.
 */

export class ConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
  }
}

const OZNAKA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} putanja  putanja do JSON konfiguracije
 * @returns {Promise<object>} proverena konfiguracija
 */
export async function ucitajKonfiguraciju(putanja) {
  let sirovo;
  try {
    sirovo = await readFile(putanja, "utf8");
  } catch {
    throw new ConfigError("config_missing", "Konfiguracija nije pronađena.");
  }

  let k;
  try {
    k = JSON.parse(sirovo);
  } catch {
    throw new ConfigError("config_not_json", "Konfiguracija nije ispravan JSON.");
  }
  return proveriKonfiguraciju(k);
}

export function proveriKonfiguraciju(k) {
  const trazi = (polje) => {
    const v = k?.[polje];
    if (typeof v !== "string" || v.trim() === "") {
      throw new ConfigError("config_invalid", `Nedostaje obavezno polje „${polje}“.`);
    }
    return v.trim();
  };

  const serverOrigin = trazi("serverOrigin");
  const deviceCode = trazi("deviceCode");
  const keyId = trazi("keyId");
  const sourceSystem = trazi("sourceSystem");
  const issuerCode = trazi("issuerCode");
  const izvorniFolder = trazi("izvorniFolder");

  if (!OZNAKA.test(deviceCode) || !OZNAKA.test(keyId)) {
    throw new ConfigError("config_invalid", "Oznaka uređaja ili ključa nije u dozvoljenom obliku.");
  }
  if (!isAbsolute(izvorniFolder)) {
    throw new ConfigError("config_invalid", "Izvorni folder mora biti apsolutna putanja.");
  }

  const zatvaranja = k.dodatnaZatvaranja ?? [];
  if (!Array.isArray(zatvaranja) || zatvaranja.some((d) => !ISO_DATUM.test(String(d)))) {
    throw new ConfigError("config_invalid", "`dodatnaZatvaranja` mora biti lista ISO datuma.");
  }

  return {
    serverOrigin,
    deviceCode,
    keyId,
    sourceSystem,
    issuerCode,
    izvorniFolder,
    dodatnaZatvaranja: zatvaranja.map(String),
    maxPoCiklusu: Number.isInteger(k.maxPoCiklusu) ? k.maxPoCiklusu : 50,
    timeoutMs: Number.isInteger(k.timeoutMs) ? k.timeoutMs : 30_000,
  };
}
