import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  return [...blok.matchAll(/"(\d+)":\s*(treba\w+)/g)].map((m) => ({
    korak: m[1],
    preduslov: m[2],
  }));
})();

const broj = (naziv) => naziv.split(".")[0].trim();

/** Telo jednog koraka, od njegovog `tok(` do sledeceg. */
function telo(naziv) {
  const start = izvor.indexOf(`await tok("${naziv}"`);
  const next = izvor.indexOf('await tok("', start + 10);
  return izvor.slice(start, next === -1 ? undefined : next);
}

test("svi koraci su prisutni i jedinstveno numerisani", () => {
  assert.equal(koraci.length, 13, `ocekivano 13 koraka, nadjeno ${koraci.length}`);
  const brojevi = koraci.map(broj);
  assert.equal(new Set(brojevi).size, 13, `duplirani brojevi: ${brojevi.join(", ")}`);
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
  assert.ok(!/context\.clearCookies\(\)/.test(izvor), "vraceno je brisanje kolacica");
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
  assert.match(izvor, /!\/\^at\\s\/\.test\(r\)/);
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
