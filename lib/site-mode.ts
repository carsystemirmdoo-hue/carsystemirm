import { isEnabled } from "@/lib/site-access";

/**
 * Javni sajt je otvoren (nije u režimu „sajt u pripremi“).
 *
 * Dok je u pripremi, svaka javna strana (katalog, proizvod, kontakt) preusmerava
 * na `/site-u-pripremi` sa obrascem za interni pristupni kod. Kupčev deo zato
 * ne sme da vodi tamo — veze se menjaju u izbor robe unutar naloga.
 */
export function publicSiteOpen(): boolean {
  return !isEnabled(process.env.MAINTENANCE_MODE);
}
