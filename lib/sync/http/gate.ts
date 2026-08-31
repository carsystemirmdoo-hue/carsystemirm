import "server-only";

/**
 * Feature gate i bezbedno čitanje tela.
 *
 * Sve što je ovde radi PRE autentifikacije, pa mora biti jeftino i ne sme
 * dodirnuti bazu: prvi filter na mrežnoj granici ne sme biti i prvi trošak.
 */

/* =========================================================================
 * Gate
 * ====================================================================== */

/** Ime promenljive; jedini prekidač za oba endpointa. */
export const FEATURE_FLAG = "FEATURE_SYNC_DEVICE_INGEST";

/**
 * Prijem sa uređaja je PODRAZUMEVANO ISKLJUČEN.
 *
 * Traži se doslovno `"1"` — ne „bilo šta što liči na istinu“. `"0"`, `"false"`,
 * prazan string i odsustvo promenljive daju isto: isključeno. Da se prihvatalo
 * `Boolean(value)`, string `"0"` bi uključio kanal.
 *
 * Gate se čita po ZAHTEVU, ne pri učitavanju modula: gašenje mora da važi
 * odmah, bez ponovnog pokretanja procesa.
 */
export function isDeviceIngestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[FEATURE_FLAG] === "1";
}

/* =========================================================================
 * Ograničeno telo
 * ====================================================================== */

/**
 * Gornja granica tela.
 *
 * Izvedena iz ugovora, ne pogođena: 500 stavki × ~220 bajta po stavci u
 * najgorem slučaju (šifra 64, naziv 512, jedinica 32, šest decimalnih polja i
 * imena ključeva) ≈ 400 KB, plus zaglavlje dokumenta. `512 KB` ostavlja rezervu
 * a ostaje daleko ispod bilo čega što bi opteretilo proces.
 *
 * Dokument koji ne staje nije greška klijenta koju treba „popraviti“ većim
 * limitom — to je oblik koji ugovor ne opisuje.
 */
export const MAX_BODY_BYTES = 512 * 1024;

export class BodyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BodyError";
  }
}

/**
 * Čita telo uz TVRDU granicu nad stvarnim bajtovima.
 *
 * `Content-Length` se NE koristi kao granica: zaglavlje je tvrdnja klijenta,
 * može nedostajati (`chunked`) i može lagati. Broje se bajtovi kako stižu, i
 * čitanje se prekida čim pređu granicu — pa preveliko telo ne mora ni da se
 * primi do kraja da bi bilo odbijeno.
 *
 * Ako `Content-Length` POSTOJI i već je preko granice, odbija se odmah, bez
 * ijednog pročitanog bajta. To je optimizacija, ne provera.
 */
export async function readBoundedBody(
  request: Request,
  limit = MAX_BODY_BYTES,
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0) {
      throw new BodyError("content_length_invalid", "Neispravan Content-Length.", 400);
    }
    if (n > limit) {
      throw new BodyError("body_too_large", "Telo zahteva je preveliko.", 413);
    }
  }

  /*
   * Kompresija se ne prihvata.
   *
   * Dekompresija pre provere granice znači da mali zahtev može da postane
   * ogroman u memoriji (zip bomba). Uređaj šalje najviše nekoliko stotina
   * kilobajta i nema šta da dobije kompresijom.
   */
  const encoding = request.headers.get("content-encoding");
  if (encoding !== null && encoding.trim() !== "" && encoding.trim().toLowerCase() !== "identity") {
    throw new BodyError("encoding_unsupported", "Kompresija tela nije podržana.", 415);
  }

  const body = request.body;
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const delovi: Uint8Array[] = [];
  let ukupno = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      ukupno += value.byteLength;
      if (ukupno > limit) {
        throw new BodyError("body_too_large", "Telo zahteva je preveliko.", 413);
      }
      delovi.push(value);
    }
  } finally {
    // Prekid čitanja oslobađa vezu; bez ovoga preveliko telo nastavlja da stiže.
    await reader.cancel().catch(() => {});
  }

  const spojeno = new Uint8Array(ukupno);
  let pozicija = 0;
  for (const deo of delovi) {
    spojeno.set(deo, pozicija);
    pozicija += deo.byteLength;
  }
  return spojeno;
}

/**
 * Content type mora biti `application/json`.
 *
 * Provera je na tipu, ne na sadržaju: telo koje tvrdi da je nešto drugo se ne
 * parsira uopšte. Parametri (`; charset=utf-8`) se dozvoljavaju.
 */
export function requireJsonContentType(request: Request): void {
  const raw = request.headers.get("content-type");
  const tip = (raw ?? "").split(";")[0].trim().toLowerCase();
  if (tip !== "application/json") {
    throw new BodyError("content_type_unsupported", "Očekuje se application/json.", 415);
  }
}

/**
 * Parsira JSON iz već ograničenih bajtova.
 *
 * Poruka o grešci NE nosi ni deo tela: `JSON.parse` u svojoj poruci ume da
 * ispiše okolinu mesta greške, a to je poslovna prepiska.
 */
export function parseJsonBody(bytes: Uint8Array): unknown {
  let tekst: string;
  try {
    tekst = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BodyError("body_not_utf8", "Telo nije ispravan UTF-8.", 400);
  }
  try {
    return JSON.parse(tekst);
  } catch {
    throw new BodyError("body_not_json", "Telo nije ispravan JSON.", 400);
  }
}
