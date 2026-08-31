import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Log sa redakcijom i rotacijom.
 *
 * Canonical JSON nosi poslovne podatke iako PDF ne napušta računar. Log koji bi
 * ga ispisao poništio bi celu privatnost lanca — zato ovde postoji filter, a ne
 * samo dogovor da se pazi.
 */

/** Ne upisuju se: putanje, imena fajlova, PIB, iznosi, ključevi, potpisi. */
const ZABRANJENO = [
  /[A-Za-z]:\\[^\s"]*/g,      // Windows putanja
  /\/(?:Users|home)\/[^\s"]*/g, // POSIX korisnička putanja
  /[^\s"/\\]+\.pdf/gi,          // ime PDF fajla
  /\bPIB[:\s]*\d{6,}/gi,
  /-----BEGIN[^-]+-----/g,
];

/** Ostavlja samo prefiks otiska — dovoljno za pronalaženje, ne otkriva dokument. */
export function redigujOtisak(hex) {
  return `sd:${String(hex ?? "").slice(0, 12)}`;
}

export function redigujPoruku(poruka) {
  let t = String(poruka ?? "");
  for (const obrazac of ZABRANJENO) t = t.replace(obrazac, "[redigovano]");
  // Duge base64 niske su gotovo uvek ključ ili potpis.
  t = t.replace(/[A-Za-z0-9+/]{60,}={0,2}/g, "[redigovano]");
  return t.slice(0, 2000);
}

const MAX_BAJTOVA = 2 * 1024 * 1024;

export function napraviLog(putanjaLoga) {
  return {
    async zapisi(nivo, dogadjaj, polja = {}) {
      const red = JSON.stringify({
        t: new Date().toISOString(),
        nivo,
        dogadjaj,
        ...Object.fromEntries(
          Object.entries(polja).map(([k, v]) => [
            k,
            typeof v === "string" ? redigujPoruku(v) : v,
          ]),
        ),
      });
      await mkdir(dirname(putanjaLoga), { recursive: true });
      try {
        const st = await stat(putanjaLoga);
        if (st.size > MAX_BAJTOVA) {
          // Jedna rotacija; starije se ne gomila i ne briše se ništa drugo.
          await rename(putanjaLoga, `${putanjaLoga}.1`).catch(() => {});
        }
      } catch {
        /* fajl još ne postoji */
      }
      await appendFile(putanjaLoga, `${red}\n`, "utf8");
    },
  };
}

export const podrazumevanaPutanjaLoga = (folderStanja) => join(folderStanja, "connector.log");
