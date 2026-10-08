import { randomBytes } from "node:crypto";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import {
  bodyHash,
  HEADERS,
  PROTOCOL_VERSION,
  SIGNED_PATHS,
  signingString,
} from "../../lib/sync/device/signing.mjs";
import { ogranicenRetryAfter } from "./outcomes.mjs";

/*
 * Putanje ka `lib/` su relativne i NAMERNO iste u repozitorijumu i u paketu.
 *
 * `scripts/build.mjs` preslikava strukturu (`dist/lib/...`, `dist/connector/src/...`),
 * pa isti `import` radi na oba mesta. Alternativa bi bila prepisivanje uvoza pri
 * pakovanju — a to je tačno mesto na kome se pakovanje tiho raziđe sa izvorom.
 */

/**
 * Potpisani HTTP klijent za postojeći P2 device API.
 *
 * Potpisni niz se NE prepisuje ovde: `signingString` i `HEADERS` dolaze iz istog
 * modula koji server koristi za proveru. Druga implementacija istog niza bi se
 * razišla na prvom rubnom slučaju, i to bi izgledalo kao „potpis ne valja“.
 */

export class ClientError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ClientError";
    this.code = code;
  }
}

/** Najviše koliko bajtova odgovora se uopšte čita. */
const MAX_ODGOVOR_BAJTOVA = 64 * 1024;
const PODRAZUMEVAN_TIMEOUT_MS = 30_000;

/**
 * Proverava `origin` pre ijednog zahteva.
 *
 * HTTPS je obavezan. `http://` prolazi ISKLJUČIVO u izričitom test režimu, koji
 * spakovan konektor ne može da uključi (`dozvoliHttp` mu se ne prosleđuje) —
 * inače bi jedna pogrešna vrednost u konfiguraciji poslala potpisane zahteve i
 * poslovni sadržaj preko čistog HTTP-a.
 */
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * `http://` prema adresi istog računara — samo uz `CS_CONNECTOR_ALLOW_LOOPBACK_HTTP=1`
 * i samo kada proces NIJE spakovan konektor (`CS_CONNECTOR_PACKAGED`). Spakovan
 * konektor za kancelariju i dalje prima isključivo HTTPS.
 */
export function dozvoljenLoopbackHttp(u, env = process.env) {
  return (
    env.CS_CONNECTOR_ALLOW_LOOPBACK_HTTP === "1" &&
    env.CS_CONNECTOR_PACKAGED !== "1" &&
    LOOPBACK.has(u.hostname)
  );
}

export function proveriOrigin(origin, { dozvoliHttp = false } = {}) {
  let u;
  try {
    u = new URL(origin);
  } catch {
    throw new ClientError("origin_invalid", "Serverski origin nije ispravan URL.");
  }
  if (u.protocol === "https:") {
    // U redu.
  } else if (u.protocol === "http:" && dozvoliHttp) {
    // Samo test režim.
  } else if (u.protocol === "http:" && dozvoljenLoopbackHttp(u)) {
    // Lokalni server na ISTOM računaru (uvoz arhive sa Mac-a): saobraćaj ne
    // napušta mašinu. Samo izričito i nikad u spakovanom konektoru.
  } else {
    throw new ClientError("origin_not_https", "Serverski origin mora biti HTTPS.");
  }
  if (u.search || u.hash) {
    throw new ClientError("origin_has_query", "Origin ne sme nositi query ni fragment.");
  }
  if (u.pathname !== "/") {
    throw new ClientError("origin_has_path", "Origin mora biti samo shema i host.");
  }
  return u.origin;
}

/**
 * Šalje jedan potpisan zahtev.
 *
 * Telo se serijalizuje JEDNOM i šalje kao potpuno isti niz bajtova nad kojim je
 * računat otisak. Ponovna serijalizacija pred slanje bi dala druge bajtove
 * (redosled ključeva, beline), i server bi odbio potpis nad nečim što nikad nije
 * poslato.
 *
 * @param {{ origin: string, path: string, bodyBytes: Uint8Array,
 *           deviceCode: string, keyId: string, privateKeyPkcs8Der: Uint8Array,
 *           timeoutMs?: number, dozvoliHttp?: boolean, fetchImpl?: typeof fetch,
 *           now?: Date }} ulaz
 */
export async function posaljiPotpisano(ulaz) {
  if (!SIGNED_PATHS.includes(ulaz.path)) {
    throw new ClientError("path_not_allowed", "Putanja nije u dozvoljenom skupu.");
  }
  const origin = proveriOrigin(ulaz.origin, { dozvoliHttp: ulaz.dozvoliHttp === true });

  /*
   * Nov nonce i nov timestamp pri SVAKOM pokušaju.
   *
   * Zato se potpisan zahtev ne čuva u redu kao gotov HTTP poziv: ponovljen
   * nonce je replay i server ga odbija, a stari timestamp bi ispao iz prozora.
   */
  const nonce = randomBytes(16).toString("hex");
  const timestamp = (ulaz.now ?? new Date()).toISOString();
  const otisak = bodyHash(ulaz.bodyBytes);

  const niz = signingString({
    version: PROTOCOL_VERSION,
    deviceId: ulaz.deviceCode,
    keyId: ulaz.keyId,
    method: "POST",
    path: ulaz.path,
    timestamp,
    nonce,
    bodyHash: otisak,
  });

  const kljuc = createPrivateKey({
    key: Buffer.from(ulaz.privateKeyPkcs8Der),
    format: "der",
    type: "pkcs8",
  });
  const potpis = cryptoSign(null, Buffer.from(niz, "utf8"), kljuc).toString("base64");

  const kontroler = new AbortController();
  const tajmer = setTimeout(() => kontroler.abort(), ulaz.timeoutMs ?? PODRAZUMEVAN_TIMEOUT_MS);
  const posalji = ulaz.fetchImpl ?? fetch;

  let odgovor;
  try {
    odgovor = await posalji(`${origin}${ulaz.path}`, {
      method: "POST",
      /*
       * `redirect: "error"`.
       *
       * Praćenje redirekcije bi poslalo potpis i poslovni sadržaj na host koji
       * nismo izabrali. Potpis pokriva putanju, ali ne i host — pa je jedina
       * odbrana da se redirekcija uopšte ne prati.
       */
      redirect: "error",
      headers: {
        "content-type": "application/json",
        [HEADERS.version]: PROTOCOL_VERSION,
        [HEADERS.device]: ulaz.deviceCode,
        [HEADERS.key]: ulaz.keyId,
        [HEADERS.timestamp]: timestamp,
        [HEADERS.nonce]: nonce,
        [HEADERS.bodyHash]: otisak,
        [HEADERS.signature]: potpis,
        /*
         * Zaštita pristupa ispred aplikacije (Vercel Deployment Protection).
         * NIJE autentifikacija prema portalu — tu ostaje potpis uređaja; samo
         * propušta zahtev do aplikacije na zaštićenoj (preview) adresi.
         */
        ...(ulaz.zastitaPristupa ? { "x-vercel-protection-bypass": ulaz.zastitaPristupa } : {}),
      },
      body: ulaz.bodyBytes,
      signal: kontroler.signal,
    });
  } catch (greska) {
    clearTimeout(tajmer);
    /*
     * Prekid mreže, timeout i odbijena redirekcija su ISTO za pozivaoca:
     * odgovor nije stigao, pa se ne sme ništa zaključiti o knjiženju.
     */
    const razlog = greska?.name === "AbortError" ? "timeout" : "mreza";
    return { transport: "neuspeh", razlog, httpStatus: 0, code: null, retryAfter: null, nonce };
  }
  clearTimeout(tajmer);

  /*
   * Ograničeno čitanje odgovora.
   *
   * Server vraća par stotina bajtova. Bez granice bi pogrešno usmeren zahtev
   * (posrednik, captive portal) mogao da povuče proizvoljno velik dokument u
   * memoriju konektora.
   */
  const sirovo = await procitajOgraniceno(odgovor);
  const retryAfter = ogranicenRetryAfter(odgovor.headers.get("retry-after"));

  let telo = null;
  const tip = (odgovor.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (tip === "application/json" && sirovo !== null) {
    try {
      telo = JSON.parse(sirovo);
    } catch {
      telo = null;
    }
  }

  /*
   * `code` se čita SAMO iz prepoznatog JSON tela.
   *
   * HTTP 200 sa HTML-om, praznim telom ili tuđim JSON-om ostaje `code: null`, i
   * `odlukaZaOdgovor` to tretira kao nepoznat odgovor — nikad kao potvrdu.
   */
  const code = telo && typeof telo.code === "string" ? telo.code : null;
  /*
   * Vreme čekanja: zaglavlje `Retry-After`, a ako ga nema, `retryAfterSeconds`
   * iz tela (server ga šalje uz 429). Isto ograničenje važi za oba izvora.
   */
  const cekanje =
    retryAfter ??
    (typeof telo?.retryAfterSeconds === "number" ? ogranicenRetryAfter(String(telo.retryAfterSeconds)) : null);

  return {
    transport: "ok",
    httpStatus: odgovor.status,
    code,
    ok: telo?.ok === true,
    // Tehničke reference; nikad sadržaj dokumenta.
    sourceDocumentId: telo?.sourceDocumentId ?? null,
    invoiceId: telo?.invoiceId ?? null,
    comparable: telo?.comparable ?? null,
    requestId: telo?.requestId ?? null,
    /*
     * Opis komande — jedini deo tela koji nije skalar.
     *
     * Prenosi se kakav jeste, bez tumačenja: `preuzmiKomandu` sam proverava tip
     * i verziju i odbija sve što ne prepoznaje. Ovde nema podataka o dokumentu;
     * komanda nosi samo ID, zatvoren tip, verziju i rok.
     */
    command: telo && typeof telo.command === "object" ? telo.command : null,
    retryAfter: cekanje,
    nonce,
  };
}

async function procitajOgraniceno(odgovor) {
  if (!odgovor.body) return null;
  const reader = odgovor.body.getReader();
  const delovi = [];
  let ukupno = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      ukupno += value.byteLength;
      if (ukupno > MAX_ODGOVOR_BAJTOVA) return null;
      delovi.push(value);
    }
  } catch {
    return null;
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(delovi.map((d) => Buffer.from(d))).toString("utf8");
}

/**
 * Heartbeat — postojeći endpoint i isti potpis.
 *
 * Bez `telo` šalje prazan objekat, kao do 0.3.8. Sa `telo` (izveštaj ciklusa,
 * samo brojevi i vremena — bez imena fajlova i podataka o kupcima) server
 * beleži ciklus. Telo se serijalizuje jednom; otisak pokriva baš te bajtove.
 */
export async function posaljiHeartbeat(ulaz) {
  const { telo, ...ostalo } = ulaz;
  return posaljiPotpisano({
    ...ostalo,
    path: "/api/sync/heartbeat",
    bodyBytes: new TextEncoder().encode(telo === undefined ? "{}" : JSON.stringify(telo)),
  });
}
