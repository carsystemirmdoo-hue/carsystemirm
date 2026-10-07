import assert from "node:assert/strict";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import test from "node:test";

import {
  bodyHash,
  bodyMatchesHash,
  canonicalPath,
  HEADERS,
  keyFingerprint,
  NONCE_RETENTION_MARGIN_MS,
  nonceRetainUntil,
  PROTOCOL_VERSION,
  readSignatureHeaders,
  SIGNATURE_ALGORITHM,
  SIGNED_PATHS,
  SigningError,
  signingString,
  TIMESTAMP_WINDOW_MS,
  timestampWithinWindow,
  verifySignature,
} from "./signing.mjs";

/**
 * Signing profil — čista logika, sintetički ključevi.
 *
 * Nijedan ključ ovde nije stvaran: svaki par nastaje u testu i nestaje sa
 * procesom. Server ionako nikad ne vidi privatni deo.
 */

/** Sintetički par; privatni deo postoji SAMO u testu. */
function par() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    publicKeySpki: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
}

const potpisi = (privateKey, niz) =>
  cryptoSign(null, Buffer.from(niz, "utf8"), privateKey).toString("base64");

const OSNOV = {
  version: PROTOCOL_VERSION,
  deviceId: "office-pc-01",
  keyId: "k1",
  method: "POST",
  path: "/api/sync/ingest",
  timestamp: "2026-03-10T09:00:00.000Z",
  nonce: "0123456789abcdef0123456789abcdef",
  bodyHash: `sha256:${"a".repeat(64)}`,
};

/* =========================================================================
 * Profil
 * ====================================================================== */

test("algoritam je konstanta, ne polje zahteva", () => {
  assert.equal(SIGNATURE_ALGORITHM, "ed25519");
  /*
   * Nijedno zaglavlje ne nosi algoritam. Da ga nosi, napadač bi ponudio
   * slabiji profil i server bi ga poslušao — klasičan `alg`-confusion.
   */
  const imena = Object.values(HEADERS).join(" ");
  assert.doesNotMatch(imena, /alg/i);
});

test("potpisni niz nosi svih OSAM polja, razdvojenih novim redom", () => {
  const niz = signingString(OSNOV);
  assert.deepEqual(niz.split("\n"), [
    PROTOCOL_VERSION,
    "office-pc-01",
    "k1",
    "POST",
    "/api/sync/ingest",
    "2026-03-10T09:00:00.000Z",
    "0123456789abcdef0123456789abcdef",
    `sha256:${"a".repeat(64)}`,
  ]);
});

test("promena bilo kog polja menja potpisni niz", () => {
  const osnovni = signingString(OSNOV);
  const izmene = [
    ["verzija", { version: "cs-sync-v2" }],
    ["uređaj", { deviceId: "office-pc-02" }],
    ["ključ", { keyId: "k2" }],
    ["metod", { method: "DELETE" }],
    ["putanja", { path: "/api/sync/heartbeat" }],
    ["vreme", { timestamp: "2026-03-10T09:00:01.000Z" }],
    ["nonce", { nonce: "f".repeat(32) }],
    ["telo", { bodyHash: `sha256:${"b".repeat(64)}` }],
  ];
  for (const [sta, izmena] of izmene) {
    assert.notEqual(
      signingString({ ...OSNOV, ...izmena }),
      osnovni,
      `promena „${sta}“ nije promenila potpisni niz`,
    );
  }
});

test("dva različita zahteva se ne mogu preslikati u isti niz", () => {
  /*
   * Kada bi polja bila spojena bez ograničenja oblika, `deviceId="a\nb"` bi
   * pomerio sva naredna polja i dva različita zahteva bi dala isti niz. Oblik
   * je zato ograničen, i test to potvrđuje kroz `readSignatureHeaders`.
   */
  const sa = { ...OSNOV, deviceId: "a\nb" };
  const bez = { ...OSNOV, deviceId: "a", keyId: "b" };
  assert.notEqual(signingString(sa), signingString(bez));

  assert.throws(
    () => readSignatureHeaders(zaglavlja({ [HEADERS.device]: "a\nb" })),
    SigningError,
    "oznaka sa novim redom je prošla",
  );
});

/* =========================================================================
 * Putanja i query string
 * ====================================================================== */

test("query string je zabranjen, ne ignorisan", () => {
  for (const los of [
    "/api/sync/ingest?x=1",
    "/api/sync/ingest?",
    "/api/sync/ingest#frag",
  ]) {
    let uhvacena = null;
    try {
      canonicalPath(los);
    } catch (e) {
      uhvacena = e;
    }
    assert.ok(uhvacena instanceof SigningError, `„${los}“ nije odbijen`);
    assert.equal(uhvacena.code, "query_not_allowed", `„${los}“ nije odbijen kao query`);
  }
});

test("putanja se ne normalizuje, nego se odbija", () => {
  for (const los of [
    "/api/sync//ingest",
    "/api/sync/ingest/",
    "/api/sync/../sync/ingest",
    "/API/SYNC/INGEST",
    "/api/sync/unknown",
    "",
  ]) {
    assert.throws(() => canonicalPath(los), SigningError, `„${los}“ je prihvaćena`);
  }
  for (const dobra of SIGNED_PATHS) {
    assert.equal(canonicalPath(dobra), dobra);
  }
});

/* =========================================================================
 * Zaglavlja
 * ====================================================================== */

const zaglavlja = (preko = {}) => {
  const mapa = {
    [HEADERS.version]: PROTOCOL_VERSION,
    [HEADERS.device]: "office-pc-01",
    [HEADERS.key]: "k1",
    [HEADERS.timestamp]: "2026-03-10T09:00:00.000Z",
    [HEADERS.nonce]: "0123456789abcdef0123456789abcdef",
    [HEADERS.bodyHash]: `sha256:${"a".repeat(64)}`,
    [HEADERS.signature]: `${"A".repeat(86)}==`,
    ...preko,
  };
  return (ime) => (ime in mapa ? mapa[ime] : null);
};

test("ispravna zaglavlja se čitaju", () => {
  const h = readSignatureHeaders(zaglavlja());
  assert.equal(h.deviceId, "office-pc-01");
  assert.equal(h.nonce, "0123456789abcdef0123456789abcdef");
  assert.equal(h.signedAtMs, Date.parse("2026-03-10T09:00:00.000Z"));
});

test("neispravna zaglavlja se odbijaju sa stabilnim kodom", () => {
  const slucajevi = [
    ["nema verzije", { [HEADERS.version]: null }, "header_missing"],
    ["tuđa verzija", { [HEADERS.version]: "cs-sync-v9" }, "version_unsupported"],
    ["prazan uređaj", { [HEADERS.device]: "" }, "header_missing"],
    ["uređaj sa razmakom", { [HEADERS.device]: "a b" }, "identifier_invalid"],
    ["uređaj predugačak", { [HEADERS.device]: "a".repeat(65) }, "identifier_invalid"],
    ["vreme nije ISO", { [HEADERS.timestamp]: "juče" }, "timestamp_invalid"],
    ["nonce prekratak", { [HEADERS.nonce]: "abc" }, "nonce_invalid"],
    ["nonce nije hex", { [HEADERS.nonce]: "z".repeat(32) }, "nonce_invalid"],
    ["nonce velikim slovima", { [HEADERS.nonce]: "A".repeat(32) }, "nonce_invalid"],
    ["otisak bez prefiksa", { [HEADERS.bodyHash]: "a".repeat(64) }, "body_hash_invalid"],
    ["potpis pogrešne dužine", { [HEADERS.signature]: "AAAA" }, "signature_invalid"],
    ["zaglavlje predugačko", { [HEADERS.key]: "k".repeat(201) }, "header_invalid"],
  ];

  for (const [naziv, preko, kod] of slucajevi) {
    let uhvacena = null;
    try {
      readSignatureHeaders(zaglavlja(preko));
    } catch (e) {
      uhvacena = e;
    }
    assert.ok(uhvacena instanceof SigningError, `„${naziv}“ nije odbijen`);
    assert.equal(uhvacena.code, kod, `„${naziv}“: očekivan ${kod}, dobijen ${uhvacena.code}`);
  }
});

/* =========================================================================
 * Vreme
 * ====================================================================== */

test("prozor je ±5 minuta i strog u OBA smera", () => {
  const sada = Date.parse("2026-03-10T09:00:00.000Z");
  assert.equal(TIMESTAMP_WINDOW_MS, 5 * 60 * 1000);

  assert.equal(timestampWithinWindow(sada, sada), true);
  // Tačno na granici — prolazi.
  assert.equal(timestampWithinWindow(sada - TIMESTAMP_WINDOW_MS, sada), true);
  assert.equal(timestampWithinWindow(sada + TIMESTAMP_WINDOW_MS, sada), true);
  // Sekundu preko — pada, u oba smera.
  assert.equal(timestampWithinWindow(sada - TIMESTAMP_WINDOW_MS - 1000, sada), false);
  assert.equal(
    timestampWithinWindow(sada + TIMESTAMP_WINDOW_MS + 1000, sada),
    false,
    "budući timestamp je propušten — pomeren sat bi rezervisao nonce unapred",
  );
});

test("nonce se čuva duže nego što zahtev može da prođe", () => {
  const signedAt = Date.parse("2026-03-10T09:00:00.000Z");
  const rok = nonceRetainUntil(signedAt).getTime();

  /*
   * Poslednji trenutak u kome zahtev sa ovim timestamp-om još prolazi proveru
   * vremena je `signedAt + prozor`. Rok mora biti STROGO posle toga, inače bi
   * brisanje na granici ponovo otvorilo replay.
   */
  assert.ok(rok > signedAt + TIMESTAMP_WINDOW_MS, "rok čuvanja ne pokriva ceo prozor");
  assert.equal(rok, signedAt + TIMESTAMP_WINDOW_MS + NONCE_RETENTION_MARGIN_MS);
});

/* =========================================================================
 * Telo
 * ====================================================================== */

test("otisak tela se računa nad PRIMLJENIM bajtovima", () => {
  const telo = new TextEncoder().encode('{"b":1,"a":2}');
  const otisak = bodyHash(telo);

  assert.equal(bodyMatchesHash(telo, otisak), true);

  /*
   * Ponovo serijalizovan objekat daje DRUGE bajtove — ovde beline, drugde
   * redosled ključeva ili escape. Da se potpis proveravao nad njim,
   * potpisivalo bi se nešto što pošiljalac nikada nije poslao.
   */
  const saBelinama = '{ "b" : 1 , "a" : 2 }';
  const primljeno = new TextEncoder().encode(saBelinama);
  const ponovo = new TextEncoder().encode(JSON.stringify(JSON.parse(saBelinama)));
  assert.notEqual(
    bodyHash(ponovo),
    bodyHash(primljeno),
    "ponovna serijalizacija je dala isti otisak — primer ne dokazuje razliku",
  );

  // Jedan izmenjen bajt menja otisak.
  const izmenjeno = new TextEncoder().encode('{"b":2,"a":2}');
  assert.equal(bodyMatchesHash(izmenjeno, otisak), false);
});

test("prazno telo ima svoj otisak i nije izuzetak", () => {
  const prazno = new Uint8Array(0);
  assert.match(bodyHash(prazno), /^sha256:[0-9a-f]{64}$/);
  assert.equal(bodyMatchesHash(prazno, bodyHash(prazno)), true);
});

/* =========================================================================
 * Potpis
 * ====================================================================== */

test("ispravan potpis prolazi, izmenjen ne", () => {
  const { privateKey, publicKeySpki } = par();
  const niz = signingString(OSNOV);
  const potpis = potpisi(privateKey, niz);

  assert.equal(verifySignature({ signingString: niz, signatureBase64: potpis, publicKeySpki }), true);

  // Izmenjen niz — isti potpis više ne važi.
  const drugiNiz = signingString({ ...OSNOV, bodyHash: `sha256:${"c".repeat(64)}` });
  assert.equal(
    verifySignature({ signingString: drugiNiz, signatureBase64: potpis, publicKeySpki }),
    false,
  );
});

test("potpis jednog ključa ne važi za drugi", () => {
  const a = par();
  const b = par();
  const niz = signingString(OSNOV);
  const potpis = potpisi(a.privateKey, niz);

  assert.equal(
    verifySignature({ signingString: niz, signatureBase64: potpis, publicKeySpki: b.publicKeySpki }),
    false,
  );
});

test("neispravan ključ ili potpis daju `false`, ne izuzetak", () => {
  /*
   * Izuzetak bi izleteo iz rukovaoca i dao drugi odgovor nego pogrešan potpis
   * — a ta razlika bi bila oracle.
   */
  const niz = signingString(OSNOV);
  for (const los of ["", "nije-base64!!", "AAAA", `${"A".repeat(86)}==`]) {
    assert.equal(
      verifySignature({ signingString: niz, signatureBase64: los, publicKeySpki: par().publicKeySpki }),
      false,
    );
  }
  for (const losKljuc of ["", "AAAA", "nije-kljuc"]) {
    assert.equal(
      verifySignature({ signingString: niz, signatureBase64: "A".repeat(88), publicKeySpki: losKljuc }),
      false,
    );
  }
});

test("ključ drugog tipa se odbija", () => {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  assert.equal(
    verifySignature({
      signingString: signingString(OSNOV),
      signatureBase64: `${"A".repeat(86)}==`,
      publicKeySpki: spki,
    }),
    false,
    "RSA ključ je prihvaćen u Ed25519 profilu",
  );
});

test("otisak ključa je stabilan i razlikuje ključeve", () => {
  const a = par();
  const b = par();
  assert.match(keyFingerprint(a.publicKeySpki), /^sha256:[0-9a-f]{64}$/);
  assert.equal(keyFingerprint(a.publicKeySpki), keyFingerprint(a.publicKeySpki));
  assert.notEqual(keyFingerprint(a.publicKeySpki), keyFingerprint(b.publicKeySpki));
});

test("potpis za heartbeat ne prolazi na ingest", () => {
  const { privateKey, publicKeySpki } = par();
  const zaHeartbeat = signingString({ ...OSNOV, path: "/api/sync/heartbeat" });
  const potpis = potpisi(privateKey, zaHeartbeat);

  const zaIngest = signingString({ ...OSNOV, path: "/api/sync/ingest" });
  assert.equal(
    verifySignature({ signingString: zaIngest, signatureBase64: potpis, publicKeySpki }),
    false,
  );
});

test("javni ključ za registraciju: tačno oblik koji ispisuje connector init (Ed25519 SPKI)", async () => {
  const { generateKeyPairSync } = await import("node:crypto");
  const { isEd25519SpkiBase64 } = await import("./signing.mjs");
  const { publicKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  // Regresija: forma je tražila sirov ključ (44 znaka) i odbijala SPKI iz konektora.
  assert.equal(spki.length, 60);
  assert.equal(isEd25519SpkiBase64(spki), true);
  const raw = publicKey.export({ format: "jwk" }).x;
  assert.equal(isEd25519SpkiBase64(Buffer.from(raw, "base64url").toString("base64")), false, "sirov ključ nije SPKI");
  const { publicKey: ec } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  assert.equal(isEd25519SpkiBase64(ec.export({ type: "spki", format: "der" }).toString("base64")), false, "drugi algoritam");
  assert.equal(isEd25519SpkiBase64("MCowBQYDK2VwAyEA" + "A".repeat(43) + "="), true);
  assert.equal(isEd25519SpkiBase64("MCowBQYDK2VwAyEA" + "A".repeat(42) + "=="), false);
  assert.equal(isEd25519SpkiBase64(undefined), false);
});
