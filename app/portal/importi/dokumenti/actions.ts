"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  closeManualReview,
  IngestError,
  resolveDocumentRevision,
} from "@/lib/pdf/ingest";

export type DocumentReviewState = { error: string | null; ok: string | null };

const revisionSchema = z.object({
  supersededId: z.string().uuid(),
  supersedingId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Čovek kaže koja verzija dokumenta važi.
 *
 * Sistem nikada ne bira sam — ni po datumu fajla, ni po redosledu uvoza. Ranija
 * verzija se ne briše; postaje `superseded` i time prestaje da ulazi u promet.
 */
export async function resolveRevisionAction(
  _previous: DocumentReviewState,
  formData: FormData,
): Promise<DocumentReviewState> {
  const actor = await requireCapability("view:importi", "/portal/importi/dokumenti");

  const parsed = revisionSchema.safeParse({
    supersededId: formData.get("supersededId"),
    supersedingId: formData.get("supersedingId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: "Izaberite obe verzije i unesite razlog.", ok: null };
  }

  try {
    await resolveDocumentRevision(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
  } catch (error) {
    if (error instanceof IngestError) return { error: error.message, ok: null };
    throw error;
  }

  revalidatePath("/portal/importi/dokumenti");
  return { error: null, ok: "Zabeleženo je koja verzija važi." };
}

const reviewSchema = z.object({
  sourceDocumentId: z.string().uuid(),
  note: z.string().trim().min(3).max(500),
});

/**
 * Zatvaranje ručnog pregleda.
 *
 * Dokument u karantinu time NE postaje validan — pregled je zatvoren, prometa i
 * dalje nema.
 */
export async function closeReviewAction(
  _previous: DocumentReviewState,
  formData: FormData,
): Promise<DocumentReviewState> {
  const actor = await requireCapability("view:importi", "/portal/importi/dokumenti");

  const parsed = reviewSchema.safeParse({
    sourceDocumentId: formData.get("sourceDocumentId"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: "Unesite napomenu (najmanje 3 znaka).", ok: null };
  }

  try {
    await closeManualReview(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
  } catch (error) {
    if (error instanceof IngestError) return { error: error.message, ok: null };
    throw error;
  }

  revalidatePath("/portal/importi/dokumenti");
  return { error: null, ok: "Pregled je zatvoren." };
}
