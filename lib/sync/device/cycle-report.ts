import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { syncDeviceCycles, syncDevices } from "@/db/schema";

/**
 * Izveštaj ciklusa iz heartbeat-a (konektor 0.3.9).
 *
 * Telo je opciono: konektor 0.3.8 šalje `{}` i to ostaje ispravno. Kada telo
 * nosi `ciklus`, polja se strogo proveravaju; nepoznata se odbacuju. Izveštaj
 * nikad ne dira dokumente, fakture ni red — samo beleži ciklus i stanje uređaja.
 */

/** ISO 8601 sa OBAVEZNIM pomakom zone (npr. `2026-10-07T15:02:00+02:00`). */
const isoSaZonom = z
  .string()
  .max(40)
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/)
  .refine((v) => !Number.isNaN(Date.parse(v)));

const brojac = z.number().int().min(0).max(10_000_000).optional();
const kod = z.string().max(64).regex(/^[a-z0-9_]+$/);

export const cycleReportSchema = z.object({
  ishod: z.enum(["obradjeno", "preskoceno", "greska"]),
  razlog: kod.optional(),
  skeniranjeZavrseno: z.boolean(),
  pocetak: isoSaZonom,
  pregledano: brojac,
  novo: brojac,
  poslato: brojac,
  potvrdjeno: brojac,
  zaPregled: brojac,
  preostalo: brojac,
  trajanjeMs: z.number().int().min(0).max(86_400_000).optional(),
  kodGreske: kod.optional(),
  verzija: z.string().max(32).regex(/^[0-9A-Za-z.+-]+$/).optional(),
  sledeciTermin: isoSaZonom.nullable().optional(),
});

export type CycleReport = z.infer<typeof cycleReportSchema>;

export type ParsedHeartbeat =
  | { kind: "empty" }
  | { kind: "cycle"; report: CycleReport }
  | { kind: "invalid"; code: "cycle_invalid" | "cycle_time_out_of_range" };

/** Dozvoljeno odstupanje sata uređaja: ciklus ne sme biti iz budućnosti ni star nedelju dana. */
const BUDUCNOST_MS = 10 * 60_000;
const PROSLOST_MS = 7 * 24 * 60 * 60_000;

export function parseHeartbeatBody(bodyBytes: Uint8Array, now = new Date()): ParsedHeartbeat {
  let telo: unknown;
  try {
    const tekst = new TextDecoder().decode(bodyBytes).trim();
    telo = tekst === "" ? {} : JSON.parse(tekst);
  } catch {
    return { kind: "invalid", code: "cycle_invalid" };
  }
  if (!telo || typeof telo !== "object" || Array.isArray(telo)) {
    return { kind: "invalid", code: "cycle_invalid" };
  }
  const ciklus = (telo as { ciklus?: unknown }).ciklus;
  if (ciklus === undefined) return { kind: "empty" };

  const parsed = cycleReportSchema.safeParse(ciklus);
  if (!parsed.success) return { kind: "invalid", code: "cycle_invalid" };
  if (parsed.data.skeniranjeZavrseno && parsed.data.ishod !== "obradjeno") {
    return { kind: "invalid", code: "cycle_invalid" };
  }
  const pocetak = Date.parse(parsed.data.pocetak);
  if (pocetak > now.getTime() + BUDUCNOST_MS || pocetak < now.getTime() - PROSLOST_MS) {
    return { kind: "invalid", code: "cycle_time_out_of_range" };
  }
  return { kind: "cycle", report: parsed.data };
}

/**
 * Upisuje ciklus i ažurira stanje uređaja — jedna transakcija.
 *
 * Ponovljen izveštaj istog ciklusa (isti uređaj, isti početak) ne pravi drugi
 * red. Polja uređaja se pomeraju samo unapred (`greatest`), pa zakasneli
 * izveštaj starijeg ciklusa ne vraća stanje unazad.
 */
export async function recordCycleReport(deviceId: string, report: CycleReport): Promise<"recorded" | "duplicate"> {
  const cycleAt = new Date(report.pocetak);
  const nextExpected = report.sledeciTermin ? new Date(report.sledeciTermin) : null;

  return getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(syncDeviceCycles)
      .values({
        deviceId,
        cycleAt,
        outcome: report.ishod,
        reason: report.razlog ?? null,
        scanCompleted: report.skeniranjeZavrseno,
        scanned: report.pregledano ?? null,
        newDocuments: report.novo ?? null,
        sent: report.poslato ?? null,
        confirmed: report.potvrdjeno ?? null,
        forReview: report.zaPregled ?? null,
        remaining: report.preostalo ?? null,
        durationMs: report.trajanjeMs ?? null,
        errorCode: report.kodGreske ?? null,
        connectorVersion: report.verzija ?? null,
        nextExpectedAt: nextExpected,
      })
      .onConflictDoNothing({ target: [syncDeviceCycles.deviceId, syncDeviceCycles.cycleAt] })
      .returning({ id: syncDeviceCycles.id });
    if (inserted.length === 0) return "duplicate";

    /*
     * Vremena idu kao ISO tekst sa izričitim `::timestamptz` — JS `Date` u
     * sirovom `sql` izrazu driver ne serijalizuje.
     */
    const ciklusTs = sql`${cycleAt.toISOString()}::timestamptz`;
    const sledeciTs = nextExpected ? sql`${nextExpected.toISOString()}::timestamptz` : sql`NULL::timestamptz`;
    const noviji = sql`(${syncDevices.lastCycleAt} IS NULL OR ${syncDevices.lastCycleAt} <= ${ciklusTs})`;
    await tx
      .update(syncDevices)
      .set({
        lastCycleAt: sql`CASE WHEN ${noviji} THEN ${ciklusTs} ELSE ${syncDevices.lastCycleAt} END`,
        lastCycleOutcome: sql`CASE WHEN ${noviji} THEN ${report.ishod}::sync_cycle_outcome ELSE ${syncDevices.lastCycleOutcome} END`,
        nextExpectedCycleAt: sql`CASE WHEN ${noviji} THEN ${sledeciTs} ELSE ${syncDevices.nextExpectedCycleAt} END`,
        lastScanCompletedAt: report.skeniranjeZavrseno
          ? sql`greatest(coalesce(${syncDevices.lastScanCompletedAt}, ${ciklusTs}), ${ciklusTs})`
          : sql`${syncDevices.lastScanCompletedAt}`,
      })
      .where(sql`${syncDevices.id} = ${deviceId}`);
    return "recorded";
  });
}
