"use server";

import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { requireCapability } from "@/lib/authz/session";
import { buildXlsx } from "@/lib/export/xlsxFile.mjs";
import { createSupplierOrder, IncomingError } from "@/lib/procurement/incoming-service";
import { leadFor, stavki, SUPPLIERS } from "@/lib/procurement/incoming.mjs";
import { resolveOrderLines } from "@/lib/procurement/procurement-service";
import { orderFileName } from "@/lib/procurement/suggest.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

const schema = z.object({
  label: z.string().trim().min(1).max(60),
  lines: z
    .array(z.object({ code: z.string().trim().min(1).max(40), quantity: z.number().positive().max(1_000_000) }))
    .min(1)
    .max(3000),
});

export type OrderFileResult = { ok: true; fileName: string; base64: string; count: number; skipped: number } | { ok: false; text: string };

/**
 * Fajl porudžbine dobavljaču: SAMO šifra, naziv, količina i JM — bez predloga, prodaje i lagera.
 * Naziv i JM se uzimaju iz baze; šta je preuzeto pamti se u istoriji aktivnosti.
 */
export async function orderFileAction(input: unknown): Promise<OrderFileResult> {
  const user = await requireCapability("procurement:prepare", "/portal/nabavka");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, text: "Upišite bar jednu količinu veću od nule." };
  // Redosled u fajlu: po nazivu (kako dobavljač čita), ne po redosledu upisa.
  const lines = (await resolveOrderLines(parsed.data.lines)).sort((x, y) => x.name.localeCompare(y.name, "sr-Latn"));
  if (!lines.length) return { ok: false, text: "Nijedna šifra nije pronađena u šifarniku ni u lageru." };
  const missing = parsed.data.lines.length - lines.length;
  const today = belgradeDate(new Date());
  const dmy = today.split("-").reverse().join(".") + ".";
  const body = buildXlsx({
    sheetName: "Porudžbina",
    rows: [
      [`Porudžbina — ${parsed.data.label} — ${dmy}`],
      [],
      ["Šifra", "Naziv", "Količina", "JM"],
      ...lines.map((l) => [l.code, l.name, l.quantity, l.unit]),
    ],
    boldRows: [0, 2],
    widths: [14, 56, 11, 7],
  });
  await recordAudit({
    actor: { id: user.id, name: user.name, role: user.role },
    action: AUDIT_ACTIONS.exportGenerated,
    entityType: "Porudžbina dobavljaču",
    entityId: null,
    entityLabel: parsed.data.label,
    after: { stavki: lines.length, stavke: lines.map((l) => ({ sifra: l.code, kolicina: l.quantity, jm: l.unit })) },
    reason: "Nabavka: fajl porudžbine",
  });
  const fileName = `${orderFileName(parsed.data.label, today)}.xlsx`;
  return { ok: true, fileName, base64: body.toString("base64"), count: lines.length, skipped: missing };
}

/**
 * Roba u dolasku (0064): ista porudžbina koja je upravo preuzeta kao fajl upisuje se kao porudžbina
 * dobavljaču, sa uobičajenim rokom tog brenda. Šifre su naše, pa je svaka stavka odmah povezana.
 */
export async function recordIncomingAction(input: unknown): Promise<{ ok: boolean; text: string }> {
  const user = await requireCapability("procurement:order_create", "/portal/nabavka");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, text: "Upišite bar jednu količinu veću od nule." };
  const lines = await resolveOrderLines(parsed.data.lines);
  const linked = lines.filter((l) => l.articleId);
  if (!linked.length) return { ok: false, text: "Nijedna šifra nije u šifarniku portala." };
  const supplier = SUPPLIERS.includes(parsed.data.label) ? parsed.data.label : "Ostalo";
  const lead = leadFor(supplier);
  try {
    const r = await createSupplierOrder(user, {
      supplier,
      reference: null,
      orderedOn: belgradeDate(new Date()),
      leadMin: lead.min,
      leadMax: lead.max,
      source: "nabavka",
      fileName: null,
      note: supplier === "Ostalo" ? `Nabavka: ${parsed.data.label}` : null,
      lines: linked.map((l) => ({ supplierCode: null, supplierName: l.name, quantity: l.quantity, unit: l.unit || null, articleId: l.articleId, remember: false })),
    });
    return { ok: true, text: `Upisano u Robu u dolasku: ${stavki(r.lines)}${lines.length > linked.length ? ` (${lines.length - linked.length} novih šifara bez veze nije upisano)` : ""}.` };
  } catch (error) {
    return { ok: false, text: error instanceof IncomingError ? error.message : "Upis u Robu u dolasku nije uspeo." };
  }
}
