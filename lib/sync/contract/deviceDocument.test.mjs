import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDeviceDocumentBody, DEVICE_DOCUMENT_CONTRACT, isDeviceDocumentBody, MAX_DEVICE_PDF_BYTES, parseDeviceDocumentBody,
} from "./deviceDocument.mjs";
import { SIGNED_PATHS } from "../device/signing.mjs";

const PDF = new Uint8Array(readFileSync(new URL("../../../fixtures/dev/biznisoft/storno.pdf", import.meta.url)));
const obj = (b) => JSON.parse(Buffer.from(b).toString("utf8"));

test("telo: contract je prvi ključ, prepoznaje se po prefiksu i server ga prihvata", () => {
  const b = buildDeviceDocumentBody({ kind: "storno", bytes: PDF });
  assert.ok(isDeviceDocumentBody(b));
  assert.equal(Object.keys(obj(b))[0], "contract");
  const r = parseDeviceDocumentBody(obj(b));
  assert.equal(r.ok, true);
  assert.equal(r.kind, "storno");
  assert.deepEqual(Buffer.from(r.bytes), Buffer.from(PDF));
});

test("canonical faktura nije PDF telo", () => {
  assert.equal(isDeviceDocumentBody(Buffer.from(JSON.stringify({ schema_version: 1 }))), false);
  assert.equal(isDeviceDocumentBody(null), false);
});

test("graditelj odbija fakturu i prevelik PDF", () => {
  assert.throws(() => buildDeviceDocumentBody({ kind: "faktura", bytes: PDF }));
  assert.throws(() => buildDeviceDocumentBody({ kind: "storno", bytes: new Uint8Array(MAX_DEVICE_PDF_BYTES + 1) }));
});

test("server: tačni ključevi, vrsta, base64, %PDF i otisak", () => {
  const ok = obj(buildDeviceDocumentBody({ kind: "knjizno_odobrenje", bytes: PDF }));
  const kod = (izmena) => parseDeviceDocumentBody({ ...ok, ...izmena }).code;
  assert.equal(kod({ kind: "faktura" }), "document_kind_unsupported");
  assert.equal(kod({ contract: "drugi" }), "document_contract_invalid");
  assert.equal(kod({ pdf_base64: "nije base64!" }), "document_contract_invalid");
  assert.equal(kod({ pdf_sha256: "0".repeat(64) }), "document_hash_mismatch");
  assert.equal(parseDeviceDocumentBody({ ...ok, visak: 1 }).code, "document_contract_invalid");
  const nijePdf = Buffer.from("nije pdf dokument");
  assert.equal(
    parseDeviceDocumentBody({ ...ok, pdf_base64: nijePdf.toString("base64"), pdf_sha256: createHash("sha256").update(nijePdf).digest("hex") }).code,
    "document_invalid",
  );
  assert.equal(parseDeviceDocumentBody(null).code, "document_contract_invalid");
  assert.equal(ok.contract, DEVICE_DOCUMENT_CONTRACT);
});

test("putanja je u zatvorenom skupu potpisanih putanja", () => {
  assert.ok(SIGNED_PATHS.includes("/api/sync/document"));
});
