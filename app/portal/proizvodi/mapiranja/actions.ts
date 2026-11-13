"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  decideMapping,
  notifyMappingBatch,
  proposeMappingForArticle,
} from "@/lib/commercial/mapping-service";
import { ProductMappingError } from "@/lib/commercial/productMapping.mjs";
import { getAllCarsystemProducts } from "@/lib/carsystem-data";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import {
  catalogTargetProblem,
  describeCatalogTarget,
  type CatalogTarget,
} from "@/lib/ordering/ordering-service";

export type MappingActionState = { error: string | null; ok: string | null };

/**
 * Kataloški kandidati, svedeni na ono što mapiranje sme da gleda.
 *
 * Namerno se prosleđuju samo `slug` i `internalCode`. Kada bi funkcija videla i
 * naziv, pre ili kasnije bi ga neko upotrebio „samo za predlog".
 */
function catalogCandidates() {
  return getAllCarsystemProducts().map((product) => ({
    slug: product.slug,
    internalCode: product.internalCode ?? null,
  }));
}

const decideSchema = z.object({
  articleId: z.string().uuid(),
  status: z.enum(["mapped", "rejected", "revoked", "unmapped"]),
  catalogProductSlug: z.string().trim().max(200).nullable(),
  catalogVariantId: z.string().trim().max(200).nullable(),
  note: z.string().trim().min(3).max(500),
});

export async function proposeMappingAction(
  _previous: MappingActionState,
  formData: FormData,
): Promise<MappingActionState> {
  const actor = await requireCapability(
    "mappings:manage",
    "/portal/proizvodi/mapiranja",
  );
  const articleId = z.string().uuid().safeParse(formData.get("articleId"));
  if (!articleId.success) return { error: "Artikal nije prepoznat.", ok: null };

  try {
    const result = await proposeMappingForArticle(
      { articleId: articleId.data, catalogProducts: catalogCandidates() },
      { id: actor.id, name: actor.name, role: actor.role },
    );
    revalidatePath("/portal/proizvodi/mapiranja");
    return {
      error: null,
      ok:
        result.status === "suggested"
          ? `Predložena veza: ${result.catalogProductSlug}. Predlog nije potvrda — potvrdite je ručno.`
          : result.status === "conflict"
            ? "Više kataloških proizvoda nosi istu internu šifru. Katalog mora prvo razrešiti duplikat."
            : "Nijedan kataloški proizvod ne nosi tu internu šifru.",
    };
  } catch (error) {
    if (error instanceof ProductMappingError) return { error: error.message, ok: null };
    throw error;
  }
}

export async function decideMappingAction(
  _previous: MappingActionState,
  formData: FormData,
): Promise<MappingActionState> {
  const actor = await requireCapability(
    "mappings:manage",
    "/portal/proizvodi/mapiranja",
  );

  const slug = formData.get("catalogProductSlug");
  const variant = formData.get("catalogVariantId");
  const parsed = decideSchema.safeParse({
    articleId: formData.get("articleId"),
    status: formData.get("status"),
    catalogProductSlug: typeof slug === "string" && slug.length > 0 ? slug : null,
    catalogVariantId:
      typeof variant === "string" && variant.length > 0 ? variant : null,
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: "Izaberite stanje i unesite razlog (najmanje 3 znaka).", ok: null };
  }
  /*
   * Potvrda mora pokazivati na TAČAN proizvod i, kada proizvod ima više redova
   * šifara, na tačnu varijantu. Postojeće potvrđene veze se ovim ne diraju —
   * provera važi za novu odluku.
   */
  if (parsed.data.status === "mapped") {
    const problem = catalogTargetProblem(parsed.data.catalogProductSlug, parsed.data.catalogVariantId);
    if (problem) return { error: problem, ok: null };
  }

  try {
    await decideMapping(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
  } catch (error) {
    if (error instanceof ProductMappingError) return { error: error.message, ok: null };
    throw error;
  }

  revalidatePath("/portal/proizvodi/mapiranja");
  return { error: null, ok: "Veza artikla je sačuvana." };
}

/** Pregled kataloškog cilja pre potvrde: naziv, slika i varijante-redovi. */
export async function describeCatalogTargetAction(slug: string): Promise<CatalogTarget | null> {
  await requireCapability("mappings:manage", "/portal/proizvodi/mapiranja");
  return describeCatalogTarget(String(slug ?? "").slice(0, 200));
}

const confirmSchema = z.array(
  z.object({
    articleId: z.string().uuid(),
    slug: z.string().trim().min(1).max(200),
    variant: z.string().trim().max(200).nullable(),
  }),
).min(1).max(300);

/**
 * Potvrda predloga po nazivu (jedan ili „Potvrdi sve sigurne“), 2026-11-11.
 * Server za svaki artikal ponovo računa predlog i prihvata samo jednog od ponuđenih kandidata;
 * upis ide kroz `decideMapping` (audit, obaveštenje) kao i ručna potvrda.
 */
export async function confirmNameProposalsAction(items: { articleId: string; slug: string; variant: string | null }[]): Promise<MappingActionState> {
  const actor = await requireCapability("mappings:manage", "/portal/proizvodi/mapiranja");
  const parsed = confirmSchema.safeParse(items);
  if (!parsed.success) return { error: "Neispravan izbor.", ok: null };
  const { proposalFor } = await import("@/lib/catalog/name-proposals");
  let done = 0;
  const skipped: string[] = [];
  for (const it of parsed.data) {
    const p = await proposalFor(it.articleId);
    const cand = p?.ranked.find((c) => c.slug === it.slug && (c.variant ?? null) === (it.variant ?? null));
    if (!p || !cand) {
      skipped.push(p?.article.code ?? it.articleId.slice(0, 8));
      continue;
    }
    const problem = catalogTargetProblem(cand.slug, cand.variant);
    if (problem) {
      skipped.push(p.article.code);
      continue;
    }
    try {
      await decideMapping(
        {
          articleId: it.articleId,
          status: "mapped",
          catalogProductSlug: cand.slug,
          catalogVariantId: cand.variant,
          note: `Potvrđen predlog po nazivu (${p.confidence}, ocena ${cand.score}): ${cand.label}`.slice(0, 500),
        },
        { id: actor.id, name: actor.name, role: actor.role },
        { notify: false },
      );
      done++;
    } catch (error) {
      if (error instanceof ProductMappingError) skipped.push(p.article.code);
      else throw error;
    }
  }
  // Jedno zbirno obaveštenje umesto po jednog za svaku vezu (2026-11-13).
  await notifyMappingBatch({ mapped: done, revoked: 0, source: `Potvrđeni predlozi po nazivu (${actor.name})` });
  revalidatePath("/portal/proizvodi/mapiranja");
  return {
    error: done === 0 && skipped.length ? `Nijedna veza nije potvrđena (${skipped.slice(0, 10).join(", ")}).` : null,
    ok: done ? `Potvrđeno veza: ${done}.${skipped.length ? ` Preskočeno ${skipped.length} (predlog se promenio ili proizvod ne postoji): ${skipped.slice(0, 10).join(", ")}.` : ""}` : null,
  };
}

/**
 * Opis vlasnika za artikal koji predlog ne prepoznaje („crni sunđer 150×45 na M14 adapteru“), 2026-11-13.
 * Ništa ne povezuje — samo beleži opis (trag revizije), da ga pregled pročita i predloži tačnu karticu.
 */
export async function saveArticleNoteAction(input: { articleId: string; text: string }): Promise<MappingActionState> {
  const actor = await requireCapability("mappings:manage", "/portal/proizvodi/mapiranja");
  const p = z.object({ articleId: z.string().uuid(), text: z.string().trim().max(500) }).safeParse(input);
  if (!p.success) return { error: "Opis je predugačak (najviše 500 znakova).", ok: null };
  const [a] = [...(await getDb().execute<{ code: string; name: string }>(sql`SELECT code, name FROM articles WHERE id = ${p.data.articleId}::uuid`))];
  if (!a) return { error: "Artikal nije pronađen.", ok: null };
  await recordAudit({
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: AUDIT_ACTIONS.articleOwnerDescription,
    entityType: "Artikal",
    entityId: p.data.articleId,
    entityLabel: `${a.code} ${a.name}`.slice(0, 200),
    after: { text: p.data.text },
    reason: p.data.text ? "Opis artikla za povezivanje" : "Opis obrisan",
  });
  revalidatePath("/portal/proizvodi/mapiranja");
  return { error: null, ok: p.data.text ? "Opis je sačuvan." : "Opis je obrisan." };
}
