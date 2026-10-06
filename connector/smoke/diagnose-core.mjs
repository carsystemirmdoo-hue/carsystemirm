/**
 * Jezgro dijagnostike — bez `child_process`, bez diska, bez platforme.
 *
 * ZAŠTO ODVOJENO
 * ==============
 * Prva verzija je pala na Windowsu u `spawnSync`, PRE ijednog merenja, i pritom
 * ispisala stack trace sa `file:///C:/…` putanjom i korisničkim folderom. Dva
 * odvojena propusta:
 *
 *   1. dijagnostika koja ne preživi sopstveni pokretač ne daje nijedan podatak;
 *   2. dijagnostika koja pri padu ispiše putanju krši sopstveni ugovor.
 *
 * Oba su posledica istog: sve je bilo u jednom fajlu koji se izvršava odozgo
 * nadole, pa se ništa nije moglo testirati bez Windowsa. Ovde je logika, tamo
 * je samo pokretanje — a logika prima `mehanizme` kao parametar, pa se pad
 * može simulirati na bilo kojoj mašini.
 */

/** Stabilni kodovi ishoda; ulaze u izveštaj umesto poruka izuzetaka. */
export const KODOVI = Object.freeze({
  spawnPao: "diagnostic_powershell_spawn_failed",
  nemaMehanizma: "diagnostic_no_working_spawn",
  izmereno: "diagnostic_completed",
});

/* =========================================================================
 * Redakcija
 * ====================================================================== */

/**
 * Sve što ide u izveštaj ili na ekran prolazi ovuda.
 *
 * Redosled pravila nije proizvoljan: `file:///C:/…` se briše PRE opšteg pravila
 * za Windows putanju, jer ono gleda obrnutu kosu crtu i ovaj oblik bi mu
 * promakao. Upravo taj oblik je i procureo na ekran.
 */
const SUMNJIVO = [
  /*
   * `[/]{3}` umesto `\/\/\/` — inače `e:\` iz „file:\/" ispada kao apsolutna
   * Windows putanja i provera sadržaja paketa odbije pakovanje. Isti lažni
   * pogodak koji je već zabeležen za `PDV:\s*` u parseru.
   */
  /file:[/]{3}[^\s"')]+/gi,
  /[A-Za-z]:[\\/][^\s"')]+/g,
  /\\\\[^\s"')]+/g,
  /\/(?:Users|home)\/[^\s"')]+/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /[A-Za-z0-9+/]{40,}={0,2}/g,
  /-----BEGIN [^-]+-----/g,
  /\bat\s+[^\s(]+\s*\([^)]*\)/g,
];

/**
 * PowerShell tokeni — ako se ijedan pojavi u detalju, tu je procurila skripta.
 *
 * Skripta se u izveštaj ne upisuje ni namerno ni slučajno: poruka izuzetka je
 * na nekim platformama nosi doslovno.
 */
/*
 * `__PSLockdownPolicy` NIJE na ovom spisku.
 *
 * To je ime promenljive okruženja koje D07 namerno prijavljuje, ne deo programa.
 * Dok je bilo ovde, bezbedan detalj `__PSLockdownPolicy = 0` je u kancelarijskom
 * izveštaju postao `[skripta] = 0` — nečitljiv upravo tamo gde je trebalo da
 * objasni nalaz.
 */
const SKRIPTA = /\$ErrorActionPreference|Add-Type|ProtectedData|\[Console\]|\$PSVersionTable|Get-ExecutionPolicy|\$ExecutionContext|EncodedCommand|SystemPolicy\]::/g;

export function redigovan(tekst) {
  let t = String(tekst ?? "");
  for (const r of SUMNJIVO) t = t.replace(r, "[redigovano]");
  t = t.replace(SKRIPTA, "[skripta]");
  // Jedan red, ograničena dužina: izveštaj je za čoveka, ne za arhiviranje.
  return t.replace(/\s+/g, " ").trim().slice(0, 240);
}

/**
 * Kratak, bezbedan kod greške.
 *
 * Namerno se NE koristi `e.message`. Poruka `spawnSync` izuzetka nosi putanju
 * do izvršnog fajla, a poruke drugih grešaka umeju da nose i argumente. Kod
 * (`EINVAL`, `ENOENT`) je sve što je za dijagnozu potrebno, i strukturno ne
 * može da nosi podatak.
 */
export function bezbedanKod(e) {
  const sirovo = String(e?.code ?? e?.name ?? "unknown");
  const ocisceno = sirovo.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
  return ocisceno || "unknown";
}

/* =========================================================================
 * Merenje
 * ====================================================================== */

/** Trivijalna skripta: jedan red, čist ASCII, bez navodnika i bez cevi. */
export const PROBA_SKRIPTA = "'CS-OK'";
export const PROBA_OCEKIVANO = "CS-OK";
/**
 * Ulaz za proveru stdin kanala; nikad ključ, nikad poslovni podatak.
 *
 * Base64, jer produkcijski DPAPI kanal prima ISKLJUČIVO jedan red base64 — proba
 * koja bi ovde poslala drugi oblik merila bi drugačiji kanal od stvarnog.
 */
export const STDIN_PROBA = Buffer.from("cs-stdin-proba").toString("base64");

/** Program za D06: čita tačno jedan red sa stdin-a i vraća ga. */
export const STDIN_PROGRAM =
  "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; " +
  "[Console]::In.ReadLine()";

/**
 * Pokreće dijagnostiku nad datim mehanizmima pokretanja PowerShell-a.
 *
 * `mehanizmi` je uređena lista `{ id, opis, pokreni(skripta, ulaz) }`. Svaki
 * `pokreni` sme da baci — to je merenje, ne kvar.
 *
 * Zašto VIŠE mehanizama
 * ---------------------
 * Stvarni DPAPI adapter koristi asinhroni `spawn` sa ručnim upisom u `stdin`.
 * Dijagnostika je koristila `spawnSync` sa `input` opcijom — isti fajl, isti
 * argumenti, drugi API — i pala je sa `EINVAL` pre ijednog merenja. Koja od
 * razlika to izaziva ne može se dokazati bez Windowsa, pa se sada MERE sve:
 * sledeći prolaz vraća odgovor umesto pretpostavke.
 *
 * @returns {Promise<{nalazi: object[], zakljucak: string, kod: string, radniMehanizam: string|null}>}
 */
export async function izmeri({ mehanizmi, kanalAdaptera = null, log = () => {} }) {
  const nalazi = [];
  const dodaj = (id, pitanje, ishod, detalj) => {
    const n = { id, pitanje, ishod, detalj: redigovan(detalj) };
    nalazi.push(n);
    log(`${ishod.padEnd(10)} ${id}  ${pitanje}${n.detalj ? " :: " + n.detalj : ""}`);
    return n;
  };

  /* --- M: koji mehanizam uopšte može da pokrene PowerShell. ------------- */
  let radni = null;
  for (const m of mehanizmi) {
    let r;
    try {
      r = await m.pokreni(PROBA_SKRIPTA);
    } catch (e) {
      /*
       * Izuzetak pokretača je NALAZ, ne kraj.
       *
       * Ovo je tačno mesto na kome je prva verzija umrla. Sada se zapisuje kod
       * i prelazi na sledeći mehanizam.
       */
      dodaj("M-" + m.id, m.opis, "PAD", `pokretanje odbijeno: ${bezbedanKod(e)}`);
      continue;
    }
    if (r.kod !== 0) {
      dodaj("M-" + m.id, m.opis, "PAD", `izlaz ${r.kod}`);
      continue;
    }
    if (String(r.stdout ?? "").trim() !== PROBA_OCEKIVANO) {
      dodaj("M-" + m.id, m.opis, "PAD", "izlaz nije očekivan");
      continue;
    }
    dodaj("M-" + m.id, m.opis, "OK", "PowerShell se pokreće ovim putem");
    if (!radni) radni = m;
  }

  if (!radni) {
    return {
      nalazi,
      radniMehanizam: null,
      kod: KODOVI.nemaMehanizma,
      zakljucak:
        "Nijedan način pokretanja PowerShell-a nije uspeo. Merenja DPAPI okruženja " +
        "nisu izvršena — uzrok je u pokretanju, ne u DPAPI-ju.",
    };
  }

  const ps = (skripta, ulaz) => radni.pokreni(skripta, ulaz);
  const meri = async (id, pitanje, fn) => {
    try {
      const r = await fn();
      dodaj(id, pitanje, r.ishod, r.detalj);
    } catch (e) {
      dodaj(id, pitanje, "PAD", `provera nije izvršena: ${bezbedanKod(e)}`);
    }
  };

  await meri("D01", "powershell.exe je dostupan", async () => {
    const r = await ps("$PSVersionTable.PSVersion.ToString()");
    if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}` };
    return { ishod: "OK", detalj: `PowerShell ${r.stdout}` };
  });

  await meri("D02", "jezički režim (Constrained Language blokira Add-Type)", async () => {
    const r = await ps("$ExecutionContext.SessionState.LanguageMode.ToString()");
    if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}` };
    const rezim = String(r.stdout ?? "").trim();
    /*
     * `ConstrainedLanguage` je najverovatniji tihi uzrok pada DPAPI-ja: u njemu
     * `Add-Type` i pozivi .NET tipova ne rade, a adapter oba koristi.
     */
    return rezim === "FullLanguage"
      ? { ishod: "OK", detalj: "FullLanguage" }
      : { ishod: "PAŽNJA", detalj: `${rezim} — .NET pozivi su ograničeni, a adapter ih traži` };
  });

  await meri("D03", "efektivna politika izvršavanja po opsezima", async () => {
    const r = await ps("(Get-ExecutionPolicy -List | Out-String)");
    if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}` };
    const redovi = String(r.stdout ?? "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => /^(MachinePolicy|UserPolicy|Process|CurrentUser|LocalMachine)\s+\S+/.test(x))
      .map((x) => x.replace(/\s+/g, "="));
    /*
     * Politika postavljena kroz Group Policy NE MOŽE se pregaziti sa
     * `-ExecutionPolicy Bypass`. To pogađa `-File` pozive (`task.ps1`, W13),
     * ali ne i DPAPI, koji skriptu šalje na `stdin`.
     */
    const gp = redovi.filter((x) => /^(MachinePolicy|UserPolicy)=/.test(x) && !/=Undefined$/.test(x));
    return {
      ishod: gp.length > 0 ? "PAŽNJA" : "OK",
      detalj: redovi.join(" ") + (gp.length > 0 ? " — postavljeno Group Policy-jem" : ""),
    };
  });

  await meri("D04", "Add-Type System.Security radi", async () => {
    const r = await ps("$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; 'OK'");
    if (r.kod !== 0 || String(r.stdout ?? "").trim() !== "OK") {
      return { ishod: "PAD", detalj: `izlaz ${r.kod}` };
    }
    return { ishod: "OK", detalj: "sklop učitan" };
  });

  await meri("D05", "ProtectedData Protect/Unprotect nad konstantom", async () => {
    /*
     * 16 bajtova konstante, nikad ključ.
     *
     * Ovo je tačno ono što `windows-dpapi.mjs::proveri()` radi. Ako ovde padne,
     * pad `W05`/`W06` je objašnjen i nije u konektoru.
     */
    const skripta = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Security",
      "$b = [Text.Encoding]::ASCII.GetBytes('cs-dpapi-proba1')",
      "$p = [System.Security.Cryptography.ProtectedData]::Protect($b, $null, 'CurrentUser')",
      "$u = [System.Security.Cryptography.ProtectedData]::Unprotect($p, $null, 'CurrentUser')",
      "if ([Text.Encoding]::ASCII.GetString($u) -eq 'cs-dpapi-proba1') { 'OK' } else { 'NEJEDNAKO' }",
    ].join("; ");
    const r = await ps(skripta);
    if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}` };
    const izlaz = String(r.stdout ?? "").trim();
    if (izlaz !== "OK") return { ishod: "PAD", detalj: `rezultat: ${izlaz}` };
    return { ishod: "OK", detalj: "šifrovanje i dešifrovanje vraćaju isti sadržaj" };
  });

  await meri("D06", "stdin kanal — PRODUKCIJSKI kanal DPAPI adaptera", async () => {
    /*
     * D06 NE koristi mehanizme iznad nego `pokreniPowerShell` iz samog adaptera:
     * isti argumenti, isti `-EncodedCommand`, isti stdin, ista ograničenja.
     *
     * Ranija verzija je ovde merila `-Command -` kopiju — i pala tačno kao
     * adapter, jer je i adapter tada slao program i podatak kroz isti stdin.
     * Sada meri ono što se isporučuje, a ne njegovu kopiju.
     */
    if (!kanalAdaptera) {
      return { ishod: "PAD", detalj: "produkcijski kanal adaptera nije učitan" };
    }
    let izlaz;
    try {
      izlaz = await kanalAdaptera.pokreni(STDIN_PROGRAM, STDIN_PROBA);
    } catch (e) {
      return { ishod: "PAD", detalj: `kanal adaptera: ${bezbedanKod(e)}` };
    }
    return String(izlaz ?? "").trim() === STDIN_PROBA
      ? { ishod: "OK", detalj: "program kroz -EncodedCommand, podatak kroz stdin — pročitan tačno" }
      : { ishod: "PAD", detalj: "podatak sa stdin-a nije vraćen neizmenjen" };
  });

  await meri("D07", "AppLocker/WDAC sprovođenje (SystemPolicy + __PSLockdownPolicy)", async () => {
    /*
     * Merodavan je STVARAN režim sprovođenja, ne postojanje promenljive.
     *
     * `[SystemPolicy]::GetSystemLockdownPolicy()` vraća ono što PowerShell sam
     * primenjuje: `None`, `Audit` ili `Enforce`. `__PSLockdownPolicy` se prijavljuje
     * uz to, kao vrednost — ranija provera je `if ($env:__PSLockdownPolicy)`
     * tumačila kao „aktivno", a u PowerShell-u je neprazan string `"0"` istinit.
     */
    const r = await ps(
      "$ProgressPreference = 'SilentlyContinue'; " +
        "$m = try { [System.Management.Automation.Security.SystemPolicy]::GetSystemLockdownPolicy().ToString() } catch { 'nepoznato' }; " +
        "$v = if ($null -eq $env:__PSLockdownPolicy) { 'nije_postavljeno' } else { [string]$env:__PSLockdownPolicy }; " +
        "'{0}|{1}' -f $m, $v",
    );
    if (r.kod !== 0) return { ishod: "PAD", detalj: `izlaz ${r.kod}` };
    const [rezim = "", vrednost = ""] = String(r.stdout ?? "").trim().split("|");
    return oceniLockdown({ rezim: rezim.trim(), vrednost: vrednost.trim() });
  });

  await meri("D08", "DPAPI adapter proveri() — Protect/Unprotect kroz produkcijski kanal", async () => {
    /*
     * Isto što `doctor` radi: konstanta ide kroz stdin u Protect, rezultat kroz
     * stdin u Unprotect. Nijedan ključ se ne pravi i ne čita.
     */
    if (!kanalAdaptera?.proveri) {
      return { ishod: "PAD", detalj: "produkcijski kanal adaptera nije učitan" };
    }
    try {
      await kanalAdaptera.proveri();
    } catch (e) {
      return { ishod: "PAD", detalj: `adapter: ${bezbedanKod(e)}` };
    }
    return { ishod: "OK", detalj: "adapter šifruje i dešifruje kroz stdin" };
  });

  return { nalazi, radniMehanizam: radni.id, kod: KODOVI.izmereno, zakljucak: zakljuci(nalazi) };
}

/**
 * Tumačenje lockdown stanja — čista funkcija, testabilna bez Windowsa.
 *
 * Presuđuje `rezim` (ono što PowerShell stvarno sprovodi). `vrednost`
 * promenljive `__PSLockdownPolicy` se samo prijavljuje: `0` i odsustvo ne
 * uključuju sprovođenje, i nijedna vrednost sama po sebi nije dokaz da je
 * AppLocker/WDAC aktivan.
 */
export function oceniLockdown({ rezim, vrednost }) {
  const promenljiva =
    vrednost === "" || vrednost === "nije_postavljeno"
      ? "__PSLockdownPolicy nije postavljena"
      : `__PSLockdownPolicy = ${vrednost}`;

  if (rezim === "None") {
    return { ishod: "OK", detalj: `sprovođenje: None; ${promenljiva}` };
  }
  if (rezim === "Enforce" || rezim === "Audit") {
    return {
      ishod: "PAŽNJA",
      detalj: `sprovođenje: ${rezim} (AppLocker/WDAC); ${promenljiva}`,
    };
  }
  /*
   * Kada se režim ne može očitati, NE zaključuje se iz promenljive. Vrednost
   * `0` tada i dalje znači „nije uključeno" — sve ostalo ostaje nepoznato.
   */
  if (vrednost === "0" || vrednost === "" || vrednost === "nije_postavljeno") {
    return { ishod: "OK", detalj: `režim nije očitan; ${promenljiva} (ne uključuje sprovođenje)` };
  }
  return { ishod: "PAŽNJA", detalj: `režim nije očitan; ${promenljiva} — proveriti ručno` };
}

/** Jedna rečenica koja kaže gde dalje gledati. */
function zakljuci(nalazi) {
  const po = (id) => nalazi.find((n) => n.id === id);
  if (po("D02")?.ishod === "PAŽNJA" || po("D04")?.ishod === "PAD") {
    return (
      "Jezički režim ili blokiran Add-Type sprečavaju DPAPI adapter. " +
      "To objašnjava pad W05/W06 i nije kvar konektora."
    );
  }
  if (po("D05")?.ishod === "PAD") {
    return "DPAPI Protect/Unprotect ne radi za ovaj nalog; W05/W06 su posledica.";
  }
  if (po("D06")?.ishod === "PAD" || po("D08")?.ishod === "PAD") {
    return "Produkcijski kanal DPAPI adaptera ne radi; W05/W06 su njegova posledica.";
  }
  if (po("D03")?.ishod === "PAŽNJA") {
    return (
      "Politika izvršavanja je postavljena Group Policy-jem: pogađa -File pozive (W13), " +
      "ali ne i DPAPI, koji program šalje kroz -EncodedCommand, a ne iz .ps1 fajla."
    );
  }
  return nalazi.every((n) => n.ishod === "OK")
    ? "PowerShell okruženje je ispravno; uzrok pada je negde drugde."
    : "Vidi nalaze označene sa PAŽNJA.";
}

/* =========================================================================
 * Izveštaj
 * ====================================================================== */

/**
 * Redigovan izveštaj — nastaje UVEK, i kada nijedno merenje nije uspelo.
 *
 * Prazan izveštaj sa imenovanim kodom vredi mnogo više od odsustva izveštaja:
 * odsustvo se čita kao „nismo stigli", a kod kaže dokle se stiglo.
 */
export function sastaviIzvestaj({ meta, okolina, nalazi, zakljucak, kod, radniMehanizam }) {
  return [
    `# Dijagnostika PowerShell/DPAPI okruženja (${redigovan(meta.shortHead)})`,
    "",
    "**OFFLINE — ništa nije promenjeno na računaru.**",
    "",
    `Ishod: \`${kod}\``,
    "",
    "| | |",
    "|---|---|",
    `| Windows | ${redigovan(okolina.os)} (build ${redigovan(okolina.build)}) |`,
    `| Arhitektura | ${redigovan(okolina.arch)} |`,
    `| Node | ${redigovan(okolina.node)} |`,
    `| Izvorni HEAD | ${redigovan(meta.sourceHead)} |`,
    `| Radni mehanizam pokretanja | ${radniMehanizam ? redigovan(radniMehanizam) : "nijedan"} |`,
    "",
    "## Nalazi",
    "",
    "| ID | Pitanje | Ishod | Detalj |",
    "|---|---|---|---|",
    ...nalazi.map((n) => `| ${n.id} | ${n.pitanje} | ${n.ishod} | ${n.detalj || "—"} |`),
    "",
    "## Zaključak",
    "",
    zakljucak,
    "",
    "## Šta ovaj alat NIJE radio",
    "",
    "- nije menjao politiku izvršavanja, ACL, registry ni bilo koje podešavanje;",
    "- nije pravio ni čitao uređajni ključ — DPAPI proba ide nad konstantom;",
    "- nije dodirnuo BizniSoft folder, nijedan PDF i nijednu mrežnu adresu;",
    "- nije ispisao korisničko ime, ime računara, putanje, ključeve ni potpise.",
    "",
    "Ovaj fajl je bezbedan za slanje.",
    "",
  ].join("\n");
}
