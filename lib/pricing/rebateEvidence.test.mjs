import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRebates, conflictWithExisting, proposalReason } from "./rebateEvidence.mjs";

const line = (over) => ({
  customerId: "c1", customerName: "Firma", productGroup: "Bazni lakovi", articleCode: "A1",
  invoiceId: "i1", documentLabel: "F-1/2026", issuedOn: "2026-01-10", discountPercent: 10, ...over,
});

test("dosledan rabat na dovoljno stavki i dokumenata je kandidat", () => {
  const [r] = analyzeRebates([
    line({ invoiceId: "i1" }), line({ invoiceId: "i2", issuedOn: "2026-02-10", articleCode: "A2" }), line({ invoiceId: "i3", issuedOn: "2026-03-10" }),
  ]);
  assert.equal(r.status, "consistent");
  assert.equal(r.candidatePercent, 10);
  assert.equal(r.documentCount, 3);
  assert.deepEqual(r.articleCodes, ["A1", "A2"]);
  assert.match(proposalReason(r), /rabat 10 % na 3 stavki u 3 dokumenata \(2026-01-10 – 2026-03-10\)/);
});

test("različiti rabati za istu grupu su protivrečni, sa brojem stavki po vrednosti", () => {
  const [r] = analyzeRebates([
    line({ invoiceId: "i1" }), line({ invoiceId: "i2" }), line({ invoiceId: "i3", discountPercent: 15 }),
  ]);
  assert.equal(r.status, "contradictory");
  assert.equal(r.candidatePercent, null);
  assert.deepEqual(r.values.map((v) => [v.discountPercent, v.lines]), [[10, 2], [15, 1]]);
});

test("bez rabata, premalo dokaza i artikal bez grupe se razlikuju", () => {
  const rows = analyzeRebates([
    line({ customerId: "a", customerName: "A", discountPercent: 0, invoiceId: "x1" }),
    line({ customerId: "a", customerName: "A", discountPercent: 0, invoiceId: "x2" }),
    line({ customerId: "a", customerName: "A", discountPercent: 0, invoiceId: "x3" }),
    line({ customerId: "b", customerName: "B", invoiceId: "y1" }),
    line({ customerId: "b", customerName: "B", invoiceId: "y1", articleCode: "A2" }),
    line({ customerId: "b", customerName: "B", invoiceId: "y1", articleCode: "A3" }),
    line({ customerId: "c", customerName: "C", productGroup: null }),
  ]);
  assert.deepEqual(rows.map((r) => [r.customerName, r.status]), [["A", "no_discount"], ["B", "thin"], ["C", "missing_group"]]);
});

test("zaokruživanje nije drugi rabat", () => {
  const [r] = analyzeRebates([line({ invoiceId: "i1", discountPercent: 10.0001 }), line({ invoiceId: "i2" }), line({ invoiceId: "i3" })]);
  assert.equal(r.status, "consistent");
});

test("kandidat u sukobu sa postojećim uslovom se prijavljuje", () => {
  assert.equal(conflictWithExisting(10, [{ source: "cenovnik", discountPercent: 10 }]), null);
  assert.equal(conflictWithExisting(10, [{ source: "cenovnik", discountPercent: 12 }]), "cenovnik: 12 %");
  assert.equal(conflictWithExisting(null, [{ source: "cenovnik", discountPercent: 12 }]), null);
});

test("jedna stavka bez rabata je premalo dokaza, ne „bez rabata”", () => {
  const [r] = analyzeRebates([line({ discountPercent: 0 })]);
  assert.equal(r.status, "thin");
});
