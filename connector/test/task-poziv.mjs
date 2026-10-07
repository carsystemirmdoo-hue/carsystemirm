/**
 * Ocena jednog poziva PowerShell skripte iz smoke-a — čista funkcija.
 *
 * Zašto postoji
 * -------------
 * Kancelarijski smoke d5e03d1 je dao PASS, a Avast je u istom prolazu
 * prijavio blokadu `task.ps1` (IDP.HELU.PSD11). Izveštaj nije imao ni vreme ni
 * izlazni kod poziva, pa se prijava nije mogla povezati ni sa jednim pozivom.
 * Uz to, test koji OČEKUJE odbijanje prolazi i kada proces prekine neko drugi.
 *
 * Sada svaki poziv nosi vreme početka i kraja, trajanje i izlazni kod, i
 * prolazi SAMO ako je i kod tačno očekivani i u izlazu postoji oznaka koju
 * piše sama skripta. Sve ostalo je imenovan ishod, ne „prošlo“.
 *
 * Bez putanja i poruka u detalju: samo kodovi, vreme i PowerShell identifikator.
 */

/** Windows odbija .ps1 zbog politike izvršavanja (stanje mašine, ne paketa). */
export const POLITIKA_BLOKIRA =
  /UnauthorizedAccess|cannot be loaded because running scripts is disabled|execution of scripts is disabled|PSSecurityException|not digitally signed/i;

/** AMSI/antivirus je odbio sadržaj skripte. */
export const ANTIVIRUS_BLOKIRA = /ScriptContainedMaliciousContent|malicious content|blocked by your antivirus/i;

/** Lokalno vreme HH:mm:ss — za poređenje sa istorijom detekcija antivirusa. */
export function satnica(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * @param {{kod: number|null, signal?: string|null, stdout?: string, stderr?: string,
 *          ocekivanKod: number, oznaka: RegExp, pocetak: Date, kraj: Date}} p
 * @returns {{ishod: "ok"|"politika"|"antivirus"|"prekinuto"|"pogresan_kod"|"bez_oznake",
 *            kod: string, detalj: string}}
 */
export function oceniPozivSkripte({ kod, signal = null, stdout = "", stderr = "", ocekivanKod, oznaka, pocetak, kraj }) {
  const tekst = `${stdout}${stderr}`;
  const vreme = `${satnica(pocetak)}–${satnica(kraj)} (${Math.max(0, kraj - pocetak)} ms), izlaz ${kod ?? `signal ${signal ?? "?"}`}`;
  const id = /FullyQualifiedErrorId\s*:\s*([A-Za-z0-9_.,-]+)/.exec(tekst)?.[1];
  const sazetak = id ? `; id=${id}` : "";

  if (ANTIVIRUS_BLOKIRA.test(tekst)) {
    return { ishod: "antivirus", kod: "task_script_blocked_by_antivirus", detalj: `${vreme}${sazetak}` };
  }
  if (kod !== 0 && POLITIKA_BLOKIRA.test(tekst)) {
    return { ishod: "politika", kod: "task_script_blocked_by_policy", detalj: `${vreme}${sazetak}` };
  }
  /*
   * `null` kod = proces je ubijen ili je isteklo vreme. Prazan izlaz (bez
   * oznake i bez PowerShell greške) takođe znači da skripta nije stigla da
   * radi — potpis spoljnog prekida, ne odbijanja, čak i kada je izlaz baš
   * onaj koji test očekuje.
   */
  if (kod === null || (!oznaka.test(tekst) && !id && tekst.trim() === "")) {
    return { ishod: "prekinuto", kod: "task_script_blocked_or_killed", detalj: `${vreme}${sazetak}` };
  }
  if (kod !== ocekivanKod) {
    return { ishod: "pogresan_kod", kod: "task_script_wrong_exit", detalj: `${vreme}, očekivano ${ocekivanKod}${sazetak}` };
  }
  if (!oznaka.test(tekst)) {
    return { ishod: "bez_oznake", kod: "task_script_marker_missing", detalj: `${vreme}${sazetak}` };
  }
  return { ishod: "ok", kod: "ok", detalj: vreme };
}
