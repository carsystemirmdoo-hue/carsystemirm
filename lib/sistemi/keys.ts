import type { SourceRef } from "@/lib/sistemi/types";

/** Ključ izvora u mapi razrešenih izvora: „dokument@strana“. */
export function sourceKey(ref: SourceRef): string {
  return `${ref.doc}@${ref.strana}`;
}
