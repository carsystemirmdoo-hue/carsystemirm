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

/** Verzija teksta koji je kupcu prikazan uz odluku. */
export const CURRENT_CONSENT_TEXT_VERSION = "2026-08-v1";

export const CONSENT_LABELS = {
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
};

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
 * @returns {string | null}
 */
export function rejectConsentEvent({
  purpose,
  action,
  source,
  consentTextVersion,
  recordedBy,
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
   * Offline evidentiran pristanak MORA imati čoveka iza sebe.
   *
   * Bez toga bi u istoriji stajao pristanak koji tvrdi da je dat van sistema, a
   * niko ne odgovara za tu tvrdnju — što je tačno oblik zapisa koji pravni
   * pregled ne prihvata.
   */
  if (source === "office_recorded_offline" && !recordedBy) {
    return "Offline evidentiran pristanak mora imati korisnika koji ga evidentira.";
  }
  /*
   * Povlačenje se NE evidentira offline.
   *
   * Kupac mora moći da povuče pristanak jednako lako kao što ga je dao; kada bi
   * povlačenje smelo da bude „evidentirano u kancelariji", nastao bi put u kome
   * neko drugi odlučuje da je kupac ipak pristao. Davanje sme offline (potpisan
   * formular), povlačenje ide kroz kupčev nalog.
   */
  if (source === "office_recorded_offline" && action === "withdrawn") {
    return "Povlačenje saglasnosti kupac radi sam, kroz svoj nalog.";
  }
  return null;
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
 * Uvek `false` za samovoljno uključivanje. Kancelarija sme da evidentira
 * pristanak koji je kupac stvarno dao van sistema — ali to traži izvor
 * `office_recorded_offline` i potpis, što `rejectConsentEvent` zahteva.
 */
export function staffMayGrantUnilaterally() {
  return false;
}
