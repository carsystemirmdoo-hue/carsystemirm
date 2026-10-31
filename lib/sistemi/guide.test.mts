import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { IMPORTANT_SENTENCES, importantKey, materialSummary, needsChoice, splitDetail, splitSentences, stepsFor } from "@/lib/sistemi/guide";
import type { SistemiContent } from "@/lib/sistemi/types";

/*
 * Vodič kroz posao sme samo da razdvoji šta je odmah vidljivo; tekst i vrednosti ostaju
 * doslovno iz content/sistemi. Uslov primene (temperatura, vreme, „obavezno“, „ne sme“) se ne
 * skriva iza „Zašto“.
 */
const DIR = path.resolve(import.meta.dirname, "../../content/sistemi");
const pages = readdirSync(DIR)
  .filter((name) => name.endsWith(".json") && !["izvori.json", "slike-bez-potvrde-prava.json", "vazno.json"].includes(name))
  .map((name) => ({ name, data: JSON.parse(readFileSync(path.join(DIR, name), "utf8")) as SistemiContent }));

const details = pages.flatMap(({ data }) =>
  data.jobs.flatMap((job) =>
    job.steps.flatMap((step) => [step.detail, ...Object.values(step.pod ?? {}).map((variant) => variant.detail)]).filter((text): text is string => Boolean(text)),
  ),
);

test("razdvajanje objašnjenja ne menja i ne gubi tekst", () => {
  const squash = (text: string) => text.replace(/\s+/g, "");
  for (const detail of details) {
    const { conditions, why } = splitDetail(detail);
    const parts = [...conditions, why].filter(Boolean);
    for (const part of conditions) assert.ok(detail.includes(part), `uslov nije doslovan: ${part}`);
    assert.equal(squash(parts.join("")).length, squash(detail).length, detail);
  }
});

test("uslov sa temperaturom, vremenom ili zabranom ostaje vidljiv", () => {
  for (const detail of details) {
    const { why } = splitDetail(detail);
    assert.doesNotMatch(why, /°C|\bobavezn|\bne sme|\bmora\b/i, `skriveno u „Zašto“: ${why}`);
  }
});

test("posao sa pitanjem čeka odgovor; svaki odgovor daje bar jedan korak", () => {
  for (const { name, data } of pages) {
    for (const job of data.jobs) {
      if (!job.choice) {
        assert.equal(needsChoice(job, undefined), false);
        assert.ok(stepsFor(job, undefined).length > 0, `${name} ${job.id}`);
        continue;
      }
      assert.equal(needsChoice(job, undefined), true, `${name} ${job.id}`);
      for (const option of job.choice.options) {
        assert.equal(needsChoice(job, option.id), false);
        assert.ok(stepsFor(job, option.id).length > 0, `${name} ${job.id} ${option.id}`);
      }
    }
  }
});

test("pregled materijala prati korake bez ponavljanja", () => {
  const job = pages[0].data.jobs[0];
  const steps = stepsFor(job, job.choice?.options[0]?.id);
  const summary = materialSummary(steps);
  assert.equal(new Set(summary.map((item) => item.text)).size, summary.length);
  for (const item of summary) for (const number of item.steps) assert.equal(steps[number - 1].material?.trim(), item.text);
});

test("spisak važnih rečenica: svaka postoji doslovno u objašnjenju svog koraka", () => {
  const byKey = new Map<string, string>();
  for (const { name, data } of pages) {
    const program = name.replace(".json", "");
    for (const job of data.jobs)
      for (const step of job.steps) {
        if (step.detail) byKey.set(importantKey(program, job.id, step.id), step.detail);
        for (const [pod, variant] of Object.entries(step.pod ?? {})) if (variant.detail) byKey.set(importantKey(program, job.id, step.id, pod), variant.detail);
      }
  }
  for (const [key, sentences] of Object.entries(IMPORTANT_SENTENCES)) {
    const detail = byKey.get(key);
    assert.ok(detail, `nepoznat korak: ${key}`);
    for (const sentence of sentences) assert.ok(splitSentences(detail).includes(sentence), `${key}: „${sentence}“`);
  }
});

test("svako pitanje ima oznaku, svaki odgovor naziv, svaki posao naziv kartice", () => {
  for (const { name, data } of pages) {
    for (const job of data.jobs) {
      assert.ok((job.label ?? job.title).trim(), `${name} ${job.id}: kartica bez naziva`);
      if (!job.choice) continue;
      assert.ok(job.choice.question?.trim(), `${name} ${job.id}: pitanje bez oznake`);
      for (const option of job.choice.options) assert.ok(option.label.trim(), `${name} ${job.id}/${option.id}`);
    }
  }
});
