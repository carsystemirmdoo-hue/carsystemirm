import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { systemSettings } from "@/db/schema";

/**
 * Poreklo skupa podataka u ovoj bazi.
 *
 * `demo` upisuje ISKLJUČIVO skripta za lokalni demo (izmišljene firme i
 * kupovine), pod ključem `dataset.kind`. Bez tog reda baza se smatra radnom:
 * podaci potiču iz BizniSoft uvoza (PDF, konektor) i prikazuju se bez oznake.
 *
 * Namerno u bazi, a ne u promenljivoj okruženja: oznaka putuje sa podacima.
 * Ista aplikacija nad demo bazom mora reći „demo", i nad radnom bazom ne sme.
 */
export const DATASET_KEY = "dataset.kind";

export type DatasetInfo =
  | { kind: "live" }
  | { kind: "demo"; label: string; asOf: string | null };

export async function loadDatasetInfo(): Promise<DatasetInfo> {
  try {
    const [row] = await getDb()
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, DATASET_KEY))
      .limit(1);
    const value = row?.value as { kind?: unknown; label?: unknown; asOf?: unknown } | undefined;
    if (value?.kind === "demo") {
      return {
        kind: "demo",
        label: typeof value.label === "string" ? value.label : "Izmišljeni demo podaci",
        asOf: typeof value.asOf === "string" ? value.asOf : null,
      };
    }
  } catch {
    // Bez baze nema ni podataka koje bi trebalo označiti.
  }
  return { kind: "live" };
}
