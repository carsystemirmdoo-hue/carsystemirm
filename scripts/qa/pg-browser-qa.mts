/**
 * Live QA tokovi nad izolovanim PostgreSQL-om.
 *
 * Pokreće `next start` sa `DATABASE_URL` postavljenim na `TEST_DATABASE_URL`
 * **samo za taj proces**, prolazi kroz sve bezbednosne tokove u pravom
 * pretraživaču i gasi server za sobom.
 *
 * Ništa se ne upisuje u `.env`. Connection string se nikad ne ispisuje.
 *
 *   TEST_DATABASE_URL=… npm run qa:pg:browser
 *
 * Preduslov: `npm run build:check` i `npm run qa:pg:migrate` su izvršeni.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import * as OTPAuth from "otpauth";
import { chromium } from "playwright-core";
import {
  evaluateTestTarget,
  fingerprint,
  SAFETY_MESSAGES,
} from "../../db/integration/safety.mjs";
import { checkQaMasterKey, QA_ENV_MESSAGES, qaCryptoEnv } from "./qa-env.mjs";
import { jeLoginPathname } from "./logout-predicate.mjs";
import { hashPassword, verifyPassword } from "@/lib/auth/password.mjs";
import { issueEnrollmentGrant } from "@/lib/auth/enrollment-grant";
import { issuePasswordResetCode } from "@/lib/auth/password-reset";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
} from "@/lib/auth/mfa-service";

const PORT = Number(process.env.QA_PORT ?? 3240);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = "review-screenshots/faza-1b-pg-verify";
/** Ugovorena odredišta; koriste se u tvrdnjama umesto delova adrese. */
const MFA_RUTA = "/portal/bezbednost/mfa";
const ADMIN_RUTA = "/portal/bezbednost/nalozi";
const PREFIX = "qa1bverify-browser";

/* ---------------------------------------------------------------- kapija */

const decision = evaluateTestTarget({
  testUrl: process.env.TEST_DATABASE_URL,
  databaseUrl: process.env.DATABASE_URL,
  migrationUrl: process.env.MIGRATION_DATABASE_URL,
  vercelEnv: process.env.VERCEL_ENV,
});
if (!decision.ok || !decision.target) {
  const key = decision.reason as keyof typeof SAFETY_MESSAGES;
  console.error(SAFETY_MESSAGES[key] ?? decision.reason);
  process.exit(1);
}
console.log(
  `Meta: host=${decision.target.host} baza=${decision.target.database} ` +
    `otisak=${fingerprint(process.env.TEST_DATABASE_URL)}`,
);

/*
 * MFA ključ se proverava PRE nego što se bilo šta pokrene.
 *
 * Prvi prolaz je pao na osmom koraku jer ključa nije bilo, pa je osam narednih
 * koraka palo kaskadno — svaki od njih zavisi od tajne koja nikad nije nastala.
 */
const kljuc = checkQaMasterKey(process.env);
if (!kljuc.ok) {
  console.error(QA_ENV_MESSAGES[kljuc.reason as keyof typeof QA_ENV_MESSAGES] ?? kljuc.reason);
  process.exit(1);
}

/*
 * JEDAN skup tajni za oba procesa.
 *
 * Ovo je druga polovina iste greške: raniji runner je detetu davao nasumičan
 * ključ, a sebi nijedan. I da je sebi dao — bio bi drugi. Dozvola koju izda
 * roditelj potpisana je jednim ključem, a server bi je proveravao drugim, pa se
 * otisci nikada ne bi poklopili. Zato se vrednosti razrešavaju ovde, jednom, i
 * koriste na oba mesta.
 */
const QA_TAJNE = qaCryptoEnv(process.env);
Object.assign(process.env, QA_TAJNE);

/*
 * Tek posle kapije: `getDb()` iz produkcijskog koda gađa test bazu, i to samo
 * u ovom procesu. Vrednost se ne upisuje ni u jedan fajl.
 */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

/* ------------------------------------------------------------- izveštaj */

/**
 * Poslednji redovi sa servera; koriste se samo kao dokaz uz pad.
 *
 * Svaki red nosi redni broj jer se niz skracuje sa pocetka — indeks nije
 * stabilan, pa kursor mora biti redni broj, a ne pozicija. Bez toga bi dokaz
 * jednog koraka nosio redove nastale u prethodnim koracima: namerno odbijene
 * prijave iz koraka 6 i 11 izgledale bi kao kvar tekuceg koraka.
 */
const serverLog: { n: number; red: string }[] = [];
let serverLogSeq = 0;

/** Od kog rednog broja dokazi smeju da citaju serverski dnevnik. */
let logKursor = 0;

/**
 * Brise dijagnosticki trag prethodnog koraka.
 *
 * `poslednjiLanac` i `poslednjaFaza` puni `prijava()`. Ako se ne resetuju pre
 * radnje koja nije prijava, `dokazi()` uz pad te radnje prikaze lanac i fazu
 * PRETHODNE prijave — dokaz koji opisuje tudji dogadjaj.
 */
function resetDijagnostiku() {
  poslednjiLanac = [];
  poslednjaFaza = "";
  logKursor = serverLogSeq;
}

/**
 * Ograde pokrivenosti: tvrdnje koje su prošle, ali NISU bile na punom ispitu.
 *
 * Prolaz bez ograničenja i prolaz uz ogradu nisu isto. Bez ovog spiska bi
 * „13/13" ostavilo utisak da je svaka zaštita dokazana, a neke zavise od
 * uslova koje test ne može da izazove — na primer da pretraživač zaista vrati
 * stranu iz back/forward keša.
 */
const ograde: string[] = [];

type Rezultat = { tok: string; ok: boolean; blokiran: boolean; detalj: string };
const rezultati: Rezultat[] = [];
const zabelezi = (tok: string, ok: boolean, detalj = "", blokiran = false) => {
  rezultati.push({ tok, ok, blokiran, detalj });
  const oznaka = ok ? "PROLAZ" : blokiran ? "BLOKIRAN" : "PAD   ";
  console.log(`${oznaka}  ${tok}${detalj ? " :: " + detalj : ""}`);
};

/**
 * Izvršava jedan tok, ali samo ako su mu preduslovi ispunjeni.
 *
 * `prereq` vraća opis onoga što nedostaje, ili `null` kada je sve spremno.
 * Bez ovoga bi pad jednog koraka izazvao lavinu nerazumljivih grešaka u svim
 * narednima — prvi prolaz je tako prijavio osam puta
 * „Cannot read properties of null (reading 'replace')", a nijedna od tih poruka
 * nije govorila šta je zaista pošlo naopako.
 */
async function tok(naziv: string, fn: () => Promise<string | undefined>) {
  const nedostaje = PREDUSLOVI[brojKoraka(naziv)]?.() ?? null;
  if (nedostaje) {
    zabelezi(naziv, false, `preduslov nije ispunjen: ${nedostaje}`, true);
    return;
  }
  try {
    const detalj = await fn();
    zabelezi(naziv, true, detalj ?? "");
  } catch (error) {
    /*
     * Poruka se NE seče.
     *
     * Ranije je `slice(0, 200)` odsecao baš kraj — putanju snimka — pa je u
     * izlazu ostajalo „snimak=r" i dokaz je bio neupotrebljiv.
     */
    zabelezi(naziv, false, (error as Error).message);
  }
}

/*
 * Materijal koji nastaje u koraku vezivanja i treba narednim koracima.
 *
 * Živi na nivou modula, jer ga čitaju i provere preduslova. Ostaje `null` dok
 * vezivanje ne prođe — i baš to je signal da naredni koraci nemaju šta da rade.
 */
let ownerSecret: string | null = null;
let ownerRecovery: string[] = [];

/**
 * Da li je ijedna prijava sa drugim faktorom stvarno uspela.
 *
 * Koraci koji traže pun pristup ne smeju se prijaviti kao zaseban kvar kada
 * prijava pre njih nije prošla — to je posledica, ne nov nalaz.
 */
let punaSesija = false;

/**
 * Preduslovi, vezani za IME koraka.
 *
 * Ranija verzija ih je vezivala za poziciju zatvarajuće zagrade u fajlu i
 * promašila za jedan tok: korak „vezivanje kroz obrazac" dobio je zahtev za
 * rezervnim kodovima — a on ih tek proizvodi. Kružni preduslov je blokirao baš
 * onaj korak koji je trebalo da odblokira ostale, dok je korak koji je stvarno
 * zavisio od tajne ostao bez zaštite i pao kriptičnom greškom.
 *
 * Ime je stabilno; pozicija nije.
 */
const trebaTajna = () =>
  ownerSecret ? null : "nema MFA tajne — korak 3 (vezivanje) nije prošao";
const trebaKodove = () =>
  ownerRecovery.length > 0 ? null : "nema rezervnih kodova — korak 3 (vezivanje) nije prošao";
const trebaPunuSesiju = () =>
  punaSesija ? null : "nijedna prijava sa drugim faktorom nije uspela (koraci 5 i 7)";

/**
 * Korak → njegov preduslov.
 *
 * Korak 3 se namerno NE nalazi ovde: on proizvodi i tajnu i kodove, pa ne sme
 * zavisiti od sopstvenog rezultata. Ako ne uspe, mora biti PAD sa dokazima, a
 * ne blokiran.
 */
const PREDUSLOVI: Record<string, () => string | null> = {
  "4": trebaKodove,
  "5": trebaTajna,
  "6": trebaTajna,
  "7": trebaKodove,
  // Administracija traži STVARNO uspelu prijavu, ne samo postojanje tajne.
  "8": trebaPunuSesiju,
  "12": trebaTajna,
  // Koraci korpe traze vlasnikov drugi faktor i stvarno uspelu prijavu.
  "14": trebaPunuSesiju,
  "15": trebaPunuSesiju,
  // Deljeni context vozi tri prijave zaredom, sve tri sa drugim faktorom.
  "16": trebaPunuSesiju,
  "17": trebaTajna,
};

/** Redni broj koraka iz njegovog imena („5. prijava kodom…" → „5"). */
function brojKoraka(naziv: string): string {
  return naziv.split(".")[0].trim();
}

/* ----------------------------------------------------------------- TOTP */

/**
 * Poslednji vremenski korak iz koga je uzet kod.
 *
 * `confirmMfaEnrollment` upisuje `last_accepted_counter`, a `verifyTotpForUser`
 * zahteva STROGO veći brojač. Vezivanje i prva prijava posle njega padaju u isti
 * 30-sekundni prozor, pa je kod ispravan a ipak odbijen — zaštita od ponovne
 * upotrebe radi tačno kako treba, a runner je bio taj koji je ponavljao prozor.
 */
let poslednjiKorak = -1;

/** Trenutni TOTP korak. */
const trenutniKorak = () => Math.floor(Date.now() / 1000 / 30);

/**
 * Kod iz PRVOG neiskorišćenog vremenskog koraka.
 *
 * Čeka koliko treba da prozor stvarno bude nov. Tako se ponaša i čovek: gleda u
 * telefon i prepisuje ono što tamo piše u tom trenutku.
 */
async function svezTotp(base32: string | null): Promise<string> {
  if (!base32) throw new Error("nema MFA tajne — vezivanje nije prošlo");
  while (trenutniKorak() <= poslednjiKorak) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  poslednjiKorak = trenutniKorak();
  return totpZa(base32, 0);
}

const totpZa = (base32: string, offsetSteps = 0) =>
  new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(base32),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });

/* ------------------------------------------------------------- priprema */

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 4, onnotice: () => {} });

/** Briše QA naloge koji ne figuriraju ni u jednom nepromenljivom zapisu. */
async function ocistiSlobodne() {
  await sql`DELETE FROM auth_rate_limits`;
  await sql`
    DELETE FROM users
    WHERE email LIKE ${`${PREFIX}-%`}
      AND id NOT IN (SELECT actor_user_id FROM audit_log WHERE actor_user_id IS NOT NULL)
      AND id NOT IN (SELECT updated_by FROM system_settings WHERE updated_by IS NOT NULL)
  `;
  /*
   * Ono što se ne sme obrisati mora bar prestati da bude aktivno.
   *
   * Zaostao aktivan nalog iz prethodnog prolaza inače i dalje učestvuje u
   * pravilima koja broje aktivne naloge — na primer u zaštiti poslednjeg
   * vlasnika.
   */
  await sql`
    UPDATE users SET active = false
    WHERE email LIKE ${`${PREFIX}-%`} AND active = true
  `;
}

/**
 * Sintetički nalozi. Lozinke se nikada ne ispisuju.
 *
 * Ne briše zatečene naloge nasilno: korisnik koji figurira u tragu revizije se
 * ne sme obrisati (`audit_log` ima `ON DELETE RESTRICT`). Potpuno čišćenje pred
 * prolaz radi `npm run qa:pg:reset`.
 */
async function seed() {
  await ocistiSlobodne();
  /*
   * Svaki prolaz dobija svoj niz znakova u adresi.
   *
   * Prethodni prolaz može ostaviti naloge koje čišćenje ne sme da obriše — oni
   * koji su ušli u trag revizije. Sa fiksnim adresama drugi pokušaj bi pao na
   * jedinstvenom indeksu e-pošte, i to porukom koja nema veze sa onim što se
   * testira. Sa jedinstvenim prefiksom prolaz je ponovljiv bez obzira na to šta
   * je ostalo iza prethodnog.
   */
  const prolaz = randomBytes(4).toString("hex");
  const napravi = async (key: string, role: string, active = true) => {
    const password = `qa-${randomBytes(15).toString("base64url")}`;
    const email = `${PREFIX}-${prolaz}-${key}@qa-1b.invalid`;
    const [row] = await sql`
      INSERT INTO users (email, name, initials, password_hash, role, active)
      VALUES (${email}, ${`QA ${key}`}, ${key.slice(0, 2).toUpperCase()},
              ${await hashPassword(password)}, ${role}, ${active})
      RETURNING id
    `;
    return { id: row.id, email, password, role };
  };
  return {
    owner: await napravi("owner", "gazda"),
    owner2: await napravi("owner2", "gazda"),
    worker: await napravi("worker", "komercijalista"),
  };
}

/** Paket „bezbednost naloga“ vlasniku, da može do administracije. */
async function dodeliBezbednost(userId: string) {
  await sql`
    INSERT INTO user_permissions (user_id, permission_key, reason)
    VALUES (${userId}, 'bezbednost_naloga', 'QA')
    ON CONFLICT DO NOTHING
  `;
}

/* --------------------------------------------------------------- server */

function startServer() {
  const child = spawn(
    "npx",
    ["next", "start", "--port", String(PORT)],
    {
      env: {
        ...process.env,
        // Test baza vazi ISKLJUCIVO u ovom potprocesu.
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        NEXT_DIST_DIR: ".next-verify",
        AUTH_URL: BASE,
        AUTH_TRUST_HOST: "true",
        PORTAL_MFA_MODE: process.env.PORTAL_MFA_MODE ?? "enroll",
        /*
         * Korpa se ukljucuje ISKLJUCIVO u ovom QA potprocesu.
         *
         * Produkcijska i `.env.example` vrednost ostaju `off`. Ukljucena ovde
         * ujedno pooštrava korake 1 i 2: enrollment-only izolacija se dokazuje
         * u okruzenju u kome korpa POSTOJI, a ne u kome je ionako iskljucena.
         */
        PORTAL_COMMERCE: "on",
        // Iste vrednosti koje koristi i roditeljski proces — vidi `QA_TAJNE`.
        ...QA_TAJNE,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    const tekst = String(d);
    process.stderr.write(`[server] ${tekst}`);
    // Zadnjih nekoliko redova ide uz dokaze kada korak padne.
    for (const red of tekst.split("\n").map((r) => r.trim()).filter(Boolean)) {
      serverLogSeq += 1;
      serverLog.push({ n: serverLogSeq, red });
      if (serverLog.length > 40) serverLog.shift();
    }
  });
  return child;
}

async function cekajServer() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const res = await fetch(`${BASE}/prijava`);
      if (res.ok) return true;
    } catch {
      /* još ne sluša */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/* --------------------------------------------------------------- tokovi */

type Page = import("playwright-core").Page;

/**
 * Koliko se čeka na server akciju.
 *
 * Nije proizvoljno: integracioni testovi su nad istom udaljenom bazom izmerili
 * 4,6–6,7 s za jedan `completePasswordReset` (scrypt plus nekoliko obilazaka do
 * Neona). Ranijih fiksnih 400 ms značilo je da test čita ishod pre nego što ga
 * ima — pa su koraci 3 i 10 padali na praznu stranicu, ne na grešku aplikacije.
 */
const AKCIJA_TIMEOUT_MS = 45_000;

/**
 * Čeka JEDINSTVEN ishod prijave, pa tek onda da se adresa slegne.
 *
 * Zašto ne samo mirovanje adrese
 * ------------------------------
 * Dok server akcija radi — scrypt plus nekoliko obilazaka do udaljenog Neona,
 * mereno 4,6–6,7 s — adresa ostaje `/prijava` i **ne menja se**. Provera
 * „adresa se nije promenila 1,2 s" zato proglašava ishod pre nego što ga ima, i
 * vraća `/prijava` za prijavu koja će sekund kasnije uspeti.
 *
 * To je bio uzrok šest „padova" u prošlom prolazu: sesija je nastajala (koraci
 * 2 i 3, koji je traže, prolazili su), a helper je već prijavio neuspeh. Ni
 * jedan brojač pokušaja nije rastao — jer ništa nije ni bilo odbijeno.
 *
 * Ishod je jedinstven: ili smo napustili `/prijava`, ili se pojavila poruka
 * greške obrasca. Treće nema.
 */
async function sacekajIshodPrijave(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      () =>
        !location.pathname.startsWith("/prijava") ||
        document.querySelector(".portal-login-error") !== null,
      null,
      { timeout: AKCIJA_TIMEOUT_MS },
    );
  } catch {
    throw new Error(
      `prijava nije dala ishod u ${AKCIJA_TIMEOUT_MS} ms ` +
        "(ni preusmeravanje ni poruka greške)",
    );
  }
}

/**
 * Čeka da se adresa smiri.
 *
 * Koristi se TEK POSLE `sacekajIshodPrijave`, za lanac preusmeravanja
 * `/portal` → `/portal/bezbednost/mfa`. Sama za sebe nije dokaz ishoda.
 */
async function sacekajSmirenuAdresu(page: Page, mirovanjeMs = 1200): Promise<string> {
  const kraj = Date.now() + AKCIJA_TIMEOUT_MS;
  let poslednja = page.url();
  let odKada = Date.now();

  while (Date.now() < kraj) {
    await page.waitForTimeout(200);
    const sada = page.url();
    if (sada !== poslednja) {
      poslednja = sada;
      odKada = Date.now();
      continue;
    }
    if (Date.now() - odKada >= mirovanjeMs) return sada;
  }
  return page.url();
}

/**
 * Brojači pokušaja po opsegu.
 *
 * Poruka o neuspeloj prijavi je namerno ista za svaki uzrok — iz nje se ne sme
 * zaključiti šta je pogrešno. Ali brojači se vode odvojeno po opsegu, pa se iz
 * njihove promene vidi u KOJOJ FAZI je zahtev odbijen: `password` znači da nije
 * prošla lozinka, `totp` ili `recovery` da nije prošao drugi faktor.
 *
 * Ovo ne slabi ugovor: aplikacija i dalje ne odaje ništa korisniku, a QA čita
 * bazu kojoj ionako ima pristup.
 */
async function brojaciPoOpsegu(): Promise<Record<string, number>> {
  const redovi = await sql<{ scope: string; attempts: number }[]>`
    SELECT scope, sum(attempts)::int AS attempts FROM auth_rate_limits GROUP BY scope
  `;
  return Object.fromEntries(redovi.map((r) => [r.scope, r.attempts]));
}

/** Koja faza je odbila zahtev, iz razlike u brojačima. */
function fazaNeuspeha(pre: Record<string, number>, posle: Record<string, number>): string {
  const porasli = Object.keys(posle).filter((k) => (posle[k] ?? 0) > (pre[k] ?? 0));
  if (porasli.length > 0) return `odbijeno u fazi: ${porasli.join(", ")}`;

  /*
   * Nijedan brojač nije porastao — to NIJE isto što i „faza nepoznata".
   *
   * `registerAttempt` upisuje red za svaki odbijen pokušaj, pa izostanak
   * porasta znači da odbijanja nije ni bilo. Poruka to sada kaže, umesto da
   * ostavi utisak da merenje ne radi.
   */
  const opsezi = Object.keys(posle);
  return opsezi.length === 0
    ? "nijedan pokušaj nije zabeležen — zahtev nije ni odbijen (proveri čekanje na ishod)"
    : `nijedan brojač nije porastao (postojeći opsezi: ${opsezi.join(", ")}) — zahtev nije odbijen`;
}

/** Poslednja prijava: ceo lanac adresa i faza u kojoj je pala. */
let poslednjiLanac: string[] = [];
let poslednjaFaza = "";

async function prijava(page: Page, email: string, password: string, secondFactor = "") {
  const preBrojaci = await brojaciPoOpsegu();

  /*
   * Ceo lanac preusmeravanja, ne samo konačna adresa.
   *
   * Prijava vodi kroz `/prijava` → `/portal` → vezivanje. Kada nešto pođe
   * naopako, iz same konačne adrese se ne vidi gde je lanac skrenuo.
   */
  poslednjiLanac = [];
  const pratilac = (frame: import("playwright-core").Frame) => {
    if (frame === page.mainFrame()) poslednjiLanac.push(frame.url().replace(BASE, ""));
  };
  page.on("framenavigated", pratilac);

  try {
    await page.goto(`${BASE}/prijava`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="email"]', { timeout: AKCIJA_TIMEOUT_MS });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    if (secondFactor) {
      // Polje za drugi faktor mora zaista postojati pre nego što se popuni.
      await page.waitForSelector('input[name="secondFactor"]', { timeout: 10_000 });
      await page.fill('input[name="secondFactor"]', secondFactor);
    }

    await page.click('button[type="submit"]');
    // Prvo ishod, pa tek onda lanac preusmeravanja.
    await sacekajIshodPrijave(page);
    const konacna = await sacekajSmirenuAdresu(page);
    poslednjaFaza = konacna.includes("/prijava")
      ? fazaNeuspeha(preBrojaci, await brojaciPoOpsegu())
      : "prijava je prošla";
    return konacna;
  } finally {
    page.off("framenavigated", pratilac);
  }
}

/**
 * Beleži kako je dokument dospeo na ekran.
 *
 * `pageshow.persisted === true` znači da je strana vraćena iz back/forward
 * keša — tada React stanje preživljava i jednokratni materijal bi se mogao
 * ponovo prikazati. `navigation.type === "back_forward"` je isti podatak iz
 * drugog ugla i postoji i kada je dokument ponovo učitan.
 *
 * Bez ovoga bi obična nova navigacija mogla da se predstavi kao dokaz BFCache
 * zaštite, a to nije isto.
 */
const NAV_SONDA = `
  window.__qaNav = window.__qaNav || { pageshowPersisted: null, navType: null };
  try {
    const n = performance.getEntriesByType("navigation")[0];
    window.__qaNav.navType = n ? n.type : null;
  } catch { /* stariji pretrazivaci */ }
  window.addEventListener("pageshow", (e) => {
    window.__qaNav.pageshowPersisted = e.persisted;
    try {
      const n = performance.getEntriesByType("navigation")[0];
      if (n) window.__qaNav.navType = n.type;
    } catch { /* bez podatka */ }
  });
`;

/**
 * Otvara stranu i čeka JEDINSTVEN element te strane.
 *
 * `networkidle` nije merilo ispravnosti Next strane: uz streaming odgovor i
 * klijentski ruter mrežno mirovanje ume da nikada ne nastupi, pa timeout ne
 * dokazuje da strana ne radi — samo da je i dalje bilo saobraćaja.
 *
 * Zato se meri ono što zaista znači „strana radi": HTTP status odgovora i
 * pojava elementa koji postoji samo na toj strani.
 */
async function otvori(
  page: Page,
  ruta: string,
  marker: string,
): Promise<{ status: number | null; ms: number; stigao: boolean }> {
  const t0 = Date.now();
  const odgovor = await page.goto(`${BASE}${ruta}`, {
    waitUntil: "domcontentloaded",
    timeout: AKCIJA_TIMEOUT_MS,
  });
  const stigao = await page
    .waitForSelector(marker, { timeout: AKCIJA_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  return { status: odgovor?.status() ?? null, ms: Date.now() - t0, stigao };
}

/**
 * Čeka da PUTANJA postane tražena — mereno sa Node strane.
 *
 * `sacekajSmirenuAdresu` vraća prvu adresu koja miruje 1,2 s. U lancu
 * `/portal/korpa` → `/portal` → `/prijava` to ume da bude MEĐUKORAK: prolaz je
 * tako izmerio `/portal` i prijavio da odjava nije završila na prijavi, iako
 * jeste. Ovde se čeka baš odredište; ako ne stigne, vraća se poslednja viđena
 * adresa da bi se videlo gde je lanac zastao.
 *
 * @returns poslednja adresa i da li je odredište stvarno dosegnuto
 */
async function sacekajPutanju(
  page: Page,
  putanja: string,
  rokMs = AKCIJA_TIMEOUT_MS,
): Promise<{ url: string; stigao: boolean }> {
  const kraj = Date.now() + rokMs;
  let poslednja = page.url();
  while (Date.now() < kraj) {
    poslednja = page.url();
    if (new URL(poslednja, BASE).pathname === putanja) return { url: poslednja, stigao: true };
    await page.waitForTimeout(200);
  }
  return { url: poslednja, stigao: false };
}

/**
 * Čeka da adresa bude TAČNO ona ugovorena.
 *
 * Tok sme privremeno proći kroz međukorake; jedino je bitno gde se zaustavi.
 */
async function sacekajRutu(page: Page, ruta: string): Promise<boolean> {
  return page
    .waitForFunction((r: string) => location.pathname === r, ruta, {
      timeout: AKCIJA_TIMEOUT_MS,
    })
    .then(() => true)
    .catch(() => false);
}

/** Svež kontekst pretraživača — bez kolačića i bez zaostalog stanja. */
async function svezaSesija(): Promise<{ page: Page; zatvori: () => Promise<void> }> {
  /*
   * Nov kontekst umesto `clearCookies()`.
   *
   * Brisanje kolačića ne dira `sessionStorage`, keš ni stanje koje je stranica
   * mogla zadržati iz prethodnog pokušaja. Za scenario prijave je bitno da
   * krene od nule.
   */
  const ctx = await browser!.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(NAV_SONDA);
  const p = await ctx.newPage();
  return { page: p, zatvori: () => ctx.close() };
}

/**
 * Šalje obrazac i čeka STVARNI ishod — uspeh ili vidljivu grešku.
 *
 * Čekanje na jedan od očekivanih selektora je jedini pouzdan način: server
 * akcija menja DOM bez navigacije, pa ni `networkidle` ni fiksna pauza ne znače
 * da je odgovor stigao.
 *
 * @param uspeh   selektor koji postoji samo kada je akcija uspela
 */
async function posalji(page: Page, uspeh: string[]): Promise<void> {
  await page.click('button[type="submit"]');
  const greske = [".portal-form-error", ".portal-login-error", '[role="alert"]'];
  try {
    await page.waitForFunction(
      (sel: string[]) => sel.some((s) => document.querySelector(s) !== null),
      [...uspeh, ...greske],
      { timeout: AKCIJA_TIMEOUT_MS },
    );
  } catch {
    /*
     * Ni uspeh ni greška u zadatom roku.
     *
     * To je sopstveno stanje, različito od „akcija je odbila": znači da odgovor
     * uopšte nije stigao. Prijavljuje se kao takvo, da se ne pomeša sa greškom
     * aplikacije.
     */
    throw new Error(
      `nema odgovora u ${AKCIJA_TIMEOUT_MS} ms (očekivano: ${uspeh.join(" ili ")})`,
    );
  }
  // Kratko smirivanje: React može da dopiše ostatak odgovora.
  await page.waitForTimeout(300);
}

/**
 * Sastavlja dokaze uz pad: šta se vidi, gde smo završili i šta baza kaže.
 *
 * Bez ovoga poruka „nova lozinka nije prihvaćena" ne razlikuje grešku
 * aplikacije, istekao kod, prekratko čekanje ni zaostali fixture — a to su
 * potpuno različiti uzroci.
 */
async function dokazi(page: Page, sta: string, userId?: string): Promise<string> {
  const delovi = [sta, `url=${page.url().replace(BASE, "")}`];

  const poruka = await porukaGreske(page);
  if (poruka) delovi.push(`poruka="${poruka}"`);

  if (userId) {
    const [red] = await sql<
      { mfa: boolean; kodova: number; reset_otvoren: number; verzija: number }[]
    >`
      SELECT (m.secret_ciphertext IS NOT NULL) AS mfa,
             (SELECT count(*)::int FROM mfa_recovery_codes WHERE user_id = u.id) AS kodova,
             (SELECT count(*)::int FROM password_reset_codes
                WHERE user_id = u.id AND used_at IS NULL AND superseded_at IS NULL) AS reset_otvoren,
             u.session_version AS verzija
      FROM users u LEFT JOIN user_mfa m ON m.user_id = u.id
      WHERE u.id = ${userId}
    `;
    if (red) {
      delovi.push(
        `baza: user_mfa=${red.mfa} recovery_kodova=${red.kodova} ` +
          `otvorenih_reset_kodova=${red.reset_otvoren} session_version=${red.verzija}`,
      );
    }
  }

  if (poslednjiLanac.length > 0) delovi.push(`lanac=${poslednjiLanac.join(" → ")}`);
  if (poslednjaFaza) delovi.push(poslednjaFaza);

  /*
   * Iz serverskog dnevnika se izbacuju redovi steka.
   *
   * `at async …` ne kaže ništa o uzroku, a istiskuje poruku koja bi rekla.
   */
  const bitni = serverLog
    // Samo redovi nastali OD pocetka tekuceg koraka.
    .filter((r) => r.n > logKursor)
    .map((r) => r.red)
    .filter((red) => !/^at\s/.test(red) && !/^\s*$/.test(red))
    .slice(-3)
    .join(" | ");
  if (bitni) delovi.push(`server: ${bitni}`);

  const snimak = `${SHOTS}/pad-${Date.now()}.png`;
  await page.screenshot({ path: snimak, fullPage: true }).catch(() => {});
  delovi.push(`snimak=${snimak}`);

  return delovi.join("  ");
}

/**
 * Vidljiva poruka greške sa ekrana, ako je ima.
 *
 * `[role="alert"]` se traži SAMO unutar obrasca. Next renderuje
 * `<next-route-announcer><p role="alert">naslov strane</p></next-route-announcer>`
 * radi pristupačnosti — u prethodnom prolazu je baš taj element proglašen
 * porukom greške, pa je dijagnostika prijavila naslov strane („Drugi faktor ·
 * Poslovni sistem") kao da je to greška obrasca. To je odvelo na pogrešan trag.
 */
async function porukaGreske(page: Page): Promise<string | null> {
  const selektori = [
    ".portal-form-error",
    ".portal-login-error",
    'form [role="alert"]',
    '.portal-panel [role="alert"]',
  ];
  for (const sel of selektori) {
    const tekst = await page.textContent(sel).catch(() => null);
    if (tekst && tekst.trim()) return tekst.trim().slice(0, 160);
  }
  return null;
}

const server = startServer();
let browser: import("playwright-core").Browser | undefined;

try {
  if (!(await cekajServer())) throw new Error("server se nije podigao");
  await mkdir(SHOTS, { recursive: true });

  const nalozi = await seed();
  await dodeliBezbednost(nalozi.owner.id);

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Mora pre prve navigacije: init skripta se izvršava na svakom novom dokumentu.
  await context.addInitScript(NAV_SONDA);
  const page = await context.newPage();

  await tok("1. prijava vlasnika bez faktora vodi na vezivanje", async () => {
    await prijava(page, nalozi.owner.email, nalozi.owner.password);

    /*
     * Ugovoreno odredište, ne „adresa se smirila".
     *
     * Tok SME privremeno proći kroz `/portal` — tamo `requireUser` prepoznaje
     * enrollment-only sesiju i šalje dalje. Bitno je samo gde se zaustavi.
     */
    if (!(await sacekajRutu(page, MFA_RUTA))) {
      /*
       * Ostali smo drugde i posle punog čekanja. Sada je bitno da li je
       * prikazan STVARAN sadržaj portala — to bi bio bezbednosni defekt — ili
       * samo prelazno stanje.
       */
      const stanje = await page.evaluate(() => ({
        h1: document.querySelector("h1")?.textContent?.trim() ?? null,
        navigacija: document.querySelector("nav") !== null,
        okvirZaVezivanje: document.querySelector(".portal-enrollment-frame") !== null,
      }));
      throw new Error(
        await dokazi(
          page,
          `nije stigao na ${MFA_RUTA}: h1=${stanje.h1 ?? "-"} ` +
            `portal_navigacija=${stanje.navigacija} okvir_za_vezivanje=${stanje.okvirZaVezivanje}`,
          nalozi.owner.id,
        ),
      );
    }
    await page.screenshot({ path: `${SHOTS}/01-enrollment-1280.png`, fullPage: true });
    return `→ ${MFA_RUTA}`;
  });

  await tok("2. enrollment-only ne otvara zasticene portal rute", async () => {
    /*
     * Rute se dele na dve grupe.
     *
     * OBAVEZNE postoje u ovoj grani i moraju biti preusmerene — svaki propust
     * je stvarni bezbednosni defekt.
     *
     * OPCIONE dolaze iz zasebnih tokova i u ovoj grani još ne postoje.
     * Njihova politika je pokrivena jediničnim ugovorom
     * (`lib/authz/enrollmentIsolation.test.mjs`); ovde se proveravaju TEK kada
     * ruta stvarno postoji. Time se izbegava i lažni pad i lažni prolaz: ruta
     * koje nema vraća 404 sa javne strane, bez portal layouta i bez ijednog
     * poslovnog elementa — to nije zaobilaženje zaštite.
     *
     * Čim se `app/portal/korpa/page.tsx` pojavi, provera ulazi sama.
     */
    const obavezne = ["/portal", "/portal/dozvole", "/portal/bezbednost/nalozi"];
    const opcione = ["/portal/korpa"];

    for (const ruta of obavezne) {
      await page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
      if (!(await sacekajRutu(page, MFA_RUTA))) {
        throw new Error(
          await dokazi(page, `${ruta} nije preusmerena na vezivanje`, nalozi.owner.id),
        );
      }
    }

    const provereneOpcione: string[] = [];
    for (const ruta of opcione) {
      const odgovor = await page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
      const status = odgovor?.status() ?? 0;

      if (status === 404) {
        /*
         * Ruta ne postoji. Pre nego što se to prihvati, mora se dokazati da 404
         * strana NE nosi ništa poslovno — inače bi „nema rute" moglo da sakrije
         * procureli sadržaj.
         */
        const sadrzaj = await page.evaluate(() => ({
          h1: document.querySelector("h1")?.textContent?.trim() ?? null,
          portalNav: document.querySelector(".portal-shell, [data-portal-nav]") !== null,
          poslovno: /korpa|cart|dozvole|kupci|porudžbin/i.test(document.body.innerText),
        }));
        if (sadrzaj.portalNav || sadrzaj.poslovno) {
          throw new Error(
            await dokazi(
              page,
              `${ruta} vraća 404 ali prikazuje poslovni sadržaj: h1=${sadrzaj.h1}`,
              nalozi.owner.id,
            ),
          );
        }
        ograde.push(
          `Ruta ${ruta} nije prisutna u portal baseline-u; browser pristup nije bio na ` +
            "ispitu. Kanonska full-session politika za buduće portal rute pokrivena je " +
            "unit testom.",
        );
        continue;
      }

      // Ruta postoji — od sada važi isto pravilo kao za obavezne.
      if (!(await sacekajRutu(page, MFA_RUTA))) {
        throw new Error(
          await dokazi(page, `${ruta} nije preusmerena na vezivanje`, nalozi.owner.id),
        );
      }
      provereneOpcione.push(ruta);
    }

    const ukupno = obavezne.length + provereneOpcione.length;
    const preskoceno = opcione.length - provereneOpcione.length;
    return (
      `${ukupno} ruta preusmereno na vezivanje` +
      (preskoceno > 0 ? `; ${preskoceno} još ne postoji (vidi ogradu)` : "")
    );
  });

  await tok("3. vezivanje kroz obrazac", async () => {
    const { code } = await issueEnrollmentGrant({ userId: nalozi.owner.id, issuedBy: null });

    await otvori(page, MFA_RUTA, 'input[name="password"]');
    await page.fill('input[name="password"]', nalozi.owner.password);
    const grantField = await page.$('input[name="grant"]');
    if (grantField) await grantField.fill(code);

    // Prvi korak obrasca: očekuje se prikaz ključa.
    await posalji(page, ["code[data-mfa-secret]"]);
    ownerSecret = await page.textContent("code[data-mfa-secret]");
    if (!ownerSecret) throw new Error(await dokazi(page, "ključ nije prikazan", nalozi.owner.id));

    // Drugi korak: potvrda kodom, očekuju se rezervni kodovi.
    // Isti brojač prozora kao i sve kasnije prijave — vidi `svezTotp`.
    await page.fill('input[name="token"]', await svezTotp(ownerSecret));
    await posalji(page, [".portal-recovery-list"]);

    ownerRecovery = await page.$$eval(".portal-recovery-list code", (n) =>
      n.map((x) => (x.textContent ?? "").trim()).filter(Boolean),
    );
    if (ownerRecovery.length !== 10) {
      throw new Error(
        await dokazi(page, `prikazano ${ownerRecovery.length} kodova umesto 10`, nalozi.owner.id),
      );
    }
    return `${ownerRecovery.length} rezervnih kodova`;
  });

  await tok("4. povratak Nazad ne vraca rezervne kodove", async () => {
    // Polazno stanje: ekran sa rezervnim kodovima je zaista pred nama.
    const kodoviPre = await page.locator(".portal-recovery-list code").count();
    if (kodoviPre !== ownerRecovery.length) {
      throw new Error(
        await dokazi(
          page,
          `pre odlaska vidljivo ${kodoviPre} kodova, očekivano ${ownerRecovery.length}`,
        ),
      );
    }

    // 1. Odlazak sa strane, pa povratak dugmetom „Nazad".
    await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
    await page.goBack({ waitUntil: "domcontentloaded" });

    /*
     * 2. Sačekati da se navigacija ZAVRŠI.
     *
     * Aplikacija sme da nas odmah preusmeri sa zastarele strane. Dok taj lanac
     * traje, izvršni kontekst se ruši i svako čitanje DOM-a puca sa
     * „Execution context was destroyed" — što je i bio uzrok ovog pada.
     */
    const zavrsna = await sacekajSmirenuAdresu(page);

    /*
     * 3. Sačekati jedinstven semantički marker završnog ekrana.
     *
     * Koji će biti, ne zna se unapred: strana za vezivanje sme da se ponovo
     * iscrta, da prikaže panel „Prikaz je uklonjen", ili da nas pošalje na
     * prijavu. Svaki je prihvatljiv — pod uslovom iz tačke 4.
     */
    await page
      .locator("h1, h2, .portal-login-form, .portal-enrollment-frame")
      .first()
      .waitFor({ state: "attached", timeout: AKCIJA_TIMEOUT_MS });

    /*
     * 4. Tek sada provere, i to preko locatora.
     *
     * Locator sam ponavlja pokušaj i preživljava navigaciju; `page.evaluate` se
     * izvršava tačno jednom, u kontekstu koji u tom trenutku možda više ne
     * postoji.
     */
    const vidljivih = await page.locator(".portal-recovery-list code").count();

    // Kod sme biti sakriven, a i dalje prisutan — zato i vidljiv tekst i ceo DOM.
    const vidljivTekst = await page.locator("body").innerText();
    const ceoDom = await page.locator("html").innerHTML();
    const procurelo = ownerRecovery.filter(
      (kod) => vidljivTekst.includes(kod) || ceoDom.includes(kod),
    );

    // Jednokratni ekran ne sme biti vraćen ni kao prazan okvir.
    const ekranKodova = await page.locator("[data-recovery-codes]").count();

    // 5. Dokaz o tipu navigacije — samo ako ga pretraživač daje.
    const nav = await page
      .evaluate(
        () =>
          (window as unknown as {
            __qaNav?: { pageshowPersisted: boolean | null; navType: string | null };
          }).__qaNav ?? null,
      )
      .catch(() => null);
    const izBfcache = nav?.pageshowPersisted === true;
    const tipNavigacije = nav?.navType ?? "nepoznat";

    if (vidljivih > 0 || procurelo.length > 0 || ekranKodova > 0) {
      throw new Error(
        await dokazi(
          page,
          `kodovi su vraćeni: vidljivih=${vidljivih} u_domu=${procurelo.length} ` +
            `ekran_kodova=${ekranKodova} bfcache=${izBfcache} tip=${tipNavigacije}`,
        ),
      );
    }

    await page.screenshot({ path: `${SHOTS}/02-after-back-1280.png`, fullPage: true });

    /*
     * Poruka razlikuje dva ishoda.
     *
     * Ako `pageshow.persisted` nije bio `true`, strana nije došla iz
     * back/forward keša — zaštita tada nije ni bila na ispitu. To se kaže
     * otvoreno, umesto da se obična navigacija predstavi kao dokaz.
     */
    const gde = zavrsna.replace(BASE, "");

    if (!izBfcache) {
      /*
       * Ograda, ne kvar.
       *
       * Tvrdnja „povratak ne vraća kodove" je ispunjena. Ali `pageshow.persisted`
       * nije bio `true`, pa strana nije došla iz back/forward keša — Chromium ju
       * je odbacio i ponovo iscrtao. Zaštita iz `useEphemeralReveal` tada nije
       * ni bila pozvana.
       *
       * Sam mehanizam je pokriven jediničnim testovima nad hookom; ovde se samo
       * beleži da ga OVAJ prolaz nije izazvao.
       */
      ograde.push(
        "BFCache restore nije izazvan u ovom prolazu " +
          `(pageshow.persisted=${nav?.pageshowPersisted ?? "nedostupno"}, tip=${tipNavigacije}). ` +
          "Tvrdnja da povratak ne vraća kodove je potvrđena; ponašanje pri stvarnom " +
          "vraćanju iz keša pokriveno je jediničnim testovima hooka.",
      );
    }

    return izBfcache
      ? `iz BFCache-a, nijedan kod nije vraćen (${gde})`
      : `nijedan kod nije vraćen (${gde}); vidi ogradu u sažetku`;
  });

  await tok("5. prijava kodom iz aplikacije", async () => {
    const s5 = await svezaSesija();
    try {
      const kod = await svezTotp(ownerSecret);
      const url = await prijava(s5.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (url.includes("/prijava")) {
        throw new Error(await dokazi(s5.page, "validan kod odbijen", nalozi.owner.id));
      }
      punaSesija = true;
      await s5.page.screenshot({ path: `${SHOTS}/03-portal-1280.png`, fullPage: true });
      return url.replace(BASE, "");
    } finally {
      await s5.zatvori();
    }
  });

  await tok("6. ponovljen kod se odbija", async () => {
    // Jedan svež kod, upotrebljen dva puta iz dva odvojena konteksta.
    const kod = await svezTotp(ownerSecret);

    const prvaSesija = await svezaSesija();
    try {
      const prvi = await prijava(prvaSesija.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (prvi.includes("/prijava")) {
        throw new Error(await dokazi(prvaSesija.page, "prvi pokušaj odbijen", nalozi.owner.id));
      }
    } finally {
      await prvaSesija.zatvori();
    }

    const drugaSesija = await svezaSesija();
    try {
      const drugi = await prijava(drugaSesija.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (!drugi.includes("/prijava")) {
        throw new Error(await dokazi(drugaSesija.page, "ponovljen kod je prošao", nalozi.owner.id));
      }
    } finally {
      await drugaSesija.zatvori();
    }
    return "drugi pokušaj odbijen";
  });

  await tok("7. prijava rezervnim kodom", async () => {
    const kod = ownerRecovery[0];
    // Dokaz da šaljemo tačno ono što je prikazano, bez ispisivanja koda.
    const oblik = kod.replace(/[A-Z2-9]/g, "X");
    const [{ neiskorisceno }] = await sql<{ neiskorisceno: number }[]>`
      SELECT count(*)::int AS neiskorisceno FROM mfa_recovery_codes
      WHERE user_id = ${nalozi.owner.id} AND used_at IS NULL
    `;

    const prva = await svezaSesija();
    try {
      const url = await prijava(prva.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (url.includes("/prijava")) {
        throw new Error(
          await dokazi(
            prva.page,
            `rezervni kod odbijen (oblik=${oblik}, neiskorišćenih=${neiskorisceno})`,
            nalozi.owner.id,
          ),
        );
      }
      punaSesija = true;
    } finally {
      await prva.zatvori();
    }

    // Isti kod drugi put mora pasti.
    const druga = await svezaSesija();
    try {
      const drugi = await prijava(druga.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (!drugi.includes("/prijava")) {
        throw new Error(await dokazi(druga.page, "potrošen rezervni kod je prošao", nalozi.owner.id));
      }
    } finally {
      await druga.zatvori();
    }
    return "jednokratnost potvrđena";
  });

  await tok("8. administracija naloga i izdavanje dozvole", async () => {
    const s8 = await svezaSesija();
    try {
      const kod = await svezTotp(ownerSecret);
      const url = await prijava(s8.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (url.includes("/prijava")) {
        throw new Error(await dokazi(s8.page, "prijava pred administraciju odbijena", nalozi.owner.id));
      }
      const nav = await otvori(s8.page, ADMIN_RUTA, ".portal-account-list");
      if (!nav.stigao || !s8.page.url().includes(ADMIN_RUTA)) {
        throw new Error(
          await dokazi(
            s8.page,
            `administracija nedostupna: HTTP=${nav.status} domcontentloaded=${nav.ms}ms ` +
              `spisak_naloga=${nav.stigao}`,
            nalozi.owner.id,
          ),
        );
      }
      await s8.page.screenshot({ path: `${SHOTS}/04-nalozi-1280.png`, fullPage: true });
      return `ekran dostupan (HTTP ${nav.status}, ${nav.ms} ms)`;
    } finally {
      await s8.zatvori();
    }
  });

  await tok("9. /prijava/reset radi i ne prima kod iz adrese", async () => {
    const res = await page.goto(`${BASE}/prijava/reset?code=ABCDE-FGHIJ`, {
      waitUntil: "domcontentloaded",
    });
    if (!res) throw new Error("strana nije odgovorila");
    if (res.status() !== 200) throw new Error(`HTTP ${res.status()}`);
    const vrednost = await page.inputValue('input[name="code"]');
    if (vrednost !== "") throw new Error("kod je popunjen iz adrese");
    await page.screenshot({ path: `${SHOTS}/05-reset-1280.png`, fullPage: true });
    return "200, polje prazno";
  });

  await tok("10. admin reset lozinke i postavljanje nove", async () => {
    const { code } = await issuePasswordResetCode({ userId: nalozi.worker.id, issuedBy: null });

    await otvori(page, "/prijava/reset", 'input[name="code"]');
    await page.fill('input[name="email"]', nalozi.worker.email);
    await page.fill('input[name="code"]', code);
    const nova = `qa-${randomBytes(12).toString("base64url")}`;
    await page.fill('input[name="password"]', nova);
    await page.fill('input[name="confirm"]', nova);
    /*
     * `a.portal-login-submit` postoji SAMO na uspešnom ekranu — tamo je veza ka
     * prijavi, dok je na obrascu dugme. Selektor koji postoji u oba stanja
     * (`.portal-login-form h2`) prošao bi odmah i test bi opet čitao ishod pre
     * nego što ga ima.
     */
    await posalji(page, ["a.portal-login-submit"]);

    const telo = await page.evaluate(() => document.body.innerText);
    if (!/Lozinka je postavljena/.test(telo)) {
      throw new Error(await dokazi(page, "nova lozinka nije prihvaćena", nalozi.worker.id));
    }
    nalozi.worker.password = nova;
    return "lozinka promenjena kodom";
  });

  await tok("11. deaktivacija odbija prijavu, reaktivacija je vraca", async () => {
    await sql`UPDATE users SET active = false, session_version = session_version + 1
              WHERE id = ${nalozi.worker.id}`;
    const iskljucenaSesija = await svezaSesija();
    try {
      const url = await prijava(
        iskljucenaSesija.page,
        nalozi.worker.email,
        nalozi.worker.password,
      );
      if (!url.includes("/prijava")) {
        throw new Error(
          await dokazi(iskljucenaSesija.page, "isključen nalog se prijavio", nalozi.worker.id),
        );
      }
    } finally {
      await iskljucenaSesija.zatvori();
    }

    await sql`UPDATE users SET active = true, session_version = session_version + 1
              WHERE id = ${nalozi.worker.id}`;

    /*
     * Serverska provera pre druge prijave.
     *
     * Korak 10 menja lozinku ovog naloga kroz oporavak, pa fixture vrednost
     * može zastareti. Ako je heš prestao da odgovara onome što runner šalje,
     * uzrok je u podacima — a ne u prijavi, i to mora biti vidljivo odmah.
     */
    const [stanje] = await sql<
      { active: boolean; password_hash: string; session_version: number; email: string }[]
    >`SELECT active, password_hash, session_version, email FROM users WHERE id = ${nalozi.worker.id}`;
    const lozinkaOdgovara = await verifyPassword(nalozi.worker.password, stanje.password_hash);
    const adresaOdgovara = stanje.email === nalozi.worker.email.trim().toLowerCase();
    if (!stanje.active || !lozinkaOdgovara || !adresaOdgovara) {
      throw new Error(
        `fixture ne odgovara bazi: active=${stanje.active} ` +
          `lozinka_odgovara=${lozinkaOdgovara} adresa_odgovara=${adresaOdgovara} ` +
          `session_version=${stanje.session_version}`,
      );
    }

    const vracenaSesija = await svezaSesija();
    try {
      const url = await prijava(
        vracenaSesija.page,
        nalozi.worker.email,
        nalozi.worker.password,
      );
      if (url.includes("/prijava")) {
        throw new Error(
          await dokazi(vracenaSesija.page, "vraćen nalog se ne prijavljuje", nalozi.worker.id),
        );
      }
    } finally {
      await vracenaSesija.zatvori();
    }
    return "oba smera potvrđena";
  });

  await tok("12. mobilni prikaz kljucnih ekrana", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ekrani = [
      ["/prijava", "10-prijava-390"],
      ["/prijava/reset", "11-reset-390"],
    ];
    for (const [ruta, ime] of ekrani) {
      await page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
      await page.screenshot({ path: `${SHOTS}/${ime}.png`, fullPage: true });
    }
    const s12 = await svezaSesija();
    try {
      await s12.page.setViewportSize({ width: 390, height: 844 });
      const kod = await svezTotp(ownerSecret);
      const url = await prijava(s12.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (url.includes("/prijava")) {
        throw new Error(await dokazi(s12.page, "mobilna prijava odbijena", nalozi.owner.id));
      }

      const zasticeni = [
        ["/portal/bezbednost/lozinka", "12-lozinka-390"],
        ["/portal/bezbednost/nalozi", "13-nalozi-390"],
        // Ekran za vezivanje je bio bez stilova; snimak ga sada prati.
        ["/portal/bezbednost/mfa", "14-mfa-390"],
      ];
      for (const [ruta, ime] of zasticeni) {
        await s12.page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
        const konacna = await sacekajSmirenuAdresu(s12.page);
        /*
         * Snimak nije dokaz sam po sebi.
         *
         * Ranije se samo snimalo; da je prijava pala, dobili bismo tri snimka
         * ekrana za prijavu i korak bi „prošao". Zato se prvo tvrdi da smo
         * zaista na traženoj strani.
         */
        if (!konacna.includes(ruta)) {
          throw new Error(await dokazi(s12.page, `${ruta} nije otvorena`, nalozi.owner.id));
        }
        await s12.page.screenshot({ path: `${SHOTS}/${ime}.png`, fullPage: true });
      }
      return `${ekrani.length + zasticeni.length} snimaka`;
    } finally {
      await s12.zatvori();
    }
  });

  await tok("13. javni sajt nije degradiran", async () => {
    for (const ruta of ["/", "/katalog", "/prodavnice"]) {
      const res = await page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
      if (!res) throw new Error(`${ruta} nije odgovorila`);
      if (res.status() !== 200) throw new Error(`${ruta} → HTTP ${res.status()}`);
      const cc = res.headers()["cache-control"] ?? "";
      if (!cc.includes("s-maxage")) throw new Error(`${ruta} je izgubio javni keš: ${cc}`);
    }
    return "keš javnih strana netaknut";
  });

  /* ===================================================================== *
   * Korpa portala (koraci 14–17)
   *
   * Korpa je lista za upit: nema cene, ukupnog iznosa, checkouta ni kreiranja
   * porudzbine. Cuva se iskljucivo u pretrazivacu, pod kljucem vezanim za UUID
   * prijavljenog korisnika. Ovi koraci dokazuju i bezbednosnu granicu i
   * izolaciju izmedju naloga.
   * ===================================================================== */

  await tok("14. korpa: vlasnik sa sposobnoscu je otvara, radnik je ne dobija", async () => {
    const s = await svezaSesija();
    try {
      const kod = await svezTotp(ownerSecret);
      const url = await prijava(s.page, nalozi.owner.email, nalozi.owner.password, kod);
      if (url.includes("/prijava")) {
        throw new Error(await dokazi(s.page, "vlasnik se nije prijavio", nalozi.owner.id));
      }

      const res = await s.page.goto(`${BASE}/portal/korpa`, {
        waitUntil: "domcontentloaded",
      });
      if ((res?.status() ?? 0) !== 200) {
        throw new Error(
          await dokazi(s.page, `vlasnik ne dobija korpu: HTTP ${res?.status()}`, nalozi.owner.id),
        );
      }
      const stanje = await s.page.evaluate(() => {
        /*
         * Tvrdnja je o SADRZAJU korpe, ne o okviru portala.
         *
         * Ranije se skenirao ceo `body`, pa je svaka stavka navigacije koja
         * sadrzi rec „cena" obarala proveru — a bocna traka nije korpa i nikad
         * nije bila deo tvrdnje. `main` je tacno ono sto ova ruta renderuje.
         */
        const sadrzaj =
          (document.querySelector("main") as HTMLElement | null)?.innerText ??
          document.body.innerText;
        return {
          naslov: document.querySelector("h1")?.textContent?.trim() ?? null,
          prazna: /nema izabranih|lista je prazna|prazn/i.test(sadrzaj),
          cena: /\bRSD\b|\bEUR\b|ukupno za napla|\bcena\b/i.test(sadrzaj),
          checkout: /checkout|plati|pla[ćc]anje|poru[dž]bina je/i.test(sadrzaj),
          kljucevi: Object.keys(window.localStorage).filter((k) =>
            k.startsWith("carsystem.cart"),
          ),
        };
      });
      if (stanje.cena) throw new Error(await dokazi(s.page, "korpa prikazuje cenu", nalozi.owner.id));
      if (stanje.checkout) {
        throw new Error(await dokazi(s.page, "korpa nudi checkout ili tvrdi porudzbinu", nalozi.owner.id));
      }
      // Kljuc mora nositi CEO UUID, ne skraceni otisak.
      for (const k of stanje.kljucevi) {
        if (!/^carsystem\.cart\.v3\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k)) {
          throw new Error(await dokazi(s.page, "cart kljuc nije v3 UUID namespace", nalozi.owner.id));
        }
      }
      return `korpa otvorena, prazna=${stanje.prazna}, bez cene i checkouta`;
    } finally {
      await s.zatvori();
    }
  });

  await tok("15. korpa: ucitavanje scoped zapisa, dve varijante, refresh cuva", async () => {
    const s = await svezaSesija();
    try {
      const kod = await svezTotp(ownerSecret);
      await prijava(s.page, nalozi.owner.email, nalozi.owner.password, kod);
      await s.page.goto(`${BASE}/portal/korpa`, { waitUntil: "domcontentloaded" });
      /*
       * Ceka se da se strana STVARNO montira pre upisa fixture zapisa.
       *
       * `domcontentloaded` je zavrsen pre nego sto React odradi efekte. Cart
       * sloj pri montiranju upisuje svoje pocetno (prazno) stanje pod isti
       * kljuc. Bez ovog cekanja upis testa i upis aplikacije se utrkuju, pa je
       * korak povremeno padao sa „refresh nije sacuvao dve stavke (0)" — bez
       * ikakve veze sa onim sto korak tvrdi. Isti obrazac cekanja koristi i
       * korak 17.
       */
      await s.page.waitForSelector("main h1", { timeout: AKCIJA_TIMEOUT_MS });

      /*
       * OGRADA: ovo NIJE dokaz dodavanja ni spajanja.
       *
       * U ovom commitu jos ne postoji produkcijski ulaz koji puni korpu — nema
       * „Dodaj u korpu" dugmeta ni na javnom sajtu ni u portalu. Zato runner
       * ne moze da klikne stvarnu putanju, pa upisuje fixture zapis pod
       * kljucem koji je APLIKACIJA vec napravila (format i vlasnik se ne
       * izmisljaju). Dokazuje se samo: ucitavanje scoped zapisa, prikaz dve
       * odvojene varijante i opstanak posle refresh-a.
       *
       * `addToCart` i spajanje iste varijante dokazuju izvrsni testovi u
       * `lib/cart/cart-model.test.mjs`. QA-only backdoor se namerno NE pravi.
       */
      const kljuc = await s.page.evaluate(
        () => Object.keys(window.localStorage).find((k) => k.startsWith("carsystem.cart.v3.")) ?? null,
      );
      if (!kljuc) throw new Error(await dokazi(s.page, "cart kljuc nije nastao", nalozi.owner.id));

      /*
       * Zapis se sastavlja i serijalizuje U NODE PROCESU.
       *
       * Prvi prolaz je ovde pao sa `ReferenceError: __name is not defined`.
       * Callback je imao lokalnu imenovanu funkciju (`const stavka = …`), a tsx
       * je pod `--keep-names` obavija esbuild helperom `__name`. Playwright
       * salje telo funkcije kao tekst; helper ostaje u Node modulu i u
       * pretrazivacu ga nema.
       *
       * Zato browser callback prima gotov string i radi jednu jedinu stvar.
       * Bez lokalnih funkcija, bez `map`/`filter` callbacka, bez zatvorenih
       * promenljivih i bez uvezenih helpera.
       */
      const zapis = JSON.stringify({
        items: ["35-M1010", "35-M1021"].map((variantId) => ({
          id: `baslac-line-35::${variantId}`,
          productSlug: "baslac-line-35",
          familySlug: "baslac-line-35",
          variantId,
          sku: variantId,
          name: `Baslac ${variantId}`,
          image: null,
          volume: "3,5 L",
          brandSlug: "baslac",
          inventoryKey: null,
          quantity: 2,
        })),
      });
      await s.page.evaluate(
        (a: [string, string]) => window.localStorage.setItem(a[0], a[1]),
        [kljuc, zapis] as [string, string],
      );

      /*
       * Potvrda da je upis stvarno legao, pre nego sto se strana ponovo ucita.
       *
       * Ako je aplikacija u medjuvremenu pregazila kljuc, greska mora reci
       * TO — a ne da refresh nije sacuvao stavke, sto bi optuzilo pogresan kod.
       */
      const preRefresh = await s.page.evaluate(
        (k) => JSON.parse(window.localStorage.getItem(k) ?? "{}").items?.length ?? 0,
        kljuc,
      );
      if (preRefresh !== 2) {
        throw new Error(
          await dokazi(
            s.page,
            `fixture nije legao pre refresh-a (${preRefresh}) — cart sloj je pregazio kljuc`,
            nalozi.owner.id,
          ),
        );
      }

      await s.page.reload({ waitUntil: "domcontentloaded" });
      await s.page.waitForSelector("main h1", { timeout: AKCIJA_TIMEOUT_MS });
      const posle = await s.page.evaluate((k) => {
        const zapis = JSON.parse(window.localStorage.getItem(k) ?? "{}");
        return {
          stavki: zapis.items?.length ?? 0,
          idjevi: (zapis.items ?? []).map((i: { id: string }) => i.id),
          // Samo boolean: sadrzaj korpe se ne ispisuje.
          kolicineOk: (zapis.items ?? []).every(
            (i: { quantity: number }) => Number.isInteger(i.quantity) && i.quantity >= 1,
          ),
        };
      }, kljuc);

      if (posle.stavki !== 2) {
        throw new Error(await dokazi(s.page, `refresh nije sacuvao dve stavke (${posle.stavki})`, nalozi.owner.id));
      }
      if (new Set(posle.idjevi).size !== 2) {
        throw new Error(await dokazi(s.page, "dve varijante dele identitet", nalozi.owner.id));
      }
      ograde.push(
        "Korak 15 NE dokazuje dodavanje ni spajanje: u ovom commitu nema produkcijskog " +
          "ulaza koji puni korpu, pa je zapis upisan kao fixture pod kljucem aplikacije. " +
          "Dokazano je ucitavanje scoped zapisa, dve odvojene varijante i persistence posle " +
          "refresh-a. add/merge logiku pokrivaju izvrsni testovi lib/cart/cart-model.test.mjs.",
      );
      return `refresh cuva ${posle.stavki} odvojene stavke, sve sa validnom kolicinom=${posle.kolicineOk}`;
    } finally {
      await s.zatvori();
    }
  });

  await tok("16. korpa: isti context, A -> B -> A, bez curenja izmedju naloga", async () => {
    /*
     * Zasto ovaj korak postoji pored 14 i 15.
     *
     * Koraci 14, 15, 17 i 18 svaki uzimaju SVEZ kontekst, pa drugi nalog uvek
     * zatekne prazan `localStorage`. Time se dokazuje da nema curenja kroz
     * mrezu ili server, ali NE dokazuje ono sto je zaista u pitanju: deljeni
     * racunar, gde posle odjave u istom pretrazivacu ostaje sve sto je
     * prethodni korisnik zapisao.
     *
     * Zato ceo scenario zivi u JEDNOM kontekstu, a izmedju prijava se namerno
     * NE poziva `context.clearCookies()`, `context.clearPermissions()` ni
     * `localStorage.clear()` i ne pravi se nov kontekst. Zaostali zapis je
     * predmet testa, ne smetnja.
     *
     * Odjava ide kroz stvarni tok aplikacije — dugme u `PortalShell` koje gadja
     * `signOutAction` — a ne kroz brisanje kolacica iz test koda.
     */
    const setup2 = await beginMfaEnrollment({
      userId: nalozi.owner2.id,
      accountLabel: nalozi.owner2.email,
    });
    const potvrda2 = await confirmMfaEnrollment({
      userId: nalozi.owner2.id,
      token: await svezTotp(setup2.base32),
    });
    if (!potvrda2.ok) throw new Error("drugi vlasnik nije vezao drugi faktor");

    /* Markeri postoje samo da bi se curenje moglo prepoznati; ne ispisuju se. */
    const MARKER_A = "QA-KORPA-ALFA";
    const MARKER_B = "QA-KORPA-BETA";

    const s = await svezaSesija();
    try {
      const UUID_KLJUC =
        /^carsystem\.cart\.v3\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

      /** Kljucevi ostaju u Node-u radi poredjenja; nikada ne idu u izlaz. */
      const cartKljucevi = (): Promise<string[]> =>
        s.page.evaluate(() =>
          Object.keys(window.localStorage).filter((k) => k.startsWith("carsystem.cart")),
        );

      const prijaviSe = async (nalog: { email: string; password: string; id: string }, base32: string) => {
        const url = await prijava(s.page, nalog.email, nalog.password, await svezTotp(base32));
        if (url.includes("/prijava")) {
          throw new Error(await dokazi(s.page, "prijava u deljenom contextu nije prosla", nalog.id));
        }
      };

      const otvoriKorpu = async () => {
        const res = await s.page.goto(`${BASE}/portal/korpa`, { waitUntil: "domcontentloaded" });
        if ((res?.status() ?? 0) !== 200) {
          throw new Error(await dokazi(s.page, `korpa nije otvorena: HTTP ${res?.status()}`));
        }
        await s.page.waitForSelector("main h1", { timeout: AKCIJA_TIMEOUT_MS });
      };

      /** Sta korisnik VIDI: broj prikazanih stavki i da li se vidi tudji marker. */
      const vidljivo = (tudjiMarker: string) =>
        s.page.evaluate((marker: string) => {
          const tekst = document.body.innerText;
          return {
            stavki: document.querySelectorAll("main ul li").length,
            tudje: tekst.includes(marker),
          };
        }, tudjiMarker);

      /**
       * Fixture zapis pod kljucem koji je APLIKACIJA napravila (vidi ogradu u koraku 15).
       *
       * Serijalizacija ide u Node-u; browser callback je primitivan iz istog
       * razloga kao u koraku 15 (`__name`).
       */
      const upisiFixture = async (kljuc: string, marker: string, varijante: string[]) => {
        const zapis = JSON.stringify({
          items: varijante.map((variantId) => ({
            id: `baslac-line-35::${variantId}`,
            productSlug: "baslac-line-35",
            familySlug: "baslac-line-35",
            variantId,
            sku: variantId,
            name: `${marker} ${variantId}`,
            image: null,
            volume: "3,5 L",
            brandSlug: "baslac",
            inventoryKey: null,
            quantity: 1,
          })),
        });
        await s.page.evaluate(
          (a: [string, string]) => window.localStorage.setItem(a[0], a[1]),
          [kljuc, zapis] as [string, string],
        );
        await s.page.reload({ waitUntil: "domcontentloaded" });
        await s.page.waitForSelector("main h1", { timeout: AKCIJA_TIMEOUT_MS });
      };

      /**
       * Ima li auth endpoint jos uvek korisnika.
       *
       * `page.request` deli kolacice sa kontekstom, pa ovo cita BAS onu sesiju
       * koju nosi pretrazivac — bez diranja kolacica.
       */
      const sesijaAktivna = async (): Promise<boolean> => {
        const r = await s.page.request.get(`${BASE}/api/auth/session`);
        if (!r.ok()) return false;
        const telo = (await r.text()).trim();
        if (telo === "" || telo === "null" || telo === "{}") return false;
        try {
          const j = JSON.parse(telo) as { user?: unknown } | null;
          return Boolean(j && j.user);
        } catch {
          return false;
        }
      };

      /** Postoji li auth session kolacic. Vraca SAMO boolean — ni ime ni vrednost. */
      const imaSessionCookie = async (): Promise<boolean> =>
        (await s.page.context().cookies(BASE)).some((c) =>
          /(?:^|-)authjs\.session-token$/.test(c.name),
        );

      /**
       * Obavezna kapija PRE klika na odjavu.
       *
       * Bez nje klik ne dokazuje nista. Zasebna privremena dijagnostika je pala
       * bas ovde: prijava nije bila gotova, pa je „logout ne radi" zapravo
       * znacilo „korisnik nije ni bio prijavljen". Kapija tu razliku cini
       * nemogucom — ako preduslov ne stoji, korak pada kao PRECONDITION, ne kao
       * kvar odjave.
       */
      const preduslovOdjave = async () => {
        const ruta = new URL(s.page.url()).pathname;
        const imaUser = await sesijaAktivna();
        const imaCookie = await imaSessionCookie();
        const pogodaka = await s.page.evaluate(
          () => document.querySelectorAll('form button[aria-label="Odjava"]').length,
        );
        const vidljiv = await s.page
          .isVisible('form button[aria-label="Odjava"]')
          .catch(() => false);
        const zasticena = await s.page.request.get(`${BASE}/portal/korpa`);
        const status = zasticena.status();

        if (!imaUser || !imaCookie || pogodaka !== 1 || !vidljiv || status !== 200) {
          throw new Error(
            await dokazi(
              s.page,
              "PRECONDITION FAILED — LOGIN: " +
                `ruta=${ruta} sesija_user=${imaUser} session_cookie=${imaCookie} ` +
                `logout_pogodaka=${pogodaka} logout_vidljiv=${vidljiv} ` +
                `zasticena_ruta=HTTP ${status}`,
              nalozi.owner.id,
            ),
          );
        }
        return { ruta, pogodaka };
      };

      /**
       * Odjava kroz STVARNI tok aplikacije, uz tri odvojeno merena dokaza.
       *
       * Zasto ne `waitForFunction`
       * --------------------------
       * Ranija verzija je cekala `location.pathname` in-page pollerom i hvatala
       * svaki ishod sa `.catch(() => false)`. Serverska akcija rusi izvrsni
       * kontekst pri navigaciji, pa poller odbija sa „Execution context was
       * destroyed" — a `catch` je tu gresku pretvarao u „nije zavrsila na
       * prijavi", iako je odjava uspela. Poruka je opisivala pogresan dogadjaj.
       *
       * Sada se meri sa Node strane i razdvojeno, da bi se faza kvara videla iz
       * samog izlaza:
       *   sesija_aktivna=true                → produkcijski logout defekt
       *   sesija ugasena, url_na_prijavi=false → produkcijski redirect/cache defekt
       *   sve tri ok                          → odjava je stvarno prosla
       * Neuspeh selektora ne stize dovde — `waitForSelector` pada sa svojom porukom.
       */
      const odjava = async () => {
        // Kapija PRE svega: klik na odjavu nema smisla bez dokazane sesije.
        await preduslovOdjave();

        // Kursor se resetuje NEPOSREDNO pre klika: dokaz ovog koraka ne sme
        // nositi lanac prijave A ni namerno odbijene prijave iz koraka 6 i 11.
        resetDijagnostiku();

        /*
         * Kolektori se kace tek sada i skidaju odmah posle klika.
         *
         * Bez toga bi u snimku bili i zahtevi prijave A. Odgovori se skupljaju
         * kao objekti pa citaju POSLE cekanja: Playwright ne ceka async
         * slusaoce, a `headersArray()` je async.
         */
        const postovi: string[] = [];
        const odgovori: import("playwright-core").Response[] = [];
        const greske: string[] = [];
        const onReq = (r: import("playwright-core").Request) => {
          if (r.method() !== "POST") return;
          const h = r.headers();
          postovi.push(
            `${new URL(r.url()).pathname} next-action=${h["next-action"] ? "da" : "ne"}`,
          );
        };
        const onRes = (r: import("playwright-core").Response) => {
          if (r.request().method() === "POST") odgovori.push(r);
        };
        const onErr = (e: Error) => greske.push(e.message.slice(0, 160));
        const onCon = (m: import("playwright-core").ConsoleMessage) => {
          if (m.type() === "error") greske.push(m.text().slice(0, 160));
        };
        s.page.on("request", onReq);
        s.page.on("response", onRes);
        s.page.on("pageerror", onErr);
        s.page.on("console", onCon);

        const dugme = await s.page.waitForSelector('form button[aria-label="Odjava"]', {
          timeout: AKCIJA_TIMEOUT_MS,
        });
        await dugme.click();

        /*
         * 1) Stanje ODMAH posle klika, PRE ijedne dalje navigacije.
         *
         * Ranije se konacna adresa citala tek posle probe zasticene rute, pa je
         * dokaz nosio ishod te probe umesto ishoda odjave. Ove dve vrednosti se
         * od sada cuvaju odvojeno i prva se nikada ne prepisuje drugom.
         */
        const posleKlika = await sacekajPutanju(s.page, "/prijava");
        const urlPosleKlika = posleKlika.url;
        const pathPosleKlika = new URL(urlPosleKlika, BASE).pathname;
        // Ugovor je PUTANJA; `?callbackUrl=…` je dozvoljen i nije pad.
        const urlNaPrijavi = jeLoginPathname(urlPosleKlika);

        // Sta korisnik STVARNO vidi na toj adresi.
        const prikaz = await s.page.evaluate(() => ({
          loginForma:
            document.querySelector('input[name="email"]') !== null &&
            document.querySelector('input[name="password"]') !== null,
          portalSadrzaj: document.querySelector(".portal-shell, [data-portal-nav]") !== null,
          odjavaDugmadi: document.querySelectorAll('form button[aria-label="Odjava"]').length,
          naslov: (document.querySelector("h1, h2")?.textContent ?? "").trim().slice(0, 40),
        }));

        // 2) Sesija na auth endpointu.
        let aktivna = true;
        const kraj = Date.now() + AKCIJA_TIMEOUT_MS;
        while (Date.now() < kraj) {
          aktivna = await sesijaAktivna();
          if (!aktivna) break;
          await s.page.waitForTimeout(250);
        }

        s.page.off("request", onReq);
        s.page.off("response", onRes);
        s.page.off("pageerror", onErr);
        s.page.off("console", onCon);

        // 3) Auth session kolacic i zasticena ruta — odvojeno, TEK SADA.
        const cookiePosle = await imaSessionCookie();
        await s.page.goto(`${BASE}/portal/korpa`, { waitUntil: "domcontentloaded" });
        const posleProvere = await sacekajPutanju(s.page, "/prijava");
        const urlPosleProvere = posleProvere.url;
        const rutaVraca = jeLoginPathname(urlPosleProvere);

        if (
          aktivna ||
          cookiePosle ||
          !urlNaPrijavi ||
          !prikaz.loginForma ||
          prikaz.portalSadrzaj ||
          !rutaVraca
        ) {
          /*
           * Snimak mreze se cita SAMO kada odjava padne.
           *
           * Iz njega se vidi koji je clan lanca popustio: nema POST-a → forma
           * nije poslata; POST bez `next-action` → nije server akcija; POST sa
           * greskom → server akcija; POST 200 bez brisanja kolacica → `signOut`
           * ili konfiguracija kolacica; brisanje pa ponovno postavljanje →
           * nesto na odgovoru vraca sesiju.
           */
          const snimak: string[] = [];
          for (const r of odgovori) {
            let hs: { name: string; value: string }[] = [];
            try {
              hs = await r.headersArray();
            } catch {
              /* odgovor vise nije dostupan */
            }
            const lok = hs.find((h) => /^(location|x-action-redirect)$/i.test(h.name));
            // Iz Set-Cookie se uzimaju SAMO ime i da li taj zapis brise kolacic.
            const kolacici = hs
              .filter((h) => h.name.toLowerCase() === "set-cookie")
              .map((h) => ({
                ime: h.value.split("=")[0].trim(),
                brise:
                  /;\s*Max-Age=0\b/i.test(h.value) ||
                  /;\s*Expires=Thu, 01 Jan 1970/i.test(h.value) ||
                  /^[^=]+=;/.test(h.value),
              }));
            snimak.push(
              `${new URL(r.url()).pathname} → ${r.status()} ` +
                `redirect=${lok ? new URL(lok.value, BASE).pathname : "(nema)"} ` +
                `set-cookie=${JSON.stringify(kolacici)}`,
            );
          }

          throw new Error(
            await dokazi(
              s.page,
              "odjava nije potvrdjena: " +
                `sesija_aktivna=${aktivna} session_cookie_ostao=${cookiePosle} ` +
                `pathname_odmah_posle_klika=${pathPosleKlika} ` +
                `url_na_prijavi=${urlNaPrijavi} ` +
                `login_forma_vidljiva=${prikaz.loginForma} ` +
                `portal_sadrzaj_vidljiv=${prikaz.portalSadrzaj} ` +
                `odjava_dugmadi=${prikaz.odjavaDugmadi} naslov="${prikaz.naslov}" | ` +
                `pathname_posle_provere_zasticene_rute=${new URL(urlPosleProvere, BASE).pathname} ` +
                `zasticena_ruta_vraca_na_prijavu=${rutaVraca} | ` +
                `POST=${postovi.length ? JSON.stringify(postovi) : "(nijedan)"} | ` +
                `odgovori=${snimak.length ? JSON.stringify(snimak) : "(nijedan)"} | ` +
                `greske=${greske.length ? JSON.stringify(greske.slice(-3)) : "(nema)"}`,
            ),
          );
        }
      };

      /* ---- A: prva prijava u praznom contextu ---- */
      await prijaviSe(nalozi.owner, ownerSecret!);
      await otvoriKorpu();
      const kljuceviA = await cartKljucevi();
      if (kljuceviA.length !== 1 || !UUID_KLJUC.test(kljuceviA[0])) {
        throw new Error(await dokazi(s.page, "A nije dobio tacno jedan v3 UUID namespace", nalozi.owner.id));
      }
      await upisiFixture(kljuceviA[0], MARKER_A, ["35-M1010", "35-M1021"]);
      const aPrvi = await vidljivo(MARKER_B);
      if (aPrvi.stavki !== 2) {
        throw new Error(await dokazi(s.page, `A ne vidi svoje dve stavke (${aPrvi.stavki})`, nalozi.owner.id));
      }

      /* ---- odjava kroz aplikaciju; NISTA se ne cisti ---- */
      await odjava();
      const posleOdjave = await cartKljucevi();
      if (posleOdjave.length !== 1) {
        /*
         * Ako zapis nestane pri odjavi, test vise ne meri ono zbog cega postoji:
         * B bi zatekao cist storage i „izolacija" bi bila lazna.
         */
        throw new Error(
          await dokazi(s.page, "zapis A je nestao pri odjavi — scenario vise ne meri deljeni racunar"),
        );
      }

      /* ---- B: druga prijava u ISTOM contextu ---- */
      await prijaviSe(nalozi.owner2, setup2.base32);
      await otvoriKorpu();
      const bPrazan = await vidljivo(MARKER_A);
      if (bPrazan.stavki !== 0 || bPrazan.tudje) {
        throw new Error(
          await dokazi(s.page, "B vidi stavke naloga A u istom contextu", nalozi.owner2.id),
        );
      }
      const kljuceviB = await cartKljucevi();
      const noviB = kljuceviB.filter((k) => !kljuceviA.includes(k));
      if (kljuceviB.length !== 2 || noviB.length !== 1 || !UUID_KLJUC.test(noviB[0])) {
        throw new Error(
          await dokazi(s.page, "B nije dobio sopstveni v3 UUID namespace", nalozi.owner2.id),
        );
      }
      await upisiFixture(noviB[0], MARKER_B, ["35-M2200"]);
      const bSvoj = await vidljivo(MARKER_A);
      if (bSvoj.stavki !== 1 || bSvoj.tudje) {
        throw new Error(
          await dokazi(s.page, `B ne vidi tacno svoju stavku (${bSvoj.stavki})`, nalozi.owner2.id),
        );
      }

      /* ---- povratak na A u ISTOM contextu ---- */
      await odjava();
      await prijaviSe(nalozi.owner, ownerSecret!);
      await otvoriKorpu();
      const aPovratak = await vidljivo(MARKER_B);
      if (aPovratak.stavki !== 2 || aPovratak.tudje) {
        throw new Error(
          await dokazi(s.page, `A po povratku ne vidi samo svoje (${aPovratak.stavki})`, nalozi.owner.id),
        );
      }

      /* Samo broj; same vrednosti kljuceva ostaju u Node-u i ne ispisuju se. */
      const odvojenihNamespacea = kljuceviB.length;

      /*
       * OGRADA: ovo je izolacija po nalogu unutar JEDNOG pretrazivaca, ne
       * bezbednosna granica. `localStorage` je citljiv svakome ko ima pristup
       * profilu na tom racunaru. Trajna, serverska korpa po korisniku/tenantu
       * je posao buduce faze.
       */
      ograde.push(
        "Korak 16 dokazuje izolaciju po nalogu unutar jednog pretrazivaca. `localStorage` " +
          "nije bezbednosna granica: zapis ostaje citljiv svakome sa pristupom profilu na tom " +
          "racunaru. Serverska korpa po korisniku/tenantu je posao buduce faze.",
      );

      return (
        `isti context: A=${aPrvi.stavki} stavke, B posle prijave=${bPrazan.stavki} ` +
        `(tudje vidljivo=${bPrazan.tudje}), B svoje=${bSvoj.stavki}, ` +
        `A po povratku=${aPovratak.stavki} (tudje vidljivo=${aPovratak.tudje}), ` +
        `odvojenih namespace-a=${odvojenihNamespacea}`
      );
    } finally {
      await s.zatvori();
    }
  });

  await tok("17. korpa: komercijalista bez sposobnosti je ne dobija", async () => {
    // Radnik dobija svoj drugi faktor kroz isti servis koji koristi i obrazac.
    const setup = await beginMfaEnrollment({
      userId: nalozi.worker.id,
      accountLabel: nalozi.worker.email,
    });
    const workerTotp = await svezTotp(setup.base32);
    const potvrda = await confirmMfaEnrollment({ userId: nalozi.worker.id, token: workerTotp });
    if (!potvrda.ok) throw new Error("radnicki nalog nije vezao drugi faktor");

    const s = await svezaSesija();
    try {
      const kod = await svezTotp(setup.base32);
      const url = await prijava(s.page, nalozi.worker.email, nalozi.worker.password, kod);
      if (url.includes("/prijava")) {
        throw new Error(await dokazi(s.page, "radnik se nije prijavio", nalozi.worker.id));
      }

      /*
       * Radnik je `komercijalista` — nema `customer_orders:create`. Korpa mu se
       * ne sme otvoriti, a odbijanje ne sme procuriti poslovni sadrzaj.
       */
      const res = await s.page.goto(`${BASE}/portal/korpa`, { waitUntil: "domcontentloaded" });
      const status = res?.status() ?? 0;
      const sadrzaj = await s.page.evaluate(() => ({
        cartKontrola: document.querySelectorAll('[data-cart],[aria-label*="korp" i]').length,
        stavke: /Baslac 35-M10/i.test(document.body.innerText),
        kljucevi: Object.keys(window.localStorage).filter((k) => k.startsWith("carsystem.cart")),
      }));

      if (status === 200 && sadrzaj.cartKontrola > 0) {
        throw new Error(await dokazi(s.page, "radnik bez dozvole dobio korpu", nalozi.worker.id));
      }
      if (sadrzaj.stavke) {
        throw new Error(await dokazi(s.page, "radnik vidi stavke drugog naloga", nalozi.worker.id));
      }
      return `radnik odbijen (HTTP ${status}), bez tudjih stavki i bez cart kontrola`;
    } finally {
      await s.zatvori();
    }
  });

  await tok("18. korpa: javne strane ne montiraju cart sloj", async () => {
    const s = await svezaSesija();
    try {
      for (const ruta of ["/", "/brendovi/baslac", "/proizvodi/grupa/baslac-line-35", "/katalog"]) {
        const res = await s.page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
        if ((res?.status() ?? 0) !== 200) throw new Error(`${ruta} → HTTP ${res?.status()}`);
        const v = await s.page.evaluate(() => ({
          cartKontrola: document.querySelectorAll('[data-cart],[aria-label*="korp" i],[data-cart-count]').length,
          dodaj: /dodaj u korpu|quick ?add/i.test(document.body.innerText),
          storage: Object.keys(window.localStorage).filter((k) => k.startsWith("carsystem.cart")),
        }));
        if (v.cartKontrola > 0 || v.dodaj) {
          throw new Error(await dokazi(s.page, `${ruta} ima cart kontrolu`));
        }
        if (v.storage.length > 0) {
          throw new Error(await dokazi(s.page, `${ruta} pise cart localStorage`));
        }
      }
      return "4 javne rute bez cart sloja i bez localStorage zapisa";
    } finally {
      await s.zatvori();
    }
  });
} catch (error) {
  zabelezi("runner", false, (error as Error).message);
} finally {
  if (browser) await browser.close();
  /*
   * Briše se samo ono što SME da se obriše.
   *
   * Nalozi koji su usput ušli u trag revizije ostaju — trag je nepromenljiv i
   * `ON DELETE RESTRICT` to čini izričitim. Njih uklanja `qa:pg:reset` pred
   * sledeći prolaz. Greška se ne guta: put je izabran tako da je nema.
   */
  await ocistiSlobodne();
  await sql.end();
  server.kill("SIGTERM");
}

const pali = rezultati.filter((r) => !r.ok && !r.blokiran);
const blokirani = rezultati.filter((r) => r.blokiran);
const prosli = rezultati.filter((r) => r.ok);

console.log(
  `\nUKUPNO ${rezultati.length}: prošlo ${prosli.length}, palo ${pali.length}, ` +
    `blokirano ${blokirani.length}`,
);
if (pali.length > 0) {
  console.log("\nStvarni padovi (uzroci):");
  for (const r of pali) console.log(`  - ${r.tok}: ${r.detalj}`);
}
if (ograde.length > 0) {
  console.log("\nOgrade pokrivenosti (prošlo, ali nije bilo na punom ispitu):");
  for (const o of ograde) console.log(`  - ${o}`);
}
if (blokirani.length > 0) {
  // Blokirani nisu nezavisni kvarovi — posledica su nekog od padova iznad.
  console.log("\nBlokirano nedostajućim preduslovom (posledica, ne zaseban kvar):");
  for (const r of blokirani) console.log(`  - ${r.tok}`);
}
console.log(`\nSnimci: ${SHOTS}/`);
process.exit(pali.length === 0 && blokirani.length === 0 ? 0 : 1);
