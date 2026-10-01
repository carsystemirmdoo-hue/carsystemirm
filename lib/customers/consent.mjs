/**
 * Saglasnosti kupca — čista pravila, bez baze.
 *
 * Model je append-only: povlačenje NE briše raniji pristanak nego dodaje nov
 * događaj. Trenutno stanje se zato uvek IZVODI, nikad ne čita iz kolone koju bi
 * neko mogao da prepiše. Kolona bi bila brža; ali kolona ne može da odgovori na
 * pitanje „kada je pristanak dat i kada povučen", koje je jedino pitanje koje
 * pravni pregled zaista postavlja.
 */

/**
 * Svrhe su ODVOJENE odluke.
 *
 * E-pošta i oglasna publika nisu isto: kupac sme da pristane da prima
 * obaveštenja, a da ne pristane da njegovi podaci uđu u publiku oglasne
 * platforme. Jedan checkbox za oboje bi tu razliku ukinuo, a razlika je upravo
 * ono što ga štiti.
 */
export const CONSENT_PURPOSES = ["email_marketing", "ad_personalization"];

export const CONSENT_ACTIONS = ["granted", "withdrawn"];

export const CONSENT_SOURCES = [
  "customer_self_service",
  "office_recorded_offline",
];

/**
 * Tekstovi saglasnosti po verziji. Zapis u bazi čuva samo oznaku verzije
 * (`consent_text_version`), zato se tekst jednom objavljene verzije NIKAD ne
 * menja — nova formulacija dobija novu verziju i važi samo za nove odluke.
 */
export const CONSENT_TEXT_VERSIONS = {
  "2026-08-v1": {
    email_marketing: {
      title: "Obaveštenja o proizvodima i akcijama e-poštom",
      body:
        "Pristajem da mi Carsystem i R-M Inđija d.o.o. šalje obaveštenja o " +
        "proizvodima, akcijama i tehničkim novostima na moju poslovnu e-poštu. " +
        "Saglasnost mogu povući u bilo kom trenutku, jednako lako kao što sam je dao.",
    },
    ad_personalization: {
      title: "Prilagođavanje oglasa",
      body:
        "Pristajem da se moji kontakt podaci koriste za prilagođavanje oglasa na " +
        "spoljnim platformama. Ovo je odvojena odluka od obaveštenja e-poštom i " +
        "mogu je povući nezavisno.",
    },
  },
  // Odluka vlasnika 2026-10-01: pun pravni naziv i rodno neutralan završetak.
  // Preporučena je naknadna pravna revizija (nije tehnička prepreka).
  "2026-10-v2": {
    email_marketing: {
      title: "Obaveštenja o proizvodima i akcijama e-poštom",
      body:
        "Pristajem da mi CAR SYSTEM I R-M d.o.o. Inđija na moju poslovnu e-poštu " +
        "šalje obaveštenja o proizvodima, akcijama i tehničkim novostima. " +
        "Saglasnost je dobrovoljna i mogu je povući u bilo kom trenutku, jednako " +
        "jednostavno kao što je data.",
    },
    ad_personalization: {
      title: "Prilagođavanje oglasa",
      body:
        "Pristajem da se moji kontakt podaci koriste za prilagođavanje oglasa na " +
        "spoljnim platformama. Ovo je odvojena odluka od obaveštenja e-poštom i " +
        "mogu je povući nezavisno.",
    },
  },
};

/** Verzija teksta koja se prikazuje uz NOVU odluku i upisuje uz nju. */
export const CURRENT_CONSENT_TEXT_VERSION = "2026-10-v2";

/** Tekst za novu odluku (trenutna verzija). */
export const CONSENT_LABELS = CONSENT_TEXT_VERSIONS[CURRENT_CONSENT_TEXT_VERSION];

/**
 * Tekst koji je kupac video uz odluku date verzije; `null` za nepoznatu verziju
 * (nikad ne zamenjuje nepoznatu verziju trenutnim tekstom).
 *
 * @param {string} purpose
 * @param {string | null | undefined} version
 */
export function consentLabelFor(purpose, version) {
  if (!version) return null;
  return CONSENT_TEXT_VERSIONS[version]?.[purpose] ?? null;
}

export class ConsentError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.name = "ConsentError";
    this.code = code;
  }
}

/**
 * Podrazumevano stanje: BEZ pristanka.
 *
 * Postoji kao funkcija, a ne kao literal razbacan po ekranima, da bi „prazno
 * znači ne" bilo jedna tvrdnja pod testom. Odsustvo događaja nije nepoznato
 * stanje — to je odbijanje.
 */
export function defaultConsentState() {
  const state = {};
  for (const purpose of CONSENT_PURPOSES) {
    state[purpose] = { granted: false, since: null, textVersion: null, source: null };
  }
  return state;
}

/**
 * Izvodi trenutno stanje iz append-only istorije.
 *
 * Merodavan je POSLEDNJI događaj po svrsi, određen rastućim `id`-em — ne
 * `occurred_at`. Vreme sme da se poklopi ili da stigne van redosleda kod
 * offline evidentiranja; redni broj upisa ne može.
 *
 * @param {readonly {purpose: string, action: string, id: number,
 *   occurredAt?: Date|string|null, consentTextVersion?: string|null,
 *   source?: string|null}[]} events
 */
export function effectiveConsents(events) {
  const state = defaultConsentState();
  const latest = new Map();

  for (const event of events ?? []) {
    if (!CONSENT_PURPOSES.includes(event.purpose)) continue;
    if (!CONSENT_ACTIONS.includes(event.action)) continue;
    const current = latest.get(event.purpose);
    if (!current || Number(event.id) > Number(current.id)) {
      latest.set(event.purpose, event);
    }
  }

  for (const [purpose, event] of latest) {
    state[purpose] = {
      granted: event.action === "granted",
      since: event.occurredAt ?? null,
      textVersion: event.consentTextVersion ?? null,
      source: event.source ?? null,
    };
  }
  return state;
}

/**
 * Razlog odbijanja upisa, ili `null`.
 *
 * @param {object} input
 * @param {string} input.purpose
 * @param {string} input.action
 * @param {string} input.source
 * @param {string | null | undefined} input.consentTextVersion
 * @param {string | null | undefined} [input.recordedBy]
 * @param {string | null | undefined} [input.note]
 * @returns {string | null}
 */
export function rejectConsentEvent({
  purpose,
  action,
  source,
  consentTextVersion,
  recordedBy,
  note,
}) {
  if (!CONSENT_PURPOSES.includes(purpose)) {
    return `Nepoznata svrha saglasnosti „${purpose}".`;
  }
  if (!CONSENT_ACTIONS.includes(action)) {
    return `Nepoznata radnja „${action}".`;
  }
  if (!CONSENT_SOURCES.includes(source)) {
    return `Nepoznat izvor „${source}".`;
  }
  if (!consentTextVersion || String(consentTextVersion).trim() === "") {
    return "Saglasnost mora nositi verziju teksta koji je kupcu prikazan.";
  }
  /*
   * Offline zapis MORA imati čoveka iza sebe I referencu na zahtev.
   *
   * Raniji model je offline povlačenje zabranjivao, sa namerom da spreči da
   * neko drugi odlučuje umesto kupca. Ishod je bio suprotan: kupac koji opozove
   * saglasnost telefonom, e-poštom ili pisanim zahtevom nije mogao biti
   * evidentiran, pa bi u sistemu i dalje stajao kao saglasan. Teže pravilo je
   * proizvodilo netačan zapis.
   *
   * Zaštita je zato pomerena sa ZABRANE na DOKAZ: ko tvrdi da je kupac doneo
   * odluku van sistema, mora reći ko je to evidentirao i odakle to zna.
   */
  if (source === "office_recorded_offline") {
    if (!recordedBy) {
      return "Offline evidentirana odluka mora imati korisnika koji je evidentira.";
    }
    if (!note || String(note).trim().length < 3) {
      return "Offline evidentirana odluka mora imati referencu na zahtev (najmanje 3 znaka).";
    }
  }
  return null;
}

/**
 * Da li bi zapis samo ponovio ono što već važi.
 *
 * Append-only dnevnik beleži PROMENE odluke, ne ponovljene tvrdnje o istoj.
 * Bez ovoga bi dvaput kliknuto „povuci" ostavilo dva identična reda, a spisak
 * koji se puni istim redom prestaje da bude čitljiv kao istorija odluka.
 *
 * Verzija teksta je deo poređenja namerno: isti ishod po NOVOM tekstu jeste
 * nova odluka i mora se zabeležiti, jer pravni pregled pita po kom je tekstu
 * pristanak dat.
 *
 * @param {{ granted: boolean, textVersion: string | null } | undefined} current
 * @param {{ action: string, consentTextVersion: string }} incoming
 * @returns {boolean}
 */
export function isRedundantConsentEvent(current, incoming) {
  if (!current) return false;
  const sameOutcome = current.granted === (incoming.action === "granted");
  const sameText = current.textVersion === incoming.consentTextVersion;
  return sameOutcome && sameText;
}

/**
 * Da li je marketinška saglasnost uslov za bilo šta poslovno.
 *
 * Uvek `false`, i postoji da bi odgovor bio na jednom mestu i pod testom. B2B
 * nalog se otvara zbog posla; vezivanje pristupa za pristanak na oglase
 * pretvorilo bi „dobrovoljno" u cenu ulaska.
 */
export function consentRequiredForAccount() {
  return false;
}

/**
 * Da li interni korisnik sme sam da UKLJUČI tuđu saglasnost.
 *
 * Uvek `false` za samovoljno uključivanje. Kancelarija sme da EVIDENTIRA
 * odluku koju je kupac stvarno doneo van sistema — i pristanak i povlačenje —
 * ali to traži izvor `office_recorded_offline`, potpis i referencu na zahtev,
 * što `rejectConsentEvent` zahteva.
 *
 * Razlika je između „odlučujem umesto kupca" (nikad) i „zapisujem šta je kupac
 * odlučio" (uz dokaz).
 */
export function staffMayGrantUnilaterally() {
  return false;
}
