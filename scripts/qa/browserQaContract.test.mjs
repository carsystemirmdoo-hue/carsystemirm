import assert from "node:assert/strict";
import { readFile, } from "node:fs/promises";
import { readFileSync } from "node:fs";
import test from "node:test";
import { jeLoginPathname } from "./logout-predicate.mjs";

/**
 * Ugovor browser QA runnera.
 *
 * Prvi prolaz je prijavio „palo 3, blokirano 6", a stvarni uzrok je bio jedan:
 * preduslovi su bili vezani za POZICIJU zatvarajuce zagrade u fajlu i promasili
 * za jedan tok. Korak koji proizvodi rezervne kodove trazio je rezervne kodove,
 * a korak koji od njih zavisi ostao je nezasticen.
 *
 * Ovi testovi ne traze bazu i cuvaju upravo to: da mapiranje ostane tacno.
 */

const izvor = await readFile(new URL("./pg-browser-qa.mts", import.meta.url), "utf8");

/** Izvor bez komentara — tvrdnje idu nad kodom, ne nad objasnjenjima. */
const kod = izvor.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Nazivi svih koraka, redom kojim se izvrsavaju. */
const koraci = [...izvor.matchAll(/await tok\("([^"]+)"/g)].map((m) => m[1]);

/** Kljucevi iz mape preduslova. */
const preduslovi = (() => {
  const blok = izvor.slice(
    izvor.indexOf("const PREDUSLOVI"),
    izvor.indexOf("};", izvor.indexOf("const PREDUSLOVI")),
  );
  return [...blok.matchAll(/"(\d+[a-z]?)":\s*(treba\w+)/g)].map((m) => ({
    korak: m[1],
    preduslov: m[2],
  }));
})();

const broj = (naziv) => naziv.split(".")[0].trim();

/**
 * Isecak bez komentara.
 *
 * Tvrdnje oblika „ovoga NEMA u kodu" moraju gledati kod. Objasnjenje zasto se
 * nesto NE radi legitimno pominje tu istu konstrukciju, pa bi nad sirovim
 * izvorom oborilo sopstveni test.
 */
const bezKomentara = (tekst) => tekst.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Telo jednog koraka, od njegovog `tok(` do sledeceg. */
function telo(naziv) {
  const start = izvor.indexOf(`await tok("${naziv}"`);
  const next = izvor.indexOf('await tok("', start + 10);
  return izvor.slice(start, next === -1 ? undefined : next);
}

test("svi koraci su prisutni i jedinstveno numerisani", () => {
  /*
   * 13 koraka Faze 1B + 6 koraka korpe + 1 korak spremnosti podataka.
   *
   * Oznaka sme da nosi slovni sufiks (`14b`): podkorak koji meri isto sto i
   * njegov roditelj, ali nad drugim delom stranice. Prenumerisanje svega iza
   * njega bi razbilo poklapanje sa ranijim QA izvestajima.
   */
  assert.equal(koraci.length, 20, `ocekivano 20 koraka, nadjeno ${koraci.length}`);
  const brojevi = koraci.map(broj);
  assert.equal(new Set(brojevi).size, 20, `duplirani brojevi: ${brojevi.join(", ")}`);
  for (const b of brojevi) {
    assert.match(b, /^\d+[a-z]?$/, `oznaka koraka „${b}" nije u dozvoljenom obliku`);
  }
});

test("korak koji proizvodi tajnu nema preduslov nad sopstvenim rezultatom", () => {
  // Korak 3 izvrsava vezivanje i tek onda postoje tajna i rezervni kodovi.
  // Trazenje bilo cega od toga unapred je kruzni preduslov: blokira bas onaj
  // korak koji treba da odblokira ostale.
  const proizvodjac = koraci.find((k) => /vezivanje kroz obrazac/.test(k));
  assert.ok(proizvodjac, "korak vezivanja nije pronadjen");
  assert.ok(
    !preduslovi.some((p) => p.korak === broj(proizvodjac)),
    `korak ${broj(proizvodjac)} zavisi od sopstvenog rezultata`,
  );
});

test("svaki korak koji koristi MFA tajnu ima preduslov", () => {
  const bez = [];
  for (const naziv of koraci) {
    // Proizvodjac je izuzet: on tajnu sam napravi pa je odmah upotrebi.
    if (/vezivanje kroz obrazac/.test(naziv)) continue;
    const t = telo(naziv);
    const koristiTajnu = /svezTotp\(ownerSecret\)/.test(t);
    // Korak 8 ima stroziji preduslov (stvarno uspela prijava), sto pokriva i tajnu.
    const imaPreduslov = preduslovi.some(
      (p) =>
        p.korak === broj(naziv) &&
        (p.preduslov === "trebaTajna" || p.preduslov === "trebaPunuSesiju"),
    );
    if (koristiTajnu && !imaPreduslov) bez.push(broj(naziv));
  }
  assert.deepEqual(bez, [], `koraci koriste tajnu bez preduslova: ${bez.join(", ")}`);
});

test("proizvodjac dodeljuje tajnu pre nego sto je upotrebi", () => {
  // Izuzetak iznad vazi samo dok ovo stoji: unutar koraka 3 tajna mora prvo
  // biti procitana sa ekrana, pa tek onda upotrebljena.
  const t = telo(koraci.find((k) => /vezivanje kroz obrazac/.test(k)));
  const dodela = t.indexOf("ownerSecret = await page.textContent");
  const upotreba = t.indexOf("svezTotp(ownerSecret)");
  assert.ok(dodela > 0, "korak 3 ne cita tajnu sa ekrana");
  assert.ok(upotreba > dodela, "korak 3 koristi tajnu pre nego sto je dodeli");
  // I mora da stane sa dokazima ako tajne nema.
  assert.match(t, /if \(!ownerSecret\) throw new Error\(await dokazi/);
});

test("svaki korak koji cita rezervne kodove ima preduslov", () => {
  const bez = [];
  for (const naziv of koraci) {
    if (/vezivanje kroz obrazac/.test(naziv)) continue; // proizvodjac
    const t = telo(naziv);
    const koristiKodove = /ownerRecovery\[|ownerRecovery\.filter|ownerRecovery\.map/.test(t);
    const imaPreduslov = preduslovi.some(
      (p) => p.korak === broj(naziv) && p.preduslov === "trebaKodove",
    );
    if (koristiKodove && !imaPreduslov) bez.push(broj(naziv));
  }
  assert.deepEqual(bez, [], `koraci citaju kodove bez preduslova: ${bez.join(", ")}`);
});

test("svaki preduslov pokazuje na postojeci korak", () => {
  const brojevi = new Set(koraci.map(broj));
  for (const p of preduslovi) {
    assert.ok(brojevi.has(p.korak), `preduslov za nepostojeci korak ${p.korak}`);
  }
});

test("preduslovi se vezuju za ime, ne za poziciju u fajlu", () => {
  // Stari oblik `}, trebaTajna);` je bio vezan za poziciju i zato promasio.
  assert.ok(
    !/\}\s*,\s*treba\w+\s*\)/.test(izvor),
    "preduslov je ponovo vezan za poziciju zatvarajuce zagrade",
  );
  assert.match(izvor, /PREDUSLOVI\[brojKoraka\(naziv\)\]/);
});

/* =========================================================================
 * Cekanje na stvarni ishod
 * ====================================================================== */

test("nema fiksnih pauza kao glavnog cekanja posle slanja obrasca", () => {
  const fn = izvor.slice(
    izvor.indexOf("async function posalji"),
    izvor.indexOf("async function porukaGreske"),
  );
  // Server akcija nad udaljenom bazom traje sekundama; fiksna pauza znaci da
  // test cita ishod pre nego sto ga ima.
  assert.match(fn, /waitForFunction/);
  assert.match(fn, /AKCIJA_TIMEOUT_MS/);
  assert.ok(!/waitForTimeout\(4\d\d\)/.test(fn), "vraceno je kratko fiksno cekanje");
});

test("prijava ceka da se adresa smiri", () => {
  const fn = izvor.slice(
    izvor.indexOf("async function prijava"),
    izvor.indexOf("async function posalji"),
  );
  // Lanac je dvostruk: server akcija -> /portal -> vezivanje. Provera na prvoj
  // karici vratila bi /portal kao „konacno" odrediste.
  assert.match(fn, /sacekajSmirenuAdresu\(page\)/);
  assert.ok(!/startsWith\("\/prijava"\)/.test(fn), "vracena je provera prve karike");
});

test("fixture podaci su jedinstveni po prolazu", () => {
  const fn = izvor.slice(izvor.indexOf("async function seed"), izvor.indexOf("async function dodeli"));
  // Bez ovoga bi ponovljeni prolaz pao na jedinstvenom indeksu e-poste zbog
  // naloga koje ciscenje ne sme da obrise.
  assert.match(fn, /const prolaz = randomBytes/);
  assert.match(fn, /\$\{PREFIX\}-\$\{prolaz\}-\$\{key\}/);
});

test("padovi nose dokaze, ne samo poruku", () => {
  assert.match(izvor, /async function dokazi/);
  for (const dokaz of ["url=", "poruka=", "baza:", "server:", "snimak="]) {
    assert.ok(izvor.includes(dokaz), `dokaz ne sadrzi ${dokaz}`);
  }
});

/* =========================================================================
 * Zastita od ponovljenog vremenskog prozora
 * ====================================================================== */

test("nijedan kod se ne uzima iz vec upotrebljenog prozora", () => {
  // `confirmMfaEnrollment` upisuje `last_accepted_counter`, a provera trazi
  // STROGO veci brojac. Vezivanje i prva prijava posle njega padaju u isti
  // 30-sekundni prozor, pa je ispravan kod bio odbijen.
  assert.match(izvor, /async function svezTotp/);
  assert.match(izvor, /while \(trenutniKorak\(\) <= poslednjiKorak\)/);
  // Pomeranje prozora offsetom je bilo pogresno: prozor prihvatanja je +-1.
  assert.ok(!/totpFor\(/.test(izvor), "vracen je pomeraj prozora umesto cekanja");
});

test("koraci koji traze punu sesiju zavise od stvarne prijave", () => {
  // Nedostupna administracija posle neuspele prijave je posledica, ne nov kvar.
  assert.match(izvor, /const trebaPunuSesiju = \(\) =>/);
  assert.match(izvor, /punaSesija \? null :/);
  assert.ok(
    preduslovi.some((p) => p.korak === "8" && p.preduslov === "trebaPunuSesiju"),
    "korak 8 nema preduslov o uspeloj prijavi",
  );
  // Zastavicu postavljaju bas koraci koji dokazuju prijavu.
  assert.equal((izvor.match(/punaSesija = true;/g) ?? []).length, 2);
});

test("svaki scenario prijave koristi svez kontekst pretrazivaca", () => {
  // `clearCookies()` ne dira `sessionStorage` ni kes; pending stanje jednog
  // pokusaja moglo bi da utice na sledeci.
  assert.match(izvor, /async function svezaSesija/);
  assert.ok(!/context\.clearCookies\(\)/.test(kod), "vraceno je brisanje kolacica");
});

test("dijagnostika ne cita Next-ov najavljivac rute kao gresku", () => {
  // `porukaGreske` je poslednja funkcija u fajlu; kraj je prvi `await tok(`.
  const pocetak = izvor.indexOf("async function porukaGreske");
  const kraj = izvor.indexOf('await tok("', pocetak);
  const fn = izvor.slice(pocetak, kraj === -1 ? undefined : kraj);
  // Goli `[role="alert"]` hvata `<next-route-announcer>` i prijavljuje naslov
  // strane kao poruku greske — sto je u proslom prolazu odvelo na pogresan trag.
  // Svaki `[role="alert"]` mora imati prefiks koji ga vezuje za obrazac.
  const pojave = [...fn.matchAll(/'([^']*\[role="alert"\])'/g)].map((m) => m[1]);
  assert.ok(pojave.length > 0, "selektor za poruku greske nije pronadjen");
  for (const sel of pojave) {
    assert.notEqual(sel, '[role="alert"]', "goli selektor hvata najavljivac rute");
    assert.match(sel, /^(form|\.portal-\w+) /, `neogranicen selektor: ${sel}`);
  }
});

test("neuspela prijava prijavljuje fazu iz brojaca", () => {
  // Poruka aplikacije je namerno ista za svaki uzrok; brojaci se vode po opsegu
  // pa se iz njih vidi da li je pala lozinka ili drugi faktor.
  assert.match(izvor, /async function brojaciPoOpsegu/);
  assert.match(izvor, /function fazaNeuspeha/);
  assert.match(izvor, /odbijeno u fazi:/);
});

/* =========================================================================
 * Cekanje na ishod prijave
 * ====================================================================== */

test("prijava ceka jedinstven ishod, ne mirovanje adrese", () => {
  /*
   * Dok server akcija radi, adresa ostaje `/prijava` i ne menja se. Provera
   * mirovanja zato proglasi ishod pre nego sto ga ima — i vrati `/prijava` za
   * prijavu koja ce sekund kasnije uspeti. To je bio uzrok sest „padova".
   */
  assert.match(izvor, /async function sacekajIshodPrijave/);
  assert.match(izvor, /!location\.pathname\.startsWith\("\/prijava"\)/);
  assert.match(izvor, /document\.querySelector\("\.portal-login-error"\)/);

  const fn = izvor.slice(izvor.indexOf("async function prijava"), izvor.indexOf("async function svezaSesija"));
  const ishod = fn.indexOf("sacekajIshodPrijave(page)");
  const mirovanje = fn.indexOf("sacekajSmirenuAdresu(page)");
  assert.ok(ishod > 0, "prijava ne ceka ishod");
  assert.ok(mirovanje > ishod, "mirovanje adrese se gleda pre ishoda");
});

test("dokazi se ne seku i ne nose stack trace", () => {
  // Ranije je `slice(0, 200)` odsecao bas putanju snimka, pa je u izlazu
  // ostajalo „snimak=r".
  assert.ok(
    !/\(error as Error\)\.message\.slice\(/.test(izvor),
    "poruka greske se ponovo sece",
  );
  assert.match(izvor, /!\/\^at\\s\/\.test\(red\)/);
});

test("izostanak porasta brojaca se tumaci, ne prijavljuje kao nepoznato", () => {
  assert.match(izvor, /zahtev nije ni odbijen/);
  // Tvrdnja gleda samo ono sto se VRACA; komentar sme da pomene stari tekst.
  const fn = kod.slice(
    kod.indexOf("function fazaNeuspeha"),
    kod.indexOf("let poslednjiLanac"),
  );
  // Sve poruke koje funkcija moze da vrati — u sablonima i navodnicima.
  const poruke = [...fn.matchAll(/`[^`]*`|"[^"]*"/g)].map((m) => m[0]);
  assert.ok(poruke.length >= 3, `ocekivane bar 3 poruke, nadjeno ${poruke.length}`);
  for (const poruka of poruke) {
    assert.ok(!/faza nepoznata/.test(poruka), `vracena poruka nista ne kaze: ${poruka}`);
  }
  // I mora razlikovati „nista nije zabelezeno" od „ima zapisa, ali bez porasta".
  assert.ok(poruke.some((p) => /nije ni odbijen/.test(p)));
  assert.ok(poruke.some((p) => /nijedan brojač nije porastao/.test(p)));
});

test("korak 11 proverava fixture nad bazom pre druge prijave", () => {
  const t = telo(koraci.find((k) => /deaktivacija odbija/.test(k)));
  assert.match(t, /verifyPassword\(nalozi\.worker\.password, stanje\.password_hash\)/);
  assert.match(t, /fixture ne odgovara bazi/);
});

/* =========================================================================
 * Navigacija i ugovorena odredista
 * ====================================================================== */

test("nijedna navigacija se ne ocenjuje po networkidle", () => {
  // Next strana sa streaming odgovorom i klijentskim ruterom ne mora nikada
  // dostici mrezno mirovanje; timeout tada ne dokazuje da strana ne radi.
  assert.ok(
    !/waitUntil:\s*"networkidle"/.test(kod),
    "vracena je navigacija koja ceka mrezno mirovanje",
  );
  assert.ok(
    !/waitForLoadState\("networkidle"\)/.test(kod),
    "vraceno je cekanje mreznog mirovanja",
  );
});

test("otvaranje strane meri status i jedinstven element", () => {
  assert.match(kod, /async function otvori\(/);
  const fn = kod.slice(kod.indexOf("async function otvori("), kod.indexOf("async function sacekajRutu"));
  assert.match(fn, /waitUntil: "domcontentloaded"/);
  assert.match(fn, /odgovor\?\.status\(\)/);
  assert.match(fn, /waitForSelector\(marker/);
});

test("korak 1 ceka TACNO ugovoreno odrediste", () => {
  const t = telo(koraci.find((k) => /prijava vlasnika bez faktora/.test(k)));
  // Tok sme proci kroz `/portal`; bitno je gde se zaustavi.
  assert.match(t, /sacekajRutu\(page, MFA_RUTA\)/);
  assert.ok(!/sacekajSmirenuAdresu/.test(t), "korak 1 se vratio na mirovanje adrese");
  // Pri padu mora reci da li je prikazan stvaran portal ili prelazno stanje.
  assert.match(t, /portal_navigacija=/);
  assert.match(t, /okvir_za_vezivanje=/);
});

test("korak 8 meri administraciju po sadrzaju, ne po mirovanju", () => {
  const t = telo(koraci.find((k) => /administracija naloga/.test(k)));
  assert.match(t, /otvori\(s8\.page, ADMIN_RUTA, "\.portal-account-list"\)/);
  // Pad mora nositi HTTP status i trajanje, da se render razlikuje od 403/500.
  assert.match(t, /HTTP=\$\{nav\.status\}/);
  assert.match(t, /domcontentloaded=\$\{nav\.ms\}ms/);
});

test("rute su imenovane konstante, ne razbacani delovi adrese", () => {
  assert.match(kod, /const MFA_RUTA = "\/portal\/bezbednost\/mfa"/);
  assert.match(kod, /const ADMIN_RUTA = "\/portal\/bezbednost\/nalozi"/);
});

/* =========================================================================
 * Korak 4: redosled goBack → zavrsna ruta/marker → DOM provera
 * ====================================================================== */

const korak4 = telo(koraci.find((k) => /ne vraca rezervne kodove/.test(k)));
const korak4Kod = korak4.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("posle goBack se prvo ceka kraj navigacije, pa marker, pa DOM", () => {
  /*
   * Citanje DOM-a dok back/redirect lanac jos traje rusi izvrsni kontekst i
   * puca sa „Execution context was destroyed". Redosled je zato deo ugovora.
   */
  const back = korak4Kod.indexOf("goBack(");
  const ruta = korak4Kod.indexOf("sacekajSmirenuAdresu(page)");
  const marker = korak4Kod.indexOf('.waitFor({ state: "attached"');
  const dom = korak4Kod.indexOf('locator("body").innerText()');

  assert.ok(back > 0, "korak 4 ne pritiska Nazad");
  assert.ok(ruta > back, "zavrsna ruta se ne ceka posle goBack");
  assert.ok(marker > ruta, "marker ekrana se ceka pre zavrsne rute");
  assert.ok(dom > marker, "DOM se cita pre nego sto marker stigne");
});

test("nema neposrednog page.evaluate posle goBack", () => {
  const back = korak4Kod.indexOf("goBack(");
  const dom = korak4Kod.indexOf('locator("body")');
  const izmedju = korak4Kod.slice(back, dom);
  // Jedini dozvoljen `evaluate` je citanje sonde, i to TEK posle provera.
  assert.ok(
    !/page\.evaluate\(/.test(izmedju),
    "vracen je page.evaluate izmedju goBack i cekanja markera",
  );
});

test("provere idu preko locatora, ne preko jednokratnog evaluate", () => {
  for (const provera of [
    '.locator(".portal-recovery-list code").count()',
    'locator("body").innerText()',
    'locator("html").innerHTML()',
    'locator("[data-recovery-codes]").count()',
  ]) {
    assert.ok(korak4Kod.includes(provera), `nedostaje provera: ${provera}`);
  }
});

test("tvrdi se odsustvo i u vidljivom tekstu i u celom DOM-u", () => {
  // Kod sme biti sakriven, a i dalje prisutan u dokumentu.
  assert.match(korak4Kod, /vidljivTekst\.includes\(kod\) \|\| ceoDom\.includes\(kod\)/);
  // I jednokratni ekran ne sme biti vracen ni kao prazan okvir.
  assert.match(korak4Kod, /ekranKodova > 0/);
});

test("polazno stanje se potvrdjuje pre odlaska sa strane", () => {
  // Bez ovoga bi „nema kodova" prolazilo i kada ih nikad nije ni bilo.
  const pre = korak4Kod.indexOf("kodoviPre");
  const back = korak4Kod.indexOf("goBack(");
  assert.ok(pre > 0 && pre < back, "polazno stanje se ne proverava pre odlaska");
  assert.match(korak4Kod, /kodoviPre !== ownerRecovery\.length/);
});

test("ime koraka ne tvrdi mehanizam koji mozda nije aktivan", () => {
  const naziv = koraci.find((k) => /ne vraca rezervne kodove/.test(k));
  assert.ok(naziv, "korak nije pronadjen");
  // Ime opisuje sta se TVRDI (povratak ne vraca kodove), ne kojim putem je to
  // postignuto — BFCache restore Chromium sme i da ne izazove.
  assert.ok(!/BFCache/i.test(naziv), `ime i dalje tvrdi mehanizam: ${naziv}`);
});

test("neizazvan BFCache restore se belezi kao ograda, ne kao kvar", () => {
  // Prolaz uz ogradu i prolaz bez ogranicenja nisu isto; „13/13" ne sme
  // ostaviti utisak da je svaka zastita bila na punom ispitu.
  assert.match(kod, /const ograde: string\[\] = \[\]/);
  assert.match(korak4Kod, /ograde\.push\(/);
  assert.match(kod, /Ograde pokrivenosti/);
  // Ograda ne sme obarati korak.
  const posleOgrade = korak4Kod.slice(korak4Kod.indexOf("ograde.push("));
  assert.ok(!/throw new Error/.test(posleOgrade), "ograda obara korak");
});

test("obicna navigacija se ne predstavlja kao dokaz BFCache zastite", () => {
  // `pageshow.persisted` je jedini dokaz da je strana zaista vracena iz kesa.
  assert.match(kod, /window\.__qaNav/);
  assert.match(kod, /pageshowPersisted = e\.persisted/);
  assert.match(korak4Kod, /nav\?\.pageshowPersisted === true/);
  // Ishod mora razlikovati dva slucaja, a onaj bez BFCache-a upucivati na ogradu.
  assert.match(korak4Kod, /izBfcache\s*\n?\s*\?/);
  assert.match(korak4Kod, /iz BFCache-a, nijedan kod nije vraćen/);
  assert.match(korak4Kod, /vidi ogradu u sažetku/);
});

test("sonda se instalira pre prve navigacije, na svim kontekstima", () => {
  // `addInitScript` se izvrsava na svakom novom dokumentu; posle prve
  // navigacije bi propustio upravo onaj koji nas zanima.
  const pojave = [...kod.matchAll(/addInitScript\(NAV_SONDA\)/g)];
  assert.equal(pojave.length, 2, "sonda nije na oba konteksta");

  // Za svaki kontekst: sonda mora doci PRE `newPage()`, inace propusta
  // upravo onaj dokument koji nas zanima.
  const konteksti = [...kod.matchAll(/newContext\(/g)].map((m) => m.index);
  assert.equal(konteksti.length, 2, "ocekivana tacno dva konteksta");
  for (const start of konteksti) {
    const isecak = kod.slice(start, start + 400);
    const sonda = isecak.indexOf("addInitScript(NAV_SONDA)");
    const strana = isecak.indexOf("newPage()");
    assert.ok(sonda > 0, "kontekst bez sonde");
    assert.ok(strana > sonda, "strana se otvara pre nego sto je sonda postavljena");
  }
});

/* =========================================================================
 * Obavezne i opcione portal rute
 *
 * Ruta koja u grani ne postoji vraca 404 sa javne strane — bez portal layouta
 * i bez poslovnog sadrzaja. To NIJE zaobilazenje zastite, pa ne sme obarati
 * korak; ali ne sme se ni prijaviti kao provereno.
 * ====================================================================== */

const korak2 = telo(koraci.find((k) => /enrollment-only ne otvara/.test(k)));
const korak2Kod = korak2.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("rute su podeljene na obavezne i opcione", () => {
  assert.match(korak2Kod, /const obavezne = \[/);
  assert.match(korak2Kod, /const opcione = \[/);
  // Postojece rute moraju biti obavezne.
  for (const ruta of ['"/portal"', '"/portal/dozvole"', '"/portal/bezbednost/nalozi"']) {
    const obavezneBlok = korak2Kod.slice(
      korak2Kod.indexOf("const obavezne"),
      korak2Kod.indexOf("const opcione"),
    );
    assert.ok(obavezneBlok.includes(ruta), `${ruta} nije medju obaveznima`);
  }
  // `/portal/korpa` je opciona dok ne postoji.
  const opcioneBlok = korak2Kod.slice(korak2Kod.indexOf("const opcione"));
  assert.match(opcioneBlok.slice(0, 120), /"\/portal\/korpa"/);
});

test("opciona ruta ulazi u proveru cim pocne da postoji", () => {
  // Odluka se donosi po HTTP statusu, ne po spisku — pa nova ruta ne moze
  // ostati neprovarena zato sto je neko zaboravio da azurira test.
  assert.match(korak2Kod, /const status = odgovor\?\.status\(\) \?\? 0/);
  assert.match(korak2Kod, /if \(status === 404\)/);
  // Kada ruta postoji, vazi isto pravilo kao za obavezne.
  const posle404 = korak2Kod.slice(korak2Kod.indexOf("continue;"));
  assert.match(posle404, /sacekajRutu\(page, MFA_RUTA\)/);
  assert.match(posle404, /provereneOpcione\.push\(ruta\)/);
});

test("404 se prihvata tek posle dokaza da nema poslovnog sadrzaja", () => {
  // Inace bi „nema rute" moglo da sakrije procureli sadrzaj.
  const grana = korak2Kod.slice(korak2Kod.indexOf("if (status === 404)"));
  assert.match(grana, /portalNav/);
  assert.match(grana, /poslovno/);
  const dokazIdx = grana.indexOf("sadrzaj.portalNav || sadrzaj.poslovno");
  const ogradaIdx = grana.indexOf("ograde.push(");
  assert.ok(dokazIdx > 0 && dokazIdx < ogradaIdx, "ograda se upisuje pre provere sadrzaja");
});

test("ograda ima tacan tekst", () => {
  assert.match(korak2Kod, /nije prisutna u portal baseline-u/);
  assert.match(korak2Kod, /browser pristup nije bio na \` \+\s*"ispitu/s);
  assert.match(korak2Kod, /Kanonska full-session politika za buduće portal rute pokrivena je/);
  assert.match(korak2Kod, /unit testom/);
});

test("izvestaj ne broji neprovarene rute", () => {
  // Ranije je javljao „4 rute preusmerene" i kada su proverene tri.
  assert.match(korak2Kod, /const ukupno = obavezne\.length \+ provereneOpcione\.length/);
  assert.match(korak2Kod, /jos ne postoji \(vidi ogradu\)|još ne postoji \(vidi ogradu\)/);
  assert.ok(
    !/\$\{zabranjene\.length\} ruta/.test(korak2Kod),
    "vracen je broj koji ukljucuje neprovarene rute",
  );
});

/* =========================================================================
 * Trajne QA invarijante nad opcionom rutom
 *
 * Ovde NEMA provere da cart/commerce fajlovi ne postoje u repozitorijumu — to
 * su planirane funkcionalnosti i takva tvrdnja bi oborila build onog dana kada
 * stignu. Obim commita Faze 1B zabelezen je u runbooku i manifestu, ne ovde.
 *
 * Ono sto ostaje trajno: runner se ne sme VEZATI za te module.
 * ====================================================================== */

test("runner ne uvozi cart ni commerce module", () => {
  /*
   * Staticki uvoz bi vezao QA za tudji tok: runner ne bi mogao da se pokrene
   * dok ti moduli ne postoje, i pao bi iz razloga koji nema veze sa bezbednoscu.
   * Provera rute ide preko HTTP odgovora, sto radi u obe situacije.
   */
  for (const modul of ["components/cart", "lib/commerce", "portal-commerce"]) {
    assert.ok(
      !new RegExp(`(?:from|import)\\s+"[^"]*${modul}`).test(kod),
      `runner staticki uvozi ${modul}`,
    );
  }
});

test("grana 404: prihvata se samo uz dokaz da nema poslovnog sadrzaja", () => {
  const grana = korak2Kod.slice(
    korak2Kod.indexOf("if (status === 404)"),
    korak2Kod.indexOf("continue;"),
  );
  // Sadrzaj se cita sa strane, ne pretpostavlja.
  assert.match(grana, /document\.querySelector\("\.portal-shell, \[data-portal-nav\]"\)/);
  assert.match(grana, /document\.body\.innerText/);
  // Pad kada 404 ipak nosi nesto poslovno.
  assert.match(grana, /throw new Error\(\s*await dokazi\(/);
  assert.match(grana, /vraća 404 ali prikazuje poslovni sadržaj/);
  // Ograda se upisuje TEK posle te provere.
  assert.ok(
    grana.indexOf("sadrzaj.portalNav || sadrzaj.poslovno") < grana.indexOf("ograde.push("),
    "ograda se upisuje pre provere sadrzaja",
  );
  // Ograda ne obara korak.
  const posleOgrade = grana.slice(grana.indexOf("ograde.push("));
  assert.ok(!/throw new Error/.test(posleOgrade), "ograda obara korak");
});

test("grana non-404: ruta koja postoji mora zavrsiti na MFA ruti", () => {
  const posle404 = korak2Kod.slice(korak2Kod.indexOf("continue;"));
  // Isto pravilo kao za obavezne rute — bez izuzetka.
  assert.match(posle404, /if \(!\(await sacekajRutu\(page, MFA_RUTA\)\)\)/);
  assert.match(posle404, /nije preusmerena na vezivanje/);
  assert.match(posle404, /throw new Error\(/);
  // I tek tada se broji kao provereno.
  assert.ok(
    posle404.indexOf("sacekajRutu") < posle404.indexOf("provereneOpcione.push(ruta)"),
    "ruta se broji kao proverena pre nego sto je provera prosla",
  );
});

test("opciona ruta se ne moze tiho pretvoriti u preskocenu", () => {
  // Jedini put do `continue` vodi kroz granu 404; nema drugog preskakanja.
  const preskakanja = [...korak2Kod.matchAll(/continue;/g)];
  assert.equal(preskakanja.length, 1, "postoji vise od jednog izlaza iz provere");
  const pre = korak2Kod.slice(0, preskakanja[0].index);
  assert.ok(pre.includes("if (status === 404)"), "preskakanje nije vezano za 404");
});

/* =========================================================================
 * Korpa portala — koraci 14–17
 *
 * Ugovor brani OBLIK runnera, ne njegovo ponasanje: da browser QA stvarno
 * proverava granicu korpe, a ne da je samo pominje. Ponasanje dokazuje jedino
 * stvarni prolaz nad PostgreSQL bazom.
 * ====================================================================== */

const koraciKorpe = koraci.filter((n) => /korpa:/.test(n));

test("korpa se ukljucuje samo u QA potprocesu, ne u roditeljskom okruzenju", () => {
  const startBlok = izvor.slice(
    izvor.indexOf("function startServer()"),
    izvor.indexOf("async function cekajServer"),
  );
  assert.match(startBlok, /PORTAL_COMMERCE: "on"/, "flag nije u env potprocesa");
  // Roditeljski process.env se ne dira.
  assert.doesNotMatch(kod, /process\.env\.PORTAL_COMMERCE\s*=/);
});

test("koraci korpe pokrivaju obe strane granice", () => {
  assert.ok(koraciKorpe.length >= 5, `ocekivano bar 5 koraka korpe, ima ${koraciKorpe.length}`);
  assert.ok(koraciKorpe.some((n) => /vlasnik sa sposobnoscu/i.test(n)), "nema dozvoljene sesije");
  assert.ok(koraciKorpe.some((n) => /isti context/i.test(n)), "nema izolacije u deljenom contextu");
  assert.ok(
    koraciKorpe.some((n) => /komercijalista bez sposobnosti/i.test(n)),
    "nema odbijanja naloga bez sposobnosti",
  );
  assert.ok(koraciKorpe.some((n) => /javne strane/i.test(n)), "nema javnih strana");
  assert.ok(koraciKorpe.some((n) => /refresh cuva/i.test(n)), "nema provere trajnosti");
});

test("korak korpe odbija cenu, checkout i tvrdnju o porudzbini", () => {
  const k14 = telo(koraciKorpe.find((n) => /^14\./.test(n)));
  assert.match(k14, /korpa prikazuje cenu/);
  assert.match(k14, /nudi checkout ili tvrdi porudzbinu/);
});

test("korak korpe trazi pun UUID namespace, ne skraceni otisak", () => {
  const k14 = telo(koraciKorpe.find((n) => /^14\./.test(n)));
  assert.match(k14, /carsystem\\\.cart\\\.v3/, "ne proverava se v3 prefiks");
  assert.match(k14, /\{12\}/, "ne proverava se pun UUID (poslednja grupa)");
  assert.match(k14, /cart kljuc nije v3 UUID namespace/);
});

test("korak odbijanja koristi nalog BEZ commerce sposobnosti", () => {
  const k17 = telo(koraciKorpe.find((n) => /^17\./.test(n)));
  // `worker` je komercijalista — nema `customer_orders:create`.
  assert.match(k17, /nalozi\.worker/);
  assert.match(k17, /radnik bez dozvole dobio korpu/);
  assert.match(k17, /radnik vidi stavke drugog naloga/);
});

test("svaki korak korpe pocinje svezim kontekstom i zatvara ga", () => {
  /*
   * „Svez kontekst" znaci: scenario POCINJE od nule. Ne znaci da svaka prijava
   * unutar scenarija dobija svoj kontekst — korak 16 namerno vozi tri prijave
   * kroz JEDAN kontekst, i to je njegov predmet.
   */
  for (const naziv of koraciKorpe) {
    const t = telo(naziv);
    assert.equal(
      (t.match(/await svezaSesija\(\)/g) ?? []).length,
      1,
      `${naziv}: ocekivan tacno jedan svez kontekst po scenariju`,
    );
    assert.match(t, /zatvori\(\)/, `${naziv}: kontekst se ne zatvara`);
  }
});

/* =========================================================================
 * Korak 16 — izolacija naloga u ISTOM browser contextu
 *
 * Svez kontekst po koraku dokazuje da nema curenja kroz server, ali ne dokazuje
 * deljeni racunar: tamo drugi korisnik zatice sve sto je prvi ostavio u
 * `localStorage`. Zato ovaj scenario mora ostati u jednom kontekstu, a testovi
 * ispod cuvaju bas to — da ga niko kasnije ne „popravi" ciscenjem.
 * ====================================================================== */

const k16 = telo(koraciKorpe.find((n) => /^16\./.test(n)));

test("korak 16 vozi ceo scenario kroz JEDAN kontekst", () => {
  assert.equal((k16.match(/await svezaSesija\(\)/g) ?? []).length, 1, "vise od jednog konteksta");
  assert.equal(
    (bezKomentara(k16).match(/browser!?\.newContext\(/g) ?? []).length,
    0,
    "pravi se nov kontekst",
  );
});

test("korak 16 ne cisti stanje izmedju prijava", () => {
  const k16Kod = bezKomentara(k16);
  for (const zabranjeno of [
    /clearCookies\(/,
    /clearPermissions\(/,
    /localStorage\.clear\(/,
    /removeItem\(/,
    /storageState\(/,
  ]) {
    assert.doesNotMatch(k16Kod, zabranjeno, `korak 16 cisti stanje: ${zabranjeno}`);
  }
});

test("korak 16 se odjavljuje kroz stvarni tok aplikacije", () => {
  // Dugme iz `PortalShell` koje gadja `signOutAction` — ne test-side brisanje.
  assert.match(k16, /form button\[aria-label="Odjava"\]/);
  // Dokaz je ishod odjave, ne prolazna adresa: vidi tvrdnje o tri signala nize.
  assert.match(k16, /await dugme\.click\(\)/);
});

test("korak 16 ide A -> B -> A i broji tri prijave", () => {
  assert.equal((k16.match(/await prijaviSe\(/g) ?? []).length, 3, "nema tri prijave");
  assert.equal((k16.match(/await odjava\(\)/g) ?? []).length, 2, "nema dve odjave");
  // Prvi i treci put isti nalog, drugi put drugi nalog.
  const redosled = [...k16.matchAll(/await prijaviSe\(nalozi\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(redosled, ["owner", "owner2", "owner"]);
});

test("korak 16 tvrdi da B ne vidi nista od A i da dobija svoj namespace", () => {
  assert.match(k16, /B vidi stavke naloga A u istom contextu/);
  assert.match(k16, /B nije dobio sopstveni v3 UUID namespace/);
  assert.match(k16, /A po povratku ne vidi samo svoje/);
  // Namespace se poredi kao razlika skupova, ne po broju.
  assert.match(k16, /kljuceviB\.filter\(\(k\) => !kljuceviA\.includes\(k\)\)/);
  assert.match(k16, /UUID_KLJUC\.test\(noviB\[0\]\)/);
});

test("korak 16 dokazuje da odjava NIJE obrisala zapis", () => {
  /*
   * Bez ove provere scenario bi mogao tiho da prestane da meri ono zbog cega
   * postoji: ako odjava obrise zapis, B zatice cist storage i „izolacija"
   * postaje posledica ciscenja, a ne politike.
   */
  const posle = k16.slice(k16.indexOf("await odjava();"));
  assert.match(posle, /posleOdjave\.length !== 1/);
  assert.match(posle, /scenario vise ne meri deljeni racunar/);
});

test("korak 16 ne ispisuje kljuceve, UUID-eve ni sadrzaj korpe", () => {
  const ret = k16.slice(k16.lastIndexOf("return ("));
  for (const zabranjeno of [/kljucevi[AB]/, /noviB/, /MARKER_/, /UUID/i]) {
    assert.doesNotMatch(ret, zabranjeno, `u izlaz curi ${zabranjeno}`);
  }
  // U izlazu smeju samo brojevi i boolean vrednosti.
  assert.match(ret, /stavki\}/);
  assert.match(ret, /tudje\}/);
});

test("nijedan korak korpe ne ispisuje sadrzaj korpe ni identifikatore", () => {
  /*
   * Izlaz runnera zavrsava u terminalu i u CI dnevniku. Sme da nosi brojeve i
   * boolean vrednosti; ne sme nazive stavki, sifre varijanti, kolicine, kljuceve
   * ni UUID-eve. UUID je pseudonimni identifikator poveziv sa nalogom.
   */
  for (const naziv of koraciKorpe) {
    const t = bezKomentara(telo(naziv));
    for (const [m] of t.matchAll(/return \(?\s*`[\s\S]*?;/g)) {
      for (const zabranjeno of [
        /\bidjevi\b/,
        /\bkolicine\b/,
        /\bkljucev/i,
        /\bnoviB\b/,
        /\bMARKER_/,
        /\.email\b/,
        /\.id\b/,
        /\bname\b/,
        /\bsku\b/,
      ]) {
        assert.doesNotMatch(m, zabranjeno, `${naziv}: u izlaz curi ${zabranjeno}`);
      }
    }
  }
});

/* =========================================================================
 * Serijalizacija `page.evaluate` callbacka
 *
 * Prolaz je pao sa `ReferenceError: __name is not defined`. Playwright salje
 * telo callbacka kao TEKST; tsx pod `--keep-names` obavija svaku IMENOVANU
 * funkciju esbuild helperom `__name`, a taj helper ostaje u Node modulu.
 * Anoniman `map` callback se ne obavija — zato je padao samo jedan korak.
 *
 * Regex nad celim telom koraka ne bi razlikovao callback od okoline, pa se
 * argument izvlaci balansiranjem zagrada.
 * ====================================================================== */

/** Prvi argument svakog `.evaluate(` / `.waitForFunction(` poziva. */
function evaluateCallbacks(tekst) {
  const nadjeni = [];
  const re = /\.(evaluate|waitForFunction)\(/g;
  let m;
  while ((m = re.exec(tekst)) !== null) {
    let i = m.index + m[0].length;
    let dubina = 1;
    const pocetak = i;
    let kraj = -1;
    for (; i < tekst.length; i += 1) {
      const c = tekst[i];
      if (c === "(" || c === "[" || c === "{") dubina += 1;
      else if (c === ")" || c === "]" || c === "}") {
        dubina -= 1;
        if (dubina === 0) {
          kraj = i;
          break;
        }
      } else if (c === "," && dubina === 1) {
        kraj = i;
        break;
      }
    }
    if (kraj > pocetak) nadjeni.push(tekst.slice(pocetak, kraj));
  }
  return nadjeni;
}

test("nijedan browser callback u runneru ne sadrzi imenovanu funkciju", () => {
  /*
   * Pravilo vazi za CEO runner, ne samo za korake korpe: isti kvar bi pogodio
   * bilo koji korak, a otkriva se tek u pretrazivacu, uz prava vrata i pravu
   * bazu — najskuplje mesto za otkrivanje.
   */
  const svi = evaluateCallbacks(kod);
  assert.ok(svi.length >= 10, `ocekivano bar 10 browser callbacka, nadjeno ${svi.length}`);
  for (const cb of svi) {
    const kratko = cb.replace(/\s+/g, " ").trim().slice(0, 70);
    assert.doesNotMatch(
      cb,
      /\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/,
      `callback ima imenovanu strelicu — esbuild je obavija sa __name: ${kratko}`,
    );
    assert.doesNotMatch(cb, /\bfunction\s+\w+/, `callback ima imenovanu funkciju: ${kratko}`);
    assert.doesNotMatch(cb, /\bclass\s+\w+/, `callback ima klasu: ${kratko}`);
  }
});

test("fixture se serijalizuje u Node-u, ne u pretrazivacu", () => {
  for (const naziv of koraciKorpe) {
    const t = bezKomentara(telo(naziv));
    for (const cb of evaluateCallbacks(t)) {
      if (!/setItem/.test(cb)) continue;
      // Callback prima gotov string i radi jednu stvar.
      assert.match(
        cb.replace(/\s+/g, " ").trim(),
        /^\(a: \[string, string\]\) => window\.localStorage\.setItem\(a\[0\], a\[1\]\)$/,
        `${naziv}: upis u localStorage nije primitivan inline callback`,
      );
      assert.doesNotMatch(cb, /JSON\.stringify/, `${naziv}: serijalizacija je u pretrazivacu`);
      assert.doesNotMatch(cb, /\.map\(|\.filter\(|\.reduce\(/, `${naziv}: callback ima iterator callback`);
    }
  }
});

/* =========================================================================
 * Odjava — tri odvojeno merena signala
 *
 * Ranija verzija je cekala `location.pathname` in-page pollerom i hvatala sve
 * sa `.catch(() => false)`. Navigacija rusi izvrsni kontekst, poller odbija, a
 * `catch` je tu gresku prikazivao kao „nije zavrsila na prijavi". Snimak pada
 * je pokazivao `/prijava` — dokaz je opisivao pogresan dogadjaj.
 * ====================================================================== */

const odjavaTelo = (() => {
  const i = k16.indexOf("const odjava = async () =>");
  const j = k16.indexOf("/* ---- A:", i);
  return bezKomentara(k16.slice(i, j === -1 ? undefined : j));
})();

/** Sam uslov pada odjave, spljosten — prelomi redova nisu deo ugovora. */
const uslovPada = (() => {
  const i = odjavaTelo.indexOf("if (");
  const j = odjavaTelo.indexOf("{", odjavaTelo.indexOf("rutaVraca", i));
  return odjavaTelo.slice(i, j).replace(/\s+/g, "");
})();

test("odjava ima obaveznu precondition kapiju PRE klika", () => {
  /*
   * Zasebna privremena dijagnostika je pala pre logouta: prijava nije bila
   * gotova, pa je „logout ne radi" zapravo znacilo „korisnik nije ni bio
   * prijavljen". Kapija tu dvosmislenost cini nemogucom.
   */
  const doKlika = odjavaTelo.slice(0, odjavaTelo.indexOf("dugme.click()"));
  assert.match(doKlika, /await preduslovOdjave\(\)/, "nema kapije pre klika");
  // Kapija ide PRE reseta kolektora, a oba pre klika.
  assert.ok(
    doKlika.indexOf("preduslovOdjave()") < doKlika.indexOf("resetDijagnostiku()"),
    "kapija se proverava posle reseta",
  );
});

test("precondition kapija meri svih pet uslova i pada imenovanom porukom", () => {
  const kapija = bezKomentara(
    k16.slice(k16.indexOf("const preduslovOdjave"), k16.indexOf("const odjava = async")),
  );
  assert.match(kapija, /sesijaAktivna\(\)/, "ne proverava se session user");
  assert.match(kapija, /imaSessionCookie\(\)/, "ne proverava se auth cookie");
  assert.match(kapija, /querySelectorAll\('form button\[aria-label="Odjava"\]'\)/);
  assert.match(kapija, /isVisible\('form button\[aria-label="Odjava"\]'\)/);
  assert.match(kapija, /request\.get\(`\$\{BASE\}\/portal\/korpa`\)/);
  // Tacno jedan vidljiv pogodak, ne „bar jedan".
  assert.match(kapija, /pogodaka !== 1/);
  assert.match(kapija, /status !== 200/);
  assert.match(kapija, /PRECONDITION FAILED — LOGIN/);
});

test("auth cookie se prijavljuje samo kao boolean", () => {
  const fn = bezKomentara(
    k16.slice(k16.indexOf("const imaSessionCookie"), k16.indexOf("const preduslovOdjave")),
  );
  assert.match(fn, /Promise<boolean>/, "vraca se nesto osim boolean-a");
  assert.match(fn, /\.some\(/, "ne svodi se na boolean");
  assert.doesNotMatch(fn, /c\.value/, "cita se vrednost kolacica");
  // Ni jedno mesto u koraku ne sme ispisati vrednost kolacica.
  assert.doesNotMatch(bezKomentara(k16), /cookies\([^)]*\)[\s\S]{0,80}\.value/);
});

test("klik se snima: POST, status, Next-Action, redirect, Set-Cookie bez vrednosti", () => {
  assert.match(odjavaTelo, /next-action.*\? "da" : "ne"/, "ne belezi se Next-Action");
  assert.match(odjavaTelo, /new URL\(r\.url\(\)\)\.pathname/, "belezi se pun URL umesto putanje");
  assert.match(odjavaTelo, /r\.status\(\)/);
  assert.match(odjavaTelo, /location\|x-action-redirect/i, "ne cita se redirect odrediste");
  // Set-Cookie se svodi na ime + da li brise; vrednost se nikada ne ispisuje.
  assert.match(odjavaTelo, /ime: h\.value\.split\("="\)\[0\]\.trim\(\)/);
  assert.match(odjavaTelo, /brise:/);
  assert.doesNotMatch(
    odjavaTelo.slice(odjavaTelo.indexOf("snimak.push(")),
    /h\.value(?!\.split|\))/,
    "u snimak curi vrednost Set-Cookie zaglavlja",
  );
});

test("kolektori se kace tek pred klik i skidaju posle merenja", () => {
  for (const dogadjaj of ["request", "response", "pageerror", "console"]) {
    assert.match(odjavaTelo, new RegExp(`s\\.page\\.on\\("${dogadjaj}"`), `nema on(${dogadjaj})`);
    assert.match(odjavaTelo, new RegExp(`s\\.page\\.off\\("${dogadjaj}"`), `nema off(${dogadjaj})`);
  }
  const on = odjavaTelo.indexOf('s.page.on("request"');
  const klik = odjavaTelo.indexOf("dugme.click()");
  const off = odjavaTelo.indexOf('s.page.off("request"');
  assert.ok(on < klik && klik < off, "kolektori ne obuhvataju bas klik");
  // Kacenje ide POSLE reseta kursora, da ne pokupi prijavu A.
  assert.ok(odjavaTelo.indexOf("resetDijagnostiku()") < on, "kolektori hvataju i prethodni korak");
});

test("odjava meri i auth cookie posle klika, ne samo sesiju", () => {
  assert.match(odjavaTelo, /const cookiePosle = await imaSessionCookie\(\)/);
  // Svi clanovi uslova pada, bez obzira na prelome redova.
  for (const clan of ["aktivna", "cookiePosle", "!urlNaPrijavi", "!prikaz.loginForma",
    "prikaz.portalSadrzaj", "!rutaVraca"]) {
    assert.ok(uslovPada.includes(clan), `uslov pada ne sadrzi ${clan}`);
  }
  assert.match(odjavaTelo, /session_cookie_ostao=/);
});

test("[izvrsni] predikat prijave gleda PUTANJU, a query je dozvoljen", () => {
  /*
   * Prolaz je prijavio `url_na_prijavi=false` iako je odjava uspela. Predikat
   * je bio `adresa.includes("/prijava")` nad punim URL-om i merio je pogresnu
   * stvar. Ovaj test izvrsava pravu funkciju, ne cita izvor.
   */
  assert.equal(jeLoginPathname("http://127.0.0.1:3240/prijava"), true);
  assert.equal(
    jeLoginPathname("http://127.0.0.1:3240/prijava?callbackUrl=%2Fportal%2Fkorpa"),
    true,
    "callbackUrl sam po sebi nije pad",
  );
  assert.equal(jeLoginPathname("http://127.0.0.1:3240/portal"), false);
  // Relativne putanje daju isti odgovor kao apsolutne.
  assert.equal(jeLoginPathname("/prijava"), true);
  assert.equal(jeLoginPathname("/prijava?x=1"), true);
  assert.equal(jeLoginPathname("/portal/korpa"), false);
  // Podruta prijave nije prijava.
  assert.equal(jeLoginPathname("/prijava/reset"), false);
  // Niz znakova negde u adresi ne sme da prevari predikat.
  assert.equal(jeLoginPathname("http://127.0.0.1:3240/portal?next=/prijava"), false);
  assert.equal(jeLoginPathname("http://127.0.0.1:3240/portal/prijava"), false);
  for (const los of ["", null, undefined, 42]) {
    assert.equal(jeLoginPathname(los), false, `nevalidan ulaz ${JSON.stringify(los)}`);
  }
});

test("predikat prijave prati LOGIN_ROUTE, ne hardkodovan niz", () => {
  const izvorPredikata = readFileSync(
    new URL("./logout-predicate.mjs", import.meta.url),
    "utf8",
  );
  assert.match(izvorPredikata, /import \{ LOGIN_ROUTE \}/);
  assert.match(izvorPredikata, /=== LOGIN_ROUTE/);
  assert.doesNotMatch(
    izvorPredikata.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
    /"\/prijava"/,
    "putanja je hardkodovana pored LOGIN_ROUTE",
  );
});

test("odjava koristi predikat, ne includes nad punim URL-om", () => {
  assert.match(odjavaTelo, /jeLoginPathname\(urlPosleKlika\)/);
  assert.match(odjavaTelo, /jeLoginPathname\(urlPosleProvere\)/);
  assert.doesNotMatch(odjavaTelo, /\.includes\("\/prijava"\)/, "vracen je substring nad URL-om");
});

test("stanje odmah posle klika se meri PRE probe zasticene rute", () => {
  const kl = odjavaTelo.indexOf("const posleKlika = await sacekajPutanju");
  const prikaz = odjavaTelo.indexOf("const prikaz = await s.page.evaluate");
  const proba = odjavaTelo.indexOf('s.page.goto(`${BASE}/portal/korpa`');
  const posle = odjavaTelo.indexOf("const posleProvere = await sacekajPutanju");
  assert.ok(kl > 0 && prikaz > kl, "prikaz se cita pre adrese");
  assert.ok(proba > prikaz, "zasticena ruta se otvara pre merenja prikaza");
  assert.ok(posle > proba, "adresa posle provere se cita pre same provere");
  // Prva vrednost se NIKADA ne prepisuje drugom.
  assert.match(odjavaTelo, /const urlPosleKlika = posleKlika\.url/);
  assert.match(odjavaTelo, /const urlPosleProvere = posleProvere\.url/);
  assert.equal(
    (odjavaTelo.match(/urlPosleKlika\s*=/g) ?? []).length,
    1,
    "prva adresa se negde prepisuje",
  );
});

test("odjava trazi vidljivu login formu i odsustvo portal sadrzaja", () => {
  assert.match(odjavaTelo, /loginForma:/);
  assert.match(odjavaTelo, /input\[name="email"\]/);
  assert.match(odjavaTelo, /input\[name="password"\]/);
  assert.match(odjavaTelo, /portalSadrzaj:/);
  assert.match(odjavaTelo, /\.portal-shell, \[data-portal-nav\]/);
  // Oba ulaze u uslov pada.
  assert.match(odjavaTelo, /!prikaz\.loginForma/);
  assert.match(odjavaTelo, /prikaz\.portalSadrzaj/);
});

test("poruka pada nosi obe adrese odvojeno", () => {
  const poruka = odjavaTelo.slice(odjavaTelo.indexOf("odjava nije potvrdjena"));
  for (const znak of [
    "pathname_odmah_posle_klika=",
    "pathname_posle_provere_zasticene_rute=",
    "login_forma_vidljiva=",
    "portal_sadrzaj_vidljiv=",
  ]) {
    assert.ok(poruka.includes(znak), `poruka ne nosi ${znak}`);
  }
});

test("cekanje na putanju je Node-side i vraca gde je lanac zastao", () => {
  const fn = bezKomentara(
    izvor.slice(izvor.indexOf("async function sacekajPutanju"), izvor.indexOf("async function sacekajRutu")),
  );
  assert.match(fn, /new URL\(poslednja, BASE\)\.pathname === putanja/);
  assert.match(fn, /return \{ url: poslednja, stigao: false \}/, "ne vraca se gde je lanac zastao");
  assert.doesNotMatch(fn, /waitForFunction/, "in-page poller");
});

test("odjava meri sesiju, adresu i zasticenu rutu ODVOJENO", () => {
  assert.match(odjavaTelo, /sesijaAktivna\(\)/, "sesija se ne meri");
  assert.match(odjavaTelo, /urlNaPrijavi/, "adresa se ne meri");
  assert.match(odjavaTelo, /rutaVraca/, "zasticena ruta se ne meri");
  // Sva tri ulaze u istu poruku, da se faza vidi iz izlaza.
  const poruka = odjavaTelo.slice(odjavaTelo.indexOf("odjava nije potvrdjena"));
  for (const znak of ["sesija_aktivna=", "url_na_prijavi=", "zasticena_ruta_vraca_na_prijavu="]) {
    assert.ok(poruka.includes(znak), `poruka ne nosi ${znak}`);
  }
});

test("odjava cita sesiju sa auth endpointa, bez diranja kolacica", () => {
  assert.match(k16, /request\.get\(`\$\{BASE\}\/api\/auth\/session`\)/);
  assert.match(k16, /Boolean\(j && j\.user\)/);
});

test("odjava ne koristi in-page poller sa progutanom greskom", () => {
  assert.doesNotMatch(odjavaTelo, /waitForFunction/, "vracen je in-page poller");
  assert.doesNotMatch(odjavaTelo, /\.catch\(\(\) => false\)/, "greska se guta");
  assert.match(odjavaTelo, /sacekajPutanju\(s\.page, "\/prijava"\)/, "adresa se ne meri sa Node strane");
});

test("odjava resetuje dijagnostiku NEPOSREDNO pre klika", () => {
  const doKlika = odjavaTelo.slice(0, odjavaTelo.indexOf("dugme.click()"));
  assert.match(doKlika, /resetDijagnostiku\(\)/, "kursor se ne resetuje pre klika");
  // Reset mora zaista brisati sva tri traga.
  const fn = bezKomentara(
    izvor.slice(izvor.indexOf("function resetDijagnostiku"), izvor.indexOf("/** Redni broj koraka")),
  );
  assert.match(fn, /poslednjiLanac = \[\]/);
  assert.match(fn, /poslednjaFaza = ""/);
  assert.match(fn, /logKursor = serverLogSeq/);
});

test("dokazi citaju samo serverske redove tekuceg koraka", () => {
  const fn = bezKomentara(
    izvor.slice(izvor.indexOf("async function dokazi"), izvor.indexOf("async function porukaGreske")),
  );
  assert.match(fn, /filter\(\(r\) => r\.n > logKursor\)/, "dnevnik se ne sece po kursoru");
  // Redni broj mora rasti pri svakom upisu — niz se skracuje, indeks nije stabilan.
  assert.match(izvor, /serverLogSeq \+= 1;/);
  assert.match(izvor, /serverLog\.push\(\{ n: serverLogSeq, red \}\)/);
});

test("prijava B pocinje tek posle dokazane ugasene sesije", () => {
  const kod16 = bezKomentara(k16);
  const prvaOdjava = kod16.indexOf("await odjava();");
  const prijavaB = kod16.indexOf("await prijaviSe(nalozi.owner2");
  assert.ok(prvaOdjava > 0 && prijavaB > prvaOdjava, "B se prijavljuje pre odjave A");
  // Odjava baca ako ijedan od tri signala nije zadovoljen, pa B ni ne krece.
  for (const clan of ["aktivna", "cookiePosle", "!urlNaPrijavi", "!rutaVraca"]) {
    assert.ok(uslovPada.includes(clan), `uslov pada ne sadrzi ${clan}`);
  }
  assert.match(odjavaTelo, /throw new Error\(/);
});

test("odjava ide kroz klik, ne kroz direktan poziv server akcije", () => {
  assert.doesNotMatch(odjavaTelo, /signOutAction/, "server akcija se zove direktno");
  assert.doesNotMatch(odjavaTelo, /\/api\/auth\/signout/i, "gadja se signout endpoint");
  assert.match(odjavaTelo, /dugme\.click\(\)/);
});

test("korak 15 je oznacen kao ucitavanje, ne kao dodavanje ili spajanje", () => {
  const naziv15 = koraciKorpe.find((n) => /^15\./.test(n));
  assert.doesNotMatch(naziv15, /spajanje|dodavanje|merge/i, "naziv tvrdi vise nego sto dokazuje");
  assert.match(naziv15, /ucitavanje scoped zapisa/);
  const k15 = telo(naziv15);
  // Ograda mora biti u izvestaju, ne samo u komentaru.
  assert.match(k15, /ograde\.push\(/);
  assert.match(k15, /nema produkcijskog\s*" \+\s*\n?\s*"?\s*ulaza koji puni korpu|nema produkcijskog/);
  assert.match(k15, /cart-model\.test\.mjs/);
});
