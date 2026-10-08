import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MAX_PDF_FILES_PER_UPLOAD,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_REQUEST_BYTES,
  SERVER_ACTION_BODY_LIMIT,
  UPLOAD_PROCESSING_BUDGET_MS,
  UPLOAD_ROUTE_MAX_DURATION_S,
  uploadSelectionError,
} from "./upload-limits.mjs";

/**
 * Regresija: akcija uvoza je dozvoljavala 20 MB po fajlu, 200 MB po prolazu i
 * 90 s obrade, a `next.config.ts` nije postavljao `bodySizeLimit` — Next je
 * odbijao sve preko 1 MB, a Vercel ionako sve preko 4,5 MB. Provere u kodu
 * nikad nisu dolazile na red.
 */

const root = new URL("../../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024;

test("granice su ispod onoga što Vercel funkcija prima", () => {
  assert.ok(MAX_UPLOAD_REQUEST_BYTES < VERCEL_BODY_LIMIT);
  assert.ok(MAX_UPLOAD_FILE_BYTES <= MAX_UPLOAD_REQUEST_BYTES);
  assert.equal(SERVER_ACTION_BODY_LIMIT, `${MAX_UPLOAD_REQUEST_BYTES / 1024 / 1024}mb`);
});

test("budžet obrade staje pre isteka funkcije, uz rezervu", () => {
  assert.ok(UPLOAD_PROCESSING_BUDGET_MS <= (UPLOAD_ROUTE_MAX_DURATION_S - 10) * 1000);
  // 60 s je najviše što Hobby dozvoljava bez Fluid compute.
  assert.ok(UPLOAD_ROUTE_MAX_DURATION_S <= 60);
});

test("next.config.ts postavlja bodySizeLimit iz istog modula", () => {
  const config = read("next.config.ts");
  assert.match(config, /serverActions:\s*\{\s*bodySizeLimit:\s*SERVER_ACTION_BODY_LIMIT\s*\}/);
  assert.match(config, /from "\.\/lib\/import\/upload-limits\.mjs"/);
});

test("rute sa otpremanjem nose maxDuration jednak zajedničkoj vrednosti", () => {
  for (const page of ["app/portal/importi/page.tsx", "app/portal/kupci/partneri/page.tsx"]) {
    const match = read(page).match(/export const maxDuration = (\d+);/);
    assert.ok(match, `${page}: nema maxDuration`);
    assert.equal(Number(match[1]), UPLOAD_ROUTE_MAX_DURATION_S, page);
  }
});

test("akcije ne nose sopstvene, veće granice", () => {
  for (const file of ["app/portal/importi/pdf-actions.ts", "app/portal/importi/actions.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /20 \* 1024 \* 1024|200 \* 1024 \* 1024|90 \* 1000/, file);
  }
  assert.match(read("app/portal/importi/pdf-actions.ts"), /uploadSelectionError\(files\)/);
  assert.match(read("lib/partners/partner-registry-service.ts"), /PARTNER_FILE_MAX_BYTES = MAX_UPLOAD_FILE_BYTES/);
});

test("izbor fajlova: broj, pojedinačna i ukupna veličina", () => {
  const mb = 1024 * 1024;
  assert.equal(uploadSelectionError([{ size: mb }, { size: mb }]), null);
  assert.match(uploadSelectionError([{ size: MAX_UPLOAD_FILE_BYTES + 1 }]), /Pojedinačan fajl/);
  assert.match(uploadSelectionError([{ size: 3 * mb }, { size: 2 * mb }]), /Podelite ih/);
  const many = Array.from({ length: MAX_PDF_FILES_PER_UPLOAD + 1 }, () => ({ size: 1 }));
  assert.match(uploadSelectionError(many), /Najviše/);
});
