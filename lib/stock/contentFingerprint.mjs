/**
 * Otisak SADRŽAJA lagera (0053, dok. 65 §1b): isti magacin, isti datum stanja i iste stavke sa
 * stanjem različitim od nule daju isti otisak, bez obzira na format (PDF ili XLSX/CSV).
 *
 * Nule se ne računaju jer PDF „Zbirni pregled“ ne navodi artikle bez prometa, a XLSX ih navodi
 * sa stanjem 0 — inače bi isti dan iz dva formata dao dva „različita“ snimka. Svaka razlika u
 * šifri (ključ bez vodećih nula) ili količini različitoj od nule daje drugi otisak; tada se
 * fajlovi NE spajaju.
 */
import { createHash } from "node:crypto";

/**
 * @param {{ warehouseCode: string | null, stockDate: string | null }} meta
 * @param {Array<{ codeKey: string | null, sourceCode: string, quantity: number | null }>} lines
 * @returns {string | null} heks SHA-256; `null` bez datuma ili magacina
 */
export function stockContentFingerprint(meta, lines) {
  if (!meta.warehouseCode || !meta.stockDate) return null;
  const parts = lines
    .filter((l) => l.quantity === null || Number(l.quantity) !== 0)
    .map((l) => `${l.codeKey ?? l.sourceCode}=${l.quantity === null ? "?" : Number(l.quantity).toFixed(3)}`)
    .sort();
  return createHash("sha256").update(`lager/1|${meta.warehouseCode}|${meta.stockDate}|${parts.join(";")}`).digest("hex");
}
