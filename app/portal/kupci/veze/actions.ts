"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireRecentMfa } from "@/lib/authz/session";
import { applyConfirmedLinks } from "@/lib/commercial/customerLinkApply";
import { LinkReviewError, readReview, registerFromRows } from "@/lib/commercial/linkReviewFiles.mjs";
import { XlsxReadError, readXlsx } from "@/lib/import/xlsx/readXlsx.mjs";
import { formatMegabytes } from "@/lib/import/upload-limits.mjs";
import { isPartnerRegistryUploadEnabled } from "@/lib/partners/gate";
import { PARTNER_FILE_MAX_BYTES } from "@/lib/partners/partner-registry-service";

export type LinkActionState = { error: string | null; ok: string | null; summary: string[] };

const PATH = "/portal/kupci/veze";
const REVIEW_MAX_BYTES = 1024 * 1024;

const OPIS: Record<string, string> = {
  would_apply: "biće primenjeno",
  created_and_linked: "otvoren kupac i povezana šifra",
  linked_existing: "šifra povezana sa postojećim kupcem",
  already_linked: "već povezano — bez radnje",
  stale: "predlog zastareo — napravite nov plan",
  not_confirmed: "nije potvrđeno u tabeli — preskočeno",
};

/**
 * Provera ili primena POTVRĐENIH veza „šifra sa fakture → kupac".
 *
 * Akter je UVEK prijavljen korisnik ove sesije — nikad ime iz tabele ni iz
 * forme. Kolona „potvrdio" je ko je red proverio u kancelariji i ide u
 * napomenu veze; ko je primenio vidi se u tragu revizije.
 *
 * Primena traži: `mappings:manage`, SVEŽU potvrdu drugog faktora (osetljiva
 * radnja: otvara kupce), uključen registar u ovom okruženju i izričitu
 * potvrdu u formi. Provera (bez upisa) traži samo `mappings:manage`.
 */
export async function linkReviewAction(_previous: LinkActionState, formData: FormData): Promise<LinkActionState> {
  const mode = formData.get("mode") === "primena" ? "primena" : "provera";
  let actor = await requireCapability("mappings:manage", PATH);
  if (mode === "primena") {
    const fresh = await requireRecentMfa();
    if (fresh.id !== actor.id || !can(fresh, "mappings:manage")) forbidden();
    actor = fresh;
    if (!isPartnerRegistryUploadEnabled()) {
      return { error: "Primena veza je isključena u ovom okruženju (FEATURE_PARTNER_REGISTRY).", ok: null, summary: [] };
    }
    if (formData.get("potvrda") !== "da") {
      return { error: "Potvrdite da ste pregledali tabelu i da primena otvara kupce.", ok: null, summary: [] };
    }
  }

  const issuerCode = String(formData.get("issuerCode") ?? "").trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(issuerCode)) return { error: "Unesite oznaku izdavaoca.", ok: null, summary: [] };
  const register = formData.get("sifarnik");
  const review = formData.get("pregled");
  if (!(register instanceof File) || register.size === 0) return { error: "Izaberite šifarnik partnera (XLSX).", ok: null, summary: [] };
  if (!(review instanceof File) || review.size === 0) return { error: "Izaberite pregledanu tabelu (CSV).", ok: null, summary: [] };
  if (register.size > PARTNER_FILE_MAX_BYTES) {
    return { error: `Šifarnik je veći od ${formatMegabytes(PARTNER_FILE_MAX_BYTES)}.`, ok: null, summary: [] };
  }
  if (review.size > REVIEW_MAX_BYTES) return { error: "Tabela je veća od 1 MB.", ok: null, summary: [] };

  try {
    const [sheet] = readXlsx(Buffer.from(await register.arrayBuffer()));
    const registerRows = registerFromRows(sheet?.rows ?? []);
    const { decisions, invoicePartners } = readReview(await review.text());
    const outcomes = await applyConfirmedLinks(
      { issuerCode, register: registerRows, invoicePartners, decisions, dryRun: mode !== "primena" },
      { id: actor.id, name: actor.name, role: actor.role },
    );
    const tally = new Map<string, number>();
    for (const o of outcomes) tally.set(o.result, (tally.get(o.result) ?? 0) + 1);
    if (mode === "primena") revalidatePath(PATH);
    return {
      error: null,
      ok: mode === "primena" ? "Primena završena." : "Provera završena — ništa nije upisano.",
      summary: [...tally].map(([k, n]) => `${OPIS[k] ?? k}: ${n}`),
    };
  } catch (error) {
    if (error instanceof LinkReviewError || error instanceof XlsxReadError) {
      return { error: error.message, ok: null, summary: [] };
    }
    throw error;
  }
}
