"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  decideMapping,
  proposeMappingForArticle,
} from "@/lib/commercial/mapping-service";
import { ProductMappingError } from "@/lib/commercial/productMapping.mjs";
import { getAllCarsystemProducts } from "@/lib/carsystem-data";
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
