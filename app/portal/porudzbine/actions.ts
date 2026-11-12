"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  changeLine,
  closeOrder,
  createSupplierOrder,
  IncomingError,
  MAX_ORDER_LINES,
  proposeLines,
  readOrderFile,
  searchArticles,
  type ProposedLine,
} from "@/lib/procurement/incoming-service";
import { parseOrderSheet, stavki, SUPPLIERS } from "@/lib/procurement/incoming.mjs";

const PATH = "/portal/porudzbine";
const fail = (error: unknown, fallback: string) => ({ ok: false as const, text: error instanceof IncomingError ? error.message : fallback });

const columnsSchema = z
  .object({
    code: z.number().int().min(0).max(200).optional(),
    name: z.number().int().min(0).max(200).optional(),
    qty: z.number().int().min(0).max(200).optional(),
    unit: z.number().int().min(0).max(200).optional(),
  })
  .strict();

export type PreviewResult =
  | { ok: true; lines: ProposedLine[]; skipped: number; columns: Record<string, number>; headerRow: number; grid: (string | number | null)[][] }
  | { ok: false; text: string; grid?: (string | number | null)[][]; needColumns?: boolean };

/** Pročita potvrdu i predloži naše artikle. Ništa ne upisuje. */
export async function previewOrderAction(formData: FormData): Promise<PreviewResult> {
  await requireCapability("procurement:order_create", PATH);
  const file = formData.get("fajl");
  const supplier = String(formData.get("dobavljac") ?? "");
  if (!SUPPLIERS.includes(supplier)) return { ok: false, text: "Izaberite dobavljača." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, text: "Izaberite fajl potvrde (Excel ili CSV)." };
  let grid: (string | number | null)[][];
  try {
    grid = readOrderFile(new Uint8Array(await file.arrayBuffer())).rows;
  } catch (error) {
    return fail(error, "Fajl nije čitljiv.");
  }
  const preview = grid.slice(0, 40).map((r) => r.slice(0, 15));
  let manual: { columns: z.infer<typeof columnsSchema>; headerRow: number } | undefined;
  const raw = formData.get("kolone");
  if (typeof raw === "string" && raw) {
    try {
      const v = JSON.parse(raw) as { columns: unknown; headerRow: unknown };
      const cols = columnsSchema.parse(v.columns);
      const headerRow = z.number().int().min(-1).max(200).parse(v.headerRow);
      manual = { columns: cols, headerRow };
    } catch {
      return { ok: false, text: "Izbor kolona nije ispravan.", grid: preview, needColumns: true };
    }
  }
  const parsed = parseOrderSheet(grid, manual);
  if (!parsed.ok) {
    const text =
      parsed.reason === "prazno"
        ? "U tabeli nije pronađena nijedna stavka sa količinom većom od nule."
        : "Kolone nisu prepoznate. Označite koja kolona je šifra, naziv i količina.";
    return { ok: false, text, grid: preview, needColumns: parsed.reason !== "prazno" };
  }
  if (parsed.lines.length > MAX_ORDER_LINES) return { ok: false, text: `Najviše ${MAX_ORDER_LINES} stavki po porudžbini.` };
  const lines = await proposeLines(supplier, parsed.lines);
  return { ok: true, lines, skipped: parsed.skipped, columns: parsed.columns, headerRow: parsed.headerRow, grid: preview };
}

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createSchema = z.object({
  supplier: z.string().refine((s) => SUPPLIERS.includes(s)),
  reference: z.string().trim().max(80).nullable(),
  orderedOn: iso,
  leadMin: z.number().int().min(0).max(365),
  leadMax: z.number().int().min(0).max(365),
  source: z.enum(["excel", "rucno", "nabavka"]),
  fileName: z.string().max(160).nullable(),
  note: z.string().trim().max(500).nullable(),
  lines: z
    .array(
      z.object({
        supplierCode: z.string().trim().max(60).nullable(),
        supplierName: z.string().max(200),
        quantity: z.number().positive().max(1_000_000),
        unit: z.string().max(12).nullable(),
        articleId: z.string().uuid().nullable(),
        remember: z.boolean(),
      }),
    )
    .min(1)
    .max(MAX_ORDER_LINES),
});

export async function createOrderAction(input: unknown): Promise<{ ok: true; text: string } | { ok: false; text: string }> {
  const user = await requireCapability("procurement:order_create", PATH);
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, text: "Proverite dobavljača, datum, rok i stavke (količina veća od nule)." };
  if (p.data.leadMax < p.data.leadMin) return { ok: false, text: "Rok „do“ ne može biti kraći od roka „od“." };
  try {
    const r = await createSupplierOrder(user, { ...p.data, reference: p.data.reference || null, note: p.data.note || null });
    revalidatePath(PATH);
    revalidatePath("/portal/nabavka");
    return { ok: true, text: `Upisano: ${stavki(r.lines)}${r.remembered ? `; zapamćene šifre dobavljača: ${r.remembered}` : ""}.` };
  } catch (error) {
    return fail(error, "Porudžbina nije upisana.");
  }
}

export async function searchArticlesAction(q: string) {
  await requireCapability("procurement:order_create", PATH);
  return searchArticles(String(q ?? "").slice(0, 60));
}

export async function changeLineAction(input: { lineId: string; action: "stiglo" | "otkazano" | "vrati" | "povezi"; articleId?: string | null }) {
  const user = await requireCapability("procurement:order_create", PATH);
  const p = z
    .object({ lineId: z.string().uuid(), action: z.enum(["stiglo", "otkazano", "vrati", "povezi"]), articleId: z.string().uuid().nullable().optional() })
    .safeParse(input);
  if (!p.success) return { ok: false as const, text: "Neispravan zahtev." };
  try {
    await changeLine(user, p.data);
    revalidatePath(PATH);
    revalidatePath("/portal/nabavka");
    return { ok: true as const, text: "Sačuvano." };
  } catch (error) {
    return fail(error, "Izmena nije sačuvana.");
  }
}

export async function closeOrderAction(input: { orderId: string; action: "otkazano" | "zatvoreno" }) {
  const user = await requireCapability("procurement:order_create", PATH);
  const p = z.object({ orderId: z.string().uuid(), action: z.enum(["otkazano", "zatvoreno"]) }).safeParse(input);
  if (!p.success) return { ok: false as const, text: "Neispravan zahtev." };
  try {
    await closeOrder(user, p.data);
    revalidatePath(PATH);
    revalidatePath("/portal/nabavka");
    return { ok: true as const, text: "Sačuvano." };
  } catch (error) {
    return fail(error, "Izmena nije sačuvana.");
  }
}
