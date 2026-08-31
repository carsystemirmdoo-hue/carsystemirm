import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";

/**
 * Signing profil za prijem sa uređaja — v1.
 *
 * Čista logika: bez baze, bez Next-a, bez `server-only`. Isti modul računa
 * potpisni niz na uređaju i na serveru; dve implementacije istog niza bi se
 * razišle na prvom rubnom slučaju, a to bi izgledalo kao „potpis ne valja“.
 */

/* =========================================================================
 * Profil
 * ====================================================================== */

/** Verzija protokola. Ulazi u potpis; nepoznata se odbija, ne tumači. */
export const PROTOCOL_VERSION = "cs-sync-v1";

/**
 * Jedini dozvoljen algoritam.
 *
 * Klijent ga NE bira. Da polje `alg` dolazi iz zahteva, napadač bi ponudio
 * slabiji profil i server bi ga poslušao — klasičan `alg`-confusion. Ovde je
 * konstanta, a zahtev ne nosi nijedno polje kojim bi je promenio.
 *
 * Ed25519 preko `node:crypto`: bez HMAC-a (koji bi značio deljenu tajnu na
 * serveru) i bez sopstvene kriptografije.
 */
export const SIGNATURE_ALGORITHM = "ed25519";

/** Prozor tolerancije prema SERVERSKOM vremenu. */
export const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Rezerva iznad prozora, za čuvanje nonce-a.
 *
 * Nonce se mora čuvati bar dok zahtev može da prođe proveru vremena. Rezerva
 * pokriva razliku u satovima i kašnjenje brisanja; bez nje bi red obrisan na
 * samoj granici ponovo otvorio replay.
 */
export const NONCE_RETENTION_MARGIN_MS = 10 * 60 * 1000;

/** Nonce: heksadecimalan, tačno 32 znaka (128 bita nasumičnosti). */
const NONCE = /^[0-9a-f]{32}$/;

/** Oznake uređaja i ključa: kratke, bez znakova koji bi razbili potpisni niz. */
const OZNAKA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Dozvoljene kanonske putanje. Potpis pokriva putanju, pa ona mora biti tačna. */
export const SIGNED_PATHS = Object.freeze(["/api/sync/ingest", "/api/sync/heartbeat"]);

/** Imena zaglavlja. Mala slova — HTTP zaglavlja su case-insensitive. */
export const HEADERS = Object.freeze({
  version: "x-cs-sync-version",
  device: "x-cs-device-id",
  key: "x-cs-key-id",
  timestamp: "x-cs-timestamp",
  nonce: "x-cs-nonce",
  bodyHash: "x-cs-body-sha256",
  signature: "x-cs-signature",
});

export class SigningError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SigningError";
    this.code = code;
  }
}

/* =========================================================================
 * Potpisni niz
 * ====================================================================== */

/**
 * Tačno ono što se potpisuje.
 *
 * OSAM polja, svako u svom redu, razdvojena `\n`. Novi red je jedini
 * separator, a nijedno polje ga ne sme sadržati — sve su ograničene oblikom
 * (`OZNAKA`, `NONCE`, ISO vreme, `sha256:<hex>`, putanja iz zatvorene liste),
 * pa se dva različita zahteva ne mogu preslikati u isti niz.
 *
 * Zašto svako polje:
 * - `version`  — vezuje potpis za profil; menja se profil, stari potpisi padaju;
 * - `deviceId` — potpis jednog uređaja ne važi za drugi;
 * - `keyId`    — potpis se vezuje za konkretan ključ, pa rotacija ne prenosi važenje;
 * - `method`   — `POST` potpis se ne može upotrebiti kao `DELETE`;
 * - `path`     — potpis za `heartbeat` ne prolazi na `ingest`;
 * - `timestamp`— bez njega replay ne bi imao rok;
 * - `nonce`    — jedinstvenost unutar prozora;
 * - `bodyHash` — sadržaj. Bez njega bi se telo moglo zameniti uz isti potpis.
 *
 * QUERY STRING JE ZABRANJEN. Nije deo niza, pa ni potpisan; da je dozvoljen a
 * nepotpisan, napadač bi ga menjao slobodno. Zahtev sa upitnikom se odbija
 * (vidi `canonicalPath`).
 *
 * @param {{version: string, deviceId: string, keyId: string, method: string,
 *          path: string, timestamp: string, nonce: string, bodyHash: string}} p
 * @returns {string}
 */
export function signingString(p) {
  return [
    p.version,
    p.deviceId,
    p.keyId,
    p.method,
    p.path,
    p.timestamp,
    p.nonce,
    p.bodyHash,
  ].join("\n");
}

/** `sha256:<hex>` nad TAČNIM primljenim bajtovima tela. */
export function bodyHash(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/**
 * Kanonska putanja, ili greška.
 *
 * Prihvata isključivo putanju iz zatvorene liste, bez query stringa i bez
 * završne kose crte. Normalizacija se NE radi: `/api/sync//ingest` se odbija
 * umesto da se „popravi“, jer bi popravka značila da dva različita niza daju
 * isti potpis.
 */
export function canonicalPath(rawPath) {
  if (typeof rawPath !== "string" || rawPath === "") {
    throw new SigningError("path_invalid", "Putanja nije prisutna.");
  }
  if (rawPath.includes("?") || rawPath.includes("#")) {
    throw new SigningError("query_not_allowed", "Query string nije dozvoljen na ovoj putanji.");
  }
  if (!SIGNED_PATHS.includes(rawPath)) {
    throw new SigningError("path_invalid", "Putanja nije u dozvoljenom skupu.");
  }
  return rawPath;
}

/* =========================================================================
 * Provera zaglavlja
 * ====================================================================== */

/**
 * Čita i proverava OBLIK zaglavlja, pre ijednog upita.
 *
 * Namerno pre baze: nevažeći oblik se odbija bez ijednog čitanja, pa poplava
 * besmislenih zahteva ne postaje opterećenje baze.
 *
 * @param {(name: string) => string | null} get
 * @returns {{version: string, deviceId: string, keyId: string, timestamp: string,
 *            signedAtMs: number, nonce: string, bodyHash: string, signature: string}}
 */
export function readSignatureHeaders(get) {
  const uzmi = (ime) => {
    const v = get(ime);
    if (typeof v !== "string" || v === "") {
      throw new SigningError("header_missing", `Nedostaje zaglavlje ${ime}.`);
    }
    if (v.length > 200) {
      throw new SigningError("header_invalid", `Zaglavlje ${ime} je predugačko.`);
    }
    return v;
  };

  const version = uzmi(HEADERS.version);
  if (version !== PROTOCOL_VERSION) {
    throw new SigningError("version_unsupported", "Nepodržana verzija protokola.");
  }

  const deviceId = uzmi(HEADERS.device);
  const keyId = uzmi(HEADERS.key);
  if (!OZNAKA.test(deviceId) || !OZNAKA.test(keyId)) {
    throw new SigningError("identifier_invalid", "Oznaka uređaja ili ključa nije u dozvoljenom obliku.");
  }

  const timestamp = uzmi(HEADERS.timestamp);
  const signedAtMs = Date.parse(timestamp);
  if (!Number.isFinite(signedAtMs)) {
    throw new SigningError("timestamp_invalid", "Vreme zahteva nije u ISO obliku.");
  }

  const nonce = uzmi(HEADERS.nonce);
  if (!NONCE.test(nonce)) {
    throw new SigningError("nonce_invalid", "Nonce nije 32 heksadecimalna znaka.");
  }

  const hash = uzmi(HEADERS.bodyHash);
  if (!/^sha256:[0-9a-f]{64}$/.test(hash)) {
    throw new SigningError("body_hash_invalid", "Otisak tela nije u dozvoljenom obliku.");
  }

  const signature = uzmi(HEADERS.signature);
  // Ed25519 potpis je 64 bajta → 88 znakova base64 sa dopunom.
  if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) {
    throw new SigningError("signature_invalid", "Potpis nije u dozvoljenom obliku.");
  }

  return { version, deviceId, keyId, timestamp, signedAtMs, nonce, bodyHash: hash, signature };
}

/**
 * Vreme zahteva unutar prozora, u OBA smera.
 *
 * Budući timestamp se proverava jednako strogo kao prošli: bez toga bi uređaj
 * sa pomerenim satom mogao da „rezerviše“ nonce daleko unapred i time
 * produžiti rok replay-a preko onoga koliko se nonce čuva.
 */
export function timestampWithinWindow(signedAtMs, nowMs, windowMs = TIMESTAMP_WINDOW_MS) {
  return Math.abs(nowMs - signedAtMs) <= windowMs;
}

/** Dokle se nonce mora čuvati da bi replay ostao nemoguć. */
export function nonceRetainUntil(signedAtMs) {
  return new Date(signedAtMs + TIMESTAMP_WINDOW_MS + NONCE_RETENTION_MARGIN_MS);
}

/* =========================================================================
 * Verifikacija
 * ====================================================================== */

/**
 * Proverava potpis nad izračunatim potpisnim nizom.
 *
 * `publicKeySpki` je base64 SPKI DER. Neispravan ključ ili potpis daju
 * `false`, nikad izuzetak koji bi izleteo iz rukovaoca — greška u tuđem
 * ključu ne sme da obori zahtev drugim odgovorom nego što ga obara pogrešan
 * potpis, jer bi ta razlika bila oracle.
 *
 * @param {{signingString: string, signatureBase64: string, publicKeySpki: string}} input
 * @returns {boolean}
 */
export function verifySignature(input) {
  try {
    const key = createPublicKey({
      key: Buffer.from(input.publicKeySpki, "base64"),
      format: "der",
      type: "spki",
    });
    if (key.asymmetricKeyType !== "ed25519") return false;
    return cryptoVerify(
      null,
      Buffer.from(input.signingString, "utf8"),
      key,
      Buffer.from(input.signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

/** Otisak javnog ključa, za ljudsku proveru pri aktivaciji. */
export function keyFingerprint(publicKeySpkiBase64) {
  return `sha256:${createHash("sha256")
    .update(Buffer.from(publicKeySpkiBase64, "base64"))
    .digest("hex")}`;
}

/**
 * Da li je telo tačno ono nad kojim je potpis izračunat.
 *
 * Poredi se sa hash-om PRIMLJENIH bajtova, ne sa hash-om ponovo serijalizovanog
 * objekta. `JSON.stringify` nad parsiranim telom daje drugi niz bajtova
 * (redosled ključeva, beline, escape), pa bi takvo poređenje potpisivalo nešto
 * što pošiljalac nikada nije poslao.
 */
export function bodyMatchesHash(bytes, declaredHash) {
  const stvarni = bodyHash(bytes);
  return stvarni.length === declaredHash.length && timingSafeEqualStr(stvarni, declaredHash);
}

/** Poređenje bez ranog izlaska; hash nije tajna, ali navika jeste jeftina. */
function timingSafeEqualStr(a, b) {
  let razlika = 0;
  for (let i = 0; i < a.length; i += 1) razlika |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return razlika === 0;
}
