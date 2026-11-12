import { createHash } from "node:crypto";

/**
 * Storno i knjižno odobrenje sa uređaja (2026-11-12, konektor 0.3.14).
 *
 * Faktura i dalje putuje kao canonical JSON (`/api/sync/ingest`) — tamo uređaj čita PDF, a
 * server proverava svaki broj. Za storno i knjižno odobrenje taj ugovor ne postoji, pa uređaj
 * šalje SAM PDF, a server ga čita istim čitačem kao ručni upload na /portal/importi. Ishod je
 * zato isti kao da je kancelarija otpremila fajl: storno se vezuje za original samo po
 * odštampanoj referenci (docs/b2b/48), knjižno odobrenje se knjiži samo kada je čisto pročitano.
 *
 * Modul je ZAJEDNIČKI (server i konektor), bez zavisnosti osim `node:crypto`.
 */

export const DEVICE_DOCUMENT_CONTRACT = "carsystem/pdf-document/v1";
export const DEVICE_DOCUMENT_PATH = "/api/sync/document";

/** Samo ove vrste smeju ovim putem. Faktura NE — ona ima svoj, stroži ugovor. */
export const DEVICE_DOCUMENT_KINDS = Object.freeze(["storno", "knjizno_odobrenje"]);

/**
 * Najveći PDF. Telo zahteva je ograničeno na 512 KB (`MAX_BODY_BYTES`), a base64 je 4/3 veći;
 * 360 KB ostavlja mesta za omotač. Stvarni dokumenti o smanjenju i storna su 40–120 KB.
 */
export const MAX_DEVICE_PDF_BYTES = 360 * 1024;

const KLJUCEVI = ["contract", "kind", "pdf_base64", "pdf_sha256"];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * Telo zahteva. `contract` je PRVI ključ — konektor po tom prefiksu bira putanju slanja, bez
 * nove kolone u lokalnom redu.
 *
 * @param {{ kind: string, bytes: Uint8Array }} ulaz
 * @returns {Buffer}
 */
export function buildDeviceDocumentBody({ kind, bytes }) {
  if (!DEVICE_DOCUMENT_KINDS.includes(kind)) throw new Error(`Vrsta ${kind} ne ide ovim putem.`);
  if (bytes.byteLength > MAX_DEVICE_PDF_BYTES) throw new Error("PDF je prevelik za slanje.");
  const buf = Buffer.from(bytes);
  return Buffer.from(
    JSON.stringify({
      contract: DEVICE_DOCUMENT_CONTRACT,
      kind,
      pdf_base64: buf.toString("base64"),
      pdf_sha256: createHash("sha256").update(buf).digest("hex"),
    }),
    "utf8",
  );
}

const PREFIKS = Buffer.from(`{"contract":"${DEVICE_DOCUMENT_CONTRACT}"`, "utf8");

/** Da li je sačuvano telo iz reda PDF dokument (a ne canonical faktura). */
export function isDeviceDocumentBody(/** @type {Uint8Array | null | undefined} */ telo) {
  if (!telo || telo.byteLength < PREFIKS.byteLength) return false;
  return Buffer.from(telo.buffer, telo.byteOffset, PREFIKS.byteLength).equals(PREFIKS);
}

/**
 * Serverska provera tela. Ničemu se ne veruje: tačni ključevi, dozvoljena vrsta, strogi base64,
 * veličina, `%PDF` zaglavlje i otisak koji se poklapa sa bajtovima.
 *
 * @param {unknown} telo  već parsiran JSON
 * @returns {{ ok: true, kind: string, bytes: Uint8Array } | { ok: false, code: string }}
 */
export function parseDeviceDocumentBody(telo) {
  if (!telo || typeof telo !== "object" || Array.isArray(telo)) return { ok: false, code: "document_contract_invalid" };
  const t = /** @type {Record<string, unknown>} */ (telo);
  const kljucevi = Object.keys(t).sort();
  if (kljucevi.join(",") !== [...KLJUCEVI].sort().join(",")) return { ok: false, code: "document_contract_invalid" };
  if (t.contract !== DEVICE_DOCUMENT_CONTRACT) return { ok: false, code: "document_contract_invalid" };
  if (typeof t.kind !== "string" || !DEVICE_DOCUMENT_KINDS.includes(t.kind)) return { ok: false, code: "document_kind_unsupported" };
  if (typeof t.pdf_base64 !== "string" || !BASE64.test(t.pdf_base64) || t.pdf_base64.length % 4 !== 0) {
    return { ok: false, code: "document_contract_invalid" };
  }
  if (typeof t.pdf_sha256 !== "string" || !SHA256.test(t.pdf_sha256)) return { ok: false, code: "document_contract_invalid" };
  const bytes = Buffer.from(t.pdf_base64, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DEVICE_PDF_BYTES) return { ok: false, code: "document_too_large" };
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, code: "document_invalid" };
  if (createHash("sha256").update(bytes).digest("hex") !== t.pdf_sha256) return { ok: false, code: "document_hash_mismatch" };
  return { ok: true, kind: t.kind, bytes: new Uint8Array(bytes) };
}
