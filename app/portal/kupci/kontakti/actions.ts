"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireRecentMfa } from "@/lib/authz/session";
import { applyContactProposals } from "@/lib/customers/contact-bulk-service";
import { CONTACT_OUTCOMES, ContactProposalError, readContactProposals } from "@/lib/customers/contactProposalFiles.mjs";
import { LinkReviewError } from "@/lib/commercial/linkReviewFiles.mjs";
import { isPartnerRegistryUploadEnabled } from "@/lib/partners/gate";

export type ContactActionState = { error: string | null; ok: string | null; summary: string[]; izdvojeno: string[] };

const PATH = "/portal/kupci/kontakti";
const TABLE_MAX_BYTES = 1024 * 1024;
const PRESKOCENO = new Set(["would_create", "created", "already_present", "not_confirmed"]);
const empty = (error: string): ContactActionState => ({ error, ok: null, summary: [], izdvojeno: [] });

/**
 * Provera ili primena grupnog predloga kontakata iz pregledane tabele.
 *
 * Akter je UVEK prijavljen korisnik ove sesije — kolona „potvrdio" je ko je
 * red potvrdio u kancelariji i ide u razlog naloga. Nastaju samo nalozi
 * `requested` bez lozinke: bez potvrde osobe, bez poziva i bez slanja pošte.
 *
 * Primena traži `customer_accounts:manage`, SVEŽ drugi faktor istog korisnika,
 * uključen registar u ovom okruženju i izričitu potvrdu u formi.
 */
export async function contactProposalAction(_previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const mode = formData.get("mode") === "primena" ? "primena" : "provera";
  let actor = await requireCapability("customer_accounts:manage", PATH);
  if (mode === "primena") {
    const fresh = await requireRecentMfa();
    if (fresh.id !== actor.id || !can(fresh, "customer_accounts:manage")) forbidden();
    actor = fresh;
    if (!isPartnerRegistryUploadEnabled()) return empty("Primena je isključena u ovom okruženju (FEATURE_PARTNER_REGISTRY).");
    if (formData.get("potvrda") !== "da") return empty("Potvrdite da ste pregledali proveru i da primena upisuje kontakte.");
  }

  const issuerCode = String(formData.get("issuerCode") ?? "").trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(issuerCode)) return empty("Unesite oznaku izdavaoca.");
  const table = formData.get("tabela");
  if (!(table instanceof File) || table.size === 0) return empty("Izaberite pregledanu tabelu kontakata (CSV).");
  if (table.size > TABLE_MAX_BYTES) return empty("Tabela je veća od 1 MB.");

  try {
    const rows = readContactProposals(await table.text());
    const outcomes = await applyContactProposals(
      { issuerCode, rows, dryRun: mode !== "primena" },
      { id: actor.id, name: actor.name, role: actor.role },
    );
    const tally = new Map<string, number>();
    for (const o of outcomes) tally.set(o.outcome, (tally.get(o.outcome) ?? 0) + 1);
    if (mode === "primena") revalidatePath("/portal/kupci/nalozi");
    return {
      error: null,
      ok: mode === "primena" ? "Primena završena. Pozivi nisu izdati." : "Provera završena — ništa nije upisano.",
      summary: [...tally].map(([k, n]) => `${CONTACT_OUTCOMES[k as keyof typeof CONTACT_OUTCOMES] ?? k}: ${n}`),
      izdvojeno: outcomes
        .filter((o) => !PRESKOCENO.has(o.outcome))
        .map((o) => `red ${o.red}, šifra ${o.code}: ${CONTACT_OUTCOMES[o.outcome as keyof typeof CONTACT_OUTCOMES] ?? o.outcome}`),
    };
  } catch (error) {
    if (error instanceof ContactProposalError || error instanceof LinkReviewError) return empty(error.message);
    throw error;
  }
}
