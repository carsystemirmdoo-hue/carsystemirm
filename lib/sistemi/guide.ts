/**
 * Zajednički model vodiča kroz posao (stručne stranice „Sistemi i programi“).
 *
 * Tok: posao → (samo ako je potrebno) jedno pitanje → kratak rezultat (postupak i materijal)
 * → koraci sa detaljima na otvaranje. Tekst se ne prepisuje: vrednosti i uslovi ostaju
 * doslovno iz content/sistemi/*.json; ovde se samo bira šta je odmah vidljivo.
 */
import VAZNO from "@/content/sistemi/vazno.json";
import type { ResolvedProduct, SistemiJob, SistemiStep } from "./types";

/** Korak za izabranu varijantu (podlogu, vrstu): izmene iz `pod` zamenjuju opšti tekst. */
export function stepFor(step: SistemiStep, choice: string | undefined): SistemiStep {
  const variant = choice ? step.pod?.[choice] : undefined;
  if (!variant) return step;
  return {
    ...step,
    title: variant.title ?? step.title,
    what: variant.what ?? step.what,
    detail: variant.detail ?? step.detail,
    material: variant.material ?? step.material,
    products: variant.products?.length ? variant.products : step.products,
    sources: [...(variant.sources ?? []), ...(step.sources ?? [])],
  };
}

/** Koraci posla za izbor; bez izbora važe koraci bez ograničenja `only`. */
export function stepsFor(job: SistemiJob, choice: string | undefined): SistemiStep[] {
  return job.steps.filter((step) => !step.only || (choice ? step.only.includes(choice) : true)).map((step) => stepFor(step, choice));
}

/** Posao sa pitanjem traži odgovor pre rezultata. */
export function needsChoice(job: SistemiJob, choice: string | undefined): boolean {
  return Boolean(job.choice && !job.choice.options.some((option) => option.id === choice));
}

/*
 * Rečenica sa uslovom primene ostaje vidljiva: temperatura, vreme, „obavezno“, „ne sme“, „mora“.
 * Ostatak objašnjenja („zašto“) otvara se po potrebi. Rečenice se ne menjaju, samo se razdvajaju.
 */
const CONDITION = new RegExp(
  [
    "°C",
    "\\b\\d+(?:[,.]\\d+)?\\s*(?:–\\s*\\d+(?:[,.]\\d+)?\\s*)?(?:min|h|s|Nm)\\b",
    "\\btemperatur",
    "\\bobavezn",
    "\\bne sme",
    "\\bmora(?:ju)?\\b",
    "\\bne smeju\\b",
    "\\bizričito",
    "\\bpropisuje",
    "\\bzabranjuje",
    "\\bupozorava",
    "\\brizik",
    "\\bkoroz",
    "\\bpregrev",
    "\\bošteti",
    "\\bne može",
    "\\bne mogu\\b",
    "\\bne nanosi",
    "\\bisključivo",
    "\\bne pomaže",
    "\\bnije moguće",
  ].join("|"),
  "i",
);

/*
 * Rečenice koje su uslov ili upozorenje, a pravilo iznad ih ne prepoznaje (pregledano ručno,
 * 2026-10-31). Ključ: `<program>/<posao>/<korak>[/<izbor>]`; vrednost: doslovne rečenice iz objašnjenja.
 */
export const IMPORTANT_SENTENCES = VAZNO as Record<string, string[]>;

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZČĆŠĐŽ„"(0-9])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function splitDetail(detail: string | undefined, important: string[] = []): { conditions: string[]; why: string } {
  if (!detail) return { conditions: [], why: "" };
  const sentences = splitSentences(detail);
  const isCondition = (sentence: string) => CONDITION.test(sentence) || important.includes(sentence);
  const conditions = sentences.filter(isCondition);
  const why = sentences.filter((sentence) => !isCondition(sentence)).join(" ");
  return { conditions, why };
}

/** Ključ koraka za spisak važnih rečenica. */
export function importantKey(program: string, job: string, step: string, choice?: string): string {
  return [program, job, step, choice].filter(Boolean).join("/");
}

/** Materijal po koracima, bez ponavljanja, redom pojavljivanja (broj koraka uz svaki). */
export function materialSummary(steps: SistemiStep[]): { text: string; steps: number[] }[] {
  const map = new Map<string, number[]>();
  steps.forEach((step, index) => {
    const text = step.material?.trim();
    if (!text) return;
    map.set(text, [...(map.get(text) ?? []), index + 1]);
  });
  return [...map.entries()].map(([text, numbers]) => ({ text, steps: numbers }));
}

/** Proizvodi posla: prvo iz koraka (sa brojem koraka), zatim ostali proizvodi posla. */
export function jobProducts(job: SistemiJob, steps: SistemiStep[]): { slug: string; step?: number }[] {
  const seen = new Set<string>();
  const out: { slug: string; step?: number }[] = [];
  steps.forEach((step, index) => {
    for (const slug of step.products ?? []) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, step: index + 1 });
    }
  });
  for (const slug of job.products ?? []) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug });
  }
  return out;
}

/** Slika kartice posla: prva odobrena slika proizvoda tog posla (bez slike → znak). */
export function jobImage(
  job: SistemiJob,
  products: Record<string, ResolvedProduct>,
  avoid: Set<string> = new Set(),
): ResolvedProduct["image"] {
  const slugs = [...job.steps.flatMap((step) => step.products ?? []), ...(job.products ?? [])];
  const images = slugs.map((slug) => products[slug]?.image).filter((image): image is NonNullable<ResolvedProduct["image"]> => Boolean(image));
  return images.find((image) => !avoid.has(image.src)) ?? images[0] ?? null;
}

/** 1 korak, 2–4 koraka, 5+ koraka. */
export function stepsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} korak`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} koraka`;
  return `${count} koraka`;
}
