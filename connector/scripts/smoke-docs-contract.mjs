/**
 * Ugovor između smoke runnera i papira koji ide uz njega.
 *
 * ZAŠTO POSTOJI
 * =============
 * Predat je paket `2ffb15b` uz `START-HERE.md` koji je i dalje tvrdio `90374b1`
 * i tražio rezultat pod imenom koje runner nikada ne napiše. Uputstvo je
 * zastarelo tiho: nijedan test ga nije čitao, a `MANIFEST.md` proverava samo da
 * su fajlovi neizmenjeni — ne i da im je sadržaj i dalje tačan.
 *
 * Isti dan je runbook tražio „SMOKE PASS, 10/10" nad runnerom koji ima šesnaest
 * provera, i nalagao `Remove-Item` nad STVARNOM fakturom kao dokaz da je folder
 * read-only.
 *
 * Zato ove provere obaraju PAKOVANJE, ne izveštavaju posle njega: paket koji
 * nosi netačno uputstvo ne sme ni da nastane.
 *
 * ČISTE FUNKCIJE
 * ==============
 * Nijedna ne dodiruje disk. Ulaz je tekst, izlaz je spisak nalaza. Zbog toga se
 * ceo ugovor testira bez pakovanja, a pakovanje ga poziva nad stvarnim fajlovima.
 */

/**
 * Git SHA u tekstu — najmanje 7 heksadecimalnih znakova, uz bar jednu cifru.
 *
 * Zahtev za cifrom nije stil nego nužnost: `\b[0-9a-f]{7,}\b` pogađa i obične
 * reči („defaced", „accede" + slovo), pa bi provera padala nad ispravnim
 * uputstvom. Nijedan stvaran commit hash nema sva slova.
 */
const SHA_U_TEKSTU = /\b(?=[0-9a-f]{7,40}\b)(?=[a-f]*\d)[0-9a-f]{7,40}\b/g;

/** SHA-256 u punoj dužini. */
const SHA256 = /\b[0-9a-f]{64}\b/g;

/**
 * PowerShell cmdlet-i koji MENJAJU fajl.
 *
 * Spisak je namerno kratak i doslovan. Šira heuristika („sve što liči na
 * pisanje") bi propuštala ono što niko nije imenovao, a upravo je imenovanje
 * jedina razlika koja se broji u uputstvu koje izlazi iz firme.
 */
const RAZORNI_CMDLETI = [
  "Add-Content",
  "Set-Content",
  "Rename-Item",
  "Remove-Item",
  "Clear-Content",
  "Move-Item",
];

/** Jedini fajl nad kojim se sme pokušati izmena. Namenski, potrošan, prazan. */
export const SENTINEL = "carsystem-permission-probe.txt";

/** Rečenica koja mora stajati u handoff-u, doslovno. */
export const HANDOFF_ZAGLAVLJE = "OFFLINE SMOKE ONLY — NO REAL INVOICES";

/* =========================================================================
 * Izvori istine
 * ====================================================================== */

/**
 * ID-jevi provera koje runner STVARNO izvršava, po redosledu u izvoru.
 *
 * Čita se iz koda, ne iz komentara: komentar je tvrdnja, `provera("W05", …)` je
 * ono što se izvrši.
 *
 * @param {string} runSmokeIzvor sadržaj `connector/smoke/run-smoke.mjs`
 * @returns {string[]}
 */
export function runnerProvere(runSmokeIzvor) {
  return [...runSmokeIzvor.matchAll(/^provera\("([^"]+)"/gm)].map((m) => m[1]);
}

/**
 * ID-jevi provera nabrojani u dokumentu.
 *
 * Traži se TABELA u kojoj je prva kolona ID u polunavodnicima — dakle
 * `| \`W01\` | …`. Slobodan pomen `W03` u rečenici se namerno ne broji: rečenica
 * objašnjava, tabela nabraja, i samo se tabela poredi sa runnerom.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function dokumentovaneProvere(markdown) {
  return [...markdown.matchAll(/^\|\s*`(W[0-9]{2}(?:-[a-z]+)?)`\s*\|/gm)].map((m) => m[1]);
}

/**
 * Svaki ID koji dokument uopšte pominje — i u tabeli i u rečenici.
 *
 * Koristi se za slabiju proveru „ne pominji ono što ne postoji".
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function pomenutiIdevi(markdown) {
  return [...new Set([...markdown.matchAll(/`(W[0-9]{2}(?:-[a-z]+)?)`/g)].map((m) => m[1]))];
}

/* =========================================================================
 * Provere
 * ====================================================================== */

/**
 * Linije u kojima razoran cmdlet stoji nad nečim što nije sentinel.
 *
 * Gleda se LINIJA, ne ceo dokument: `Remove-Item` u rečenici koja objašnjava
 * zašto se to NE radi mora da prođe, a `Remove-Item "…\\faktura.pdf"` ne sme.
 * Zato uz cmdlet mora stajati sentinel u istoj liniji — sve drugo je nalaz.
 *
 * @param {string} tekst
 * @returns {string[]}
 */
export function razorneNaredbe(tekst) {
  const nalazi = [];
  const linije = tekst.split(/\r?\n/);
  for (let i = 0; i < linije.length; i += 1) {
    const red = linije[i];
    for (const cmdlet of RAZORNI_CMDLETI) {
      if (!red.includes(cmdlet)) continue;
      if (red.includes(SENTINEL)) continue;
      nalazi.push(`red ${i + 1}: \`${cmdlet}\` bez sentinela — ${red.trim().slice(0, 90)}`);
    }
  }
  return nalazi;
}

/**
 * `START-HERE.md` — uputstvo koje putuje UNUTAR paketa.
 *
 * Zato ne sme da nosi nijedan hash: paket se pakuje ponovo, a fajl u njemu bi
 * ostao isti i tvrdio staru verziju. Verzija se čita iz `smoke/package-meta.json`,
 * koji pakovanje generiše svaki put.
 *
 * @param {{tekst: string, runnerIdevi: string[]}} ulaz
 * @returns {string[]}
 */
export function proveriStartHere({ tekst, runnerIdevi }) {
  const nalazi = [];

  const hashevi = [...new Set(tekst.match(SHA_U_TEKSTU) ?? [])];
  if (hashevi.length > 0) {
    nalazi.push(
      `nosi hardkodovan git hash (${hashevi.join(", ")}) — verzija se čita iz smoke/package-meta.json`,
    );
  }

  if (/biznisoft-sync-operations/.test(tekst)) {
    nalazi.push("pominje zastarelu granu `feature/biznisoft-sync-operations`");
  }

  /*
   * Ime rezultata mora biti PLACEHOLDER, ne konkretan hash.
   *
   * Runner ga sklapa iz `META.shortHead`; svaki upisan hash je obećanje imena
   * fajla koji sledeće pakovanje neće napraviti.
   */
  const konkretno = tekst.match(/windows-smoke-result-(?!<)[^.\s`]+\.(?:md|json)/g);
  if (konkretno) {
    nalazi.push(`ime rezultata je hardkodovano: ${[...new Set(konkretno)].join(", ")}`);
  }
  if (!tekst.includes("windows-smoke-result-<shortHead>.md")) {
    nalazi.push("ne objašnjava obrazac `windows-smoke-result-<shortHead>.md`");
  }
  if (!tekst.includes("smoke/package-meta.json") && !tekst.includes("smoke\\package-meta.json")) {
    nalazi.push("ne upućuje na `smoke/package-meta.json` kao izvor verzije");
  }

  for (const id of pomenutiIdevi(tekst)) {
    if (!runnerIdevi.includes(id)) nalazi.push(`pominje proveru \`${id}\` koju runner nema`);
  }

  nalazi.push(...rucneProvere(tekst));
  nalazi.push(...razorneNaredbe(tekst));
  return nalazi;
}

/**
 * Ručne provere moraju biti imenovane kao neizvršene, a preskok `[WIN]` testa
 * ne sme biti predstavljen kao očekivan.
 *
 * Kancelarijski smoke 45a3460: dokumenti su tvrdili „tačno jedan preskočen
 * `[WIN]` test je očekivan", a paket je nosio dva bezuslovna preskoka — pa
 * `SMOKE PASS` nije bio dostižan. Ručne provere su sada izvan `[WIN]` skupa.
 *
 * @param {string} tekst
 * @returns {string[]}
 */
export function rucneProvere(tekst) {
  const nalazi = [];
  if (/(?:jedan|jednog|1)\s+preskočen\w*\s+`?\[WIN\]/i.test(tekst) || /prihvata tačno jedan preskočen/i.test(tekst)) {
    nalazi.push("predstavlja preskočen `[WIN]` test kao očekivan; ručne provere su MANUAL_NOT_EXECUTED");
  }
  if (!tekst.includes("MANUAL_NOT_EXECUTED")) {
    nalazi.push("ne kaže da se ručne provere prijavljuju kao `MANUAL_NOT_EXECUTED`");
  }
  for (const id of ["RUCNO-DPAPI-NALOG", "RUCNO-TASK-APPLY"]) {
    if (!tekst.includes(id)) nalazi.push(`ne imenuje ručnu proveru \`${id}\``);
  }
  return nalazi;
}

/**
 * Kancelarijski runbook — dokument koji ostaje u repozitorijumu.
 *
 * @param {{tekst: string, runnerIdevi: string[]}} ulaz
 * @returns {string[]}
 */
export function proveriRunbook({ tekst, runnerIdevi }) {
  const nalazi = [];

  /*
   * „10/10" je bio pogrešan kriterijum: runner ima šesnaest provera, a
   * broj `[WIN]` testova se menja. Jedini ispravan kriterijum je ispis
   * `SMOKE PASS`.
   */
  if (/\b10\s*\/\s*10\b/.test(tekst)) {
    nalazi.push("traži `10/10` — jedini kriterijum je ispis SMOKE PASS");
  }
  if (/Svih\s+10\s+Windows/i.test(tekst) || /\b10\s+(?:Windows\s+)?smoke\s+testova\b/i.test(tekst)) {
    nalazi.push("tvrdi da smoke ima 10 testova; runner ima 16 provera");
  }
  if (!tekst.includes("SMOKE PASS")) {
    nalazi.push("ne imenuje `SMOKE PASS` kao jedini kriterijum uspeha");
  }
  nalazi.push(...rucneProvere(tekst));
  if (!tekst.includes("SMOKE INCOMPLETE")) {
    nalazi.push("ne kaže da `SMOKE INCOMPLETE` nije prolaz");
  }

  /*
   * Runbook NE sme da nosi SHA-256 paketa.
   *
   * Hash se menja pri svakom pakovanju; upisan u dokument koji se ne pakuje
   * zajedno sa paketom, on je obećanje koje zastareva istog dana. Nosi ga
   * handoff, koji nastaje uz sam ZIP.
   */
  const sume = [...new Set(tekst.match(SHA256) ?? [])];
  if (sume.length > 0) {
    nalazi.push(`nosi SHA-256 (${sume[0].slice(0, 12)}…) koji zastareva — hash pripada handoff-u`);
  }

  if (!tekst.includes("WINDOWS-HANDOFF")) {
    nalazi.push("ne upućuje na `WINDOWS-HANDOFF-<shortHead>.md` za ime i hash paketa");
  }

  /*
   * Uputstvo ne sme da traži ponovno pakovanje NA WINDOWSU.
   *
   * Paket nastaje na mašini koja pakuje, iz čistog HEAD-a; kancelarija ga
   * verifikuje, ne pravi. `connector:smoke:package` u kancelarijskom koraku bi
   * značio da se meri nešto što niko nije video.
   */
  if (/connector:smoke:package/.test(tekst)) {
    nalazi.push("nalaže ponovno pakovanje; kancelarija verifikuje isporučen ZIP");
  }

  const dokumentovani = dokumentovaneProvere(tekst);
  if (dokumentovani.length === 0) {
    nalazi.push("nema tabelu provera runnera");
  } else if (dokumentovani.join(",") !== runnerIdevi.join(",")) {
    nalazi.push(
      `spisak provera odstupa od runnera:\n      runner: ${runnerIdevi.join(", ")}` +
        `\n      runbook: ${dokumentovani.join(", ")}`,
    );
  }

  if (!tekst.includes(SENTINEL)) {
    nalazi.push(`ne imenuje sentinel \`${SENTINEL}\` za proveru ACL-a`);
  }

  nalazi.push(...razorneNaredbe(tekst));
  return nalazi;
}

/**
 * Handoff koji stoji PORED ZIP-a.
 *
 * Postoji zato što ZIP ne može da sadrži sopstveni konačni hash: hash nastaje
 * tek kada je arhiva zatvorena. Zbog toga se ime i otisak paketa isporučuju
 * odvojenim fajlom, i zbog toga se oni ovde porede sa STVARNIM vrednostima, ne
 * sa onim što je neko ukucao.
 *
 * @param {{tekst: string, zipIme: string, zipSha: string, runnerIdevi: string[]}} ulaz
 * @returns {string[]}
 */
export function proveriHandoff({ tekst, zipIme, zipSha, runnerIdevi }) {
  const nalazi = [];

  if (!tekst.includes(zipIme)) nalazi.push(`ne sadrži tačno ime ZIP-a (${zipIme})`);
  if (!tekst.includes(zipSha)) nalazi.push("ne sadrži stvarni SHA-256 isporučenog ZIP-a");

  const sume = [...new Set(tekst.match(SHA256) ?? [])];
  const tudje = sume.filter((s) => s !== zipSha);
  if (tudje.length > 0) {
    nalazi.push(`nosi tuđ SHA-256 (${tudje[0].slice(0, 12)}…) pored ispravnog`);
  }

  if (!tekst.includes(HANDOFF_ZAGLAVLJE)) {
    nalazi.push(`ne nosi izričito „${HANDOFF_ZAGLAVLJE}"`);
  }

  for (const id of pomenutiIdevi(tekst)) {
    if (!runnerIdevi.includes(id)) nalazi.push(`pominje proveru \`${id}\` koju runner nema`);
  }

  nalazi.push(...razorneNaredbe(tekst));
  return nalazi;
}
