import { randomUUID } from "node:crypto";
import { posaljiPotpisano } from "./client.mjs";
import { STANJA } from "./outcomes.mjs";
import { KOD_POPIS_PREKINUT, posaljiIzReda, skenirajURed } from "./pipeline.mjs";

/**
 * Ručne komande: preuzimanje, izvršenje i izveštaj napretka.
 *
 * Komanda pokreće ISTI P3 ciklus koji radi i `run-once`. Server ne šalje
 * program, putanju ni argument — samo identitet i zatvoren tip. Šta
 * `scan_and_sync` znači, zna konektor.
 *
 * Ručna komanda zaobilazi SAMO čekanje do 09:00. Ne zaobilazi bravu, stabilnost
 * fajla, granice, validaciju, idempotentnost ni kontrolisana odbijanja.
 */

/** Jedini tip koji konektor izvršava. Nepoznat se odbija, ne tumači. */
export const PODRZAN_TIP = "scan_and_sync";
export const PODRZANA_VERZIJA = 1;

/* =========================================================================
 * Ritam pitanja
 * ====================================================================== */

/**
 * Interval pitanja kada je sve u redu.
 *
 * 45 s ± jitter: dovoljno da čovek ne čeka minutima posle klika, a daleko od
 * opterećenja — jedan uređaj, jedan zahtev. Bez jitter-a bi se više uređaja
 * (ili isti posle restarta) poravnalo u isti trenutak.
 */
export const OSNOVNI_INTERVAL_MS = 45_000;
const JITTER_MS = 15_000;

/**
 * Backoff kada server ne odgovara ili je uređaj blokiran.
 *
 * Bez njega bi konektor bez interneta pitao svakih 45 s zauvek i punio log.
 * Gornja granica je 30 min — posle toga nema svrhe dalje usporavati.
 */
const MAX_BACKOFF_MS = 30 * 60_000;

export function sledeciInterval({ neuspeha, random = Math.random }) {
  if (neuspeha <= 0) {
    return OSNOVNI_INTERVAL_MS + Math.floor(random() * JITTER_MS);
  }
  const eksponent = Math.min(neuspeha, 6);
  const osnovni = Math.min(OSNOVNI_INTERVAL_MS * 2 ** eksponent, MAX_BACKOFF_MS);
  // Jitter i ovde: sinhronizovani retry je sam po sebi mali napad na server.
  return osnovni + Math.floor(random() * JITTER_MS);
}

/* =========================================================================
 * Poll
 * ====================================================================== */

/**
 * Pita ima li komande i TRAJNO je upisuje pre izvršenja.
 *
 * Upis pre izvršenja je suština: server je već označio komandu kao preuzetu, pa
 * restart bez lokalnog zapisa značio bi da konektor za nju ne zna, a portal
 * pokazuje „preuzeto“.
 */
export async function preuzmiKomandu({ store, konfiguracija, kljuc, fetchImpl, dozvoliHttp }) {
  const odgovor = await posaljiPotpisano({
    origin: konfiguracija.serverOrigin,
    zastitaPristupa: konfiguracija.vercelZastita ?? null,
    path: "/api/sync/commands/poll",
    bodyBytes: new TextEncoder().encode("{}"),
    deviceCode: konfiguracija.deviceCode,
    keyId: konfiguracija.keyId,
    privateKeyPkcs8Der: kljuc,
    timeoutMs: konfiguracija.timeoutMs,
    fetchImpl,
    dozvoliHttp,
  });

  if (odgovor.transport !== "ok") {
    return { ishod: "nedostupno", razlog: odgovor.razlog };
  }
  if (odgovor.httpStatus === 404 || odgovor.code === "not_found") {
    // Gate je isključen — nije kvar, ali ni prilika za dalje pitanje.
    return { ishod: "iskljuceno" };
  }
  if (odgovor.httpStatus !== 200) {
    return { ishod: "odbijeno", razlog: odgovor.code ?? `http_${odgovor.httpStatus}` };
  }
  if (odgovor.code === "no_command") return { ishod: "nema" };
  if (odgovor.code !== "command") {
    // Nepoznat odgovor NIKAD ne pokreće posao.
    return { ishod: "odbijeno", razlog: `nepoznat_kod:${odgovor.code}` };
  }

  const k = odgovor.command;
  if (!k || typeof k.id !== "string") {
    return { ishod: "odbijeno", razlog: "komanda_bez_id" };
  }
  /*
   * Nepoznat tip ili verzija se NE izvršava.
   *
   * Server stariji ili noviji od konektora ne sme da ga natera na posao koji
   * ovaj kod ne razume.
   */
  if (k.type !== PODRZAN_TIP || k.version !== PODRZANA_VERZIJA) {
    return { ishod: "nepodrzana", id: k.id, razlog: "unsupported_command" };
  }

  const { komanda } = store.preuzmiKomandu({
    id: k.id,
    tip: k.type,
    verzija: k.version,
    isticeU: String(k.expiresAt ?? ""),
  });
  return { ishod: "komanda", komanda };
}

/* =========================================================================
 * Izveštaj napretka
 * ====================================================================== */

/**
 * Šalje jedan događaj i pamti da je poslat.
 *
 * `eventId` nastaje LOKALNO i čuva se pre slanja. Zato je ponovljeno slanje
 * posle izgubljenog odgovora idempotentno: server prepoznaje isti ID i ne
 * upisuje ga dvaput.
 */
export async function posaljiDogadjaj({
  store,
  konfiguracija,
  kljuc,
  dogadjaj,
  fetchImpl,
  dozvoliHttp,
}) {
  const telo = JSON.stringify({
    commandId: dogadjaj.komanda_id,
    eventId: dogadjaj.event_id,
    status: dogadjaj.stanje,
    sequence: dogadjaj.sekvenca,
    ...(dogadjaj.failure_code ? { failureCode: dogadjaj.failure_code } : {}),
    counters: JSON.parse(dogadjaj.brojaci),
  });

  const odgovor = await posaljiPotpisano({
    origin: konfiguracija.serverOrigin,
    zastitaPristupa: konfiguracija.vercelZastita ?? null,
    path: "/api/sync/commands/update",
    bodyBytes: new TextEncoder().encode(telo),
    deviceCode: konfiguracija.deviceCode,
    keyId: konfiguracija.keyId,
    privateKeyPkcs8Der: kljuc,
    timeoutMs: konfiguracija.timeoutMs,
    fetchImpl,
    dozvoliHttp,
  });

  if (odgovor.transport !== "ok") return { poslat: false, razlog: odgovor.razlog };

  /*
   * `recorded` i `already_recorded` su OBA uspeh.
   *
   * Drugo znači da je raniji pokušaj stigao a odgovor se izgubio — tačno ono
   * zbog čega `eventId` postoji.
   */
  if (odgovor.httpStatus === 200 && ["recorded", "already_recorded"].includes(odgovor.code)) {
    store.potvrdiDogadjaj(dogadjaj.id);
    return { poslat: true, kod: odgovor.code };
  }

  /*
   * Konflikt se NE ponavlja u petlji: server je odbio prelaz ili je komanda
   * terminalna. Događaj se označava potvrđenim da ne bi zauvek visio, a razlog
   * ostaje u odgovoru.
   */
  if (odgovor.httpStatus === 409) {
    store.potvrdiDogadjaj(dogadjaj.id);
    return { poslat: false, konflikt: true, razlog: odgovor.code };
  }

  return { poslat: false, razlog: odgovor.code ?? `http_${odgovor.httpStatus}` };
}

/** Ponovo šalje sve što nije potvrđeno — poziva se pri svakom prolazu. */
export async function posaljiNepotvrdjene(ctx) {
  const cekaju = ctx.store.nepotvrdjeniDogadjaji();
  let poslato = 0;
  for (const d of cekaju) {
    const rez = await posaljiDogadjaj({ ...ctx, dogadjaj: d });
    if (rez.poslat) poslato += 1;
    else if (!rez.konflikt) break; // Mreža ne radi; ostalo čeka sledeći prolaz.
  }
  return { cekalo: cekaju.length, poslato };
}

/* =========================================================================
 * Izvršenje
 * ====================================================================== */

/**
 * Lokalni ishodi → stanje komande.
 *
 * Razlika koja se lako izgubi: dokument koji je otišao na ručni pregled, ostao
 * nemapiran ili je lokalno nepodržan NIJE običan uspeh. Zato `completed` traži
 * da ničega od toga nema.
 *
 * Isto važi za nepotpun popis: poslato je sve što je VIĐENO, ali nije viđeno
 * sve. Prekinut popis je `failed`; nedostupan folder je bar
 * `completed_with_review`. Oba nose kod u `failureCode`.
 */
export function stanjeZaIshod({ skeniranje, slanje }) {
  if (slanje.zaustavljeno) {
    /*
     * Ciklus je prekinut zbog opoziva, pomerenog sata, rate limita ili
     * isključenog gate-a. To je blokada podešavanja/ovlašćenja, ne neuspeh
     * dokumenta.
     */
    return { stanje: "blocked", failureCode: slanje.zaustavljeno };
  }
  const kodPopisa = skeniranje.kodPopisa ?? null;
  if (kodPopisa === KOD_POPIS_PREKINUT) {
    return { stanje: "failed", failureCode: kodPopisa };
  }
  if (slanje.odlozeno > 0 || skeniranje.preostalo > 0 || slanje.ostaloURedu > 0) {
    /*
     * Ostalo je posla za sledeći ciklus: neslate stavke, dokumenti iznad
     * budžeta ili red koji serija slanja nije ispraznila. Tokom backfill-a
     * `completed` bi tvrdilo da je istorija gotova, a nije.
     */
    return { stanje: "retry_pending", failureCode: kodPopisa };
  }
  if (kodPopisa) {
    // Ceo podfolder nije pročitan; „završeno“ bi tvrdilo da jeste.
    return { stanje: "completed_with_review", failureCode: kodPopisa };
  }
  if (slanje.zaPregled > 0 || slanje.odbijeno > 0 || skeniranje.nepodrzano > 0) {
    /*
     * Ciklus JESTE završen, ali deo dokumenata čeka čoveka. `completed` bi ovde
     * značilo „sve je knjiženo“, a nije.
     */
    return { stanje: "completed_with_review", failureCode: null };
  }
  return { stanje: "completed", failureCode: null };
}

/** Brojači za izveštaj — odvojeni, jer znače različite stvari. */
export function brojaciZa({ skeniranje, slanje }) {
  return {
    foundCount: skeniranje.pregledano ?? 0,
    readCount: (skeniranje.novo ?? 0) + (skeniranje.poznato ?? 0),
    postedCount: slanje.potvrdjeno ?? 0,
    duplicateCount: 0,
    reviewCount: slanje.zaPregled ?? 0,
    unsupportedCount: skeniranje.nepodrzano ?? 0,
    /*
     * Sve što čeka sledeći ciklus: red posle slanja (on već sadrži odložene
     * stavke) i novi dokumenti iznad budžeta, koji još nisu u redu.
     */
    pendingCount: (slanje.ostaloURedu ?? slanje.odlozeno ?? 0) + (skeniranje.preostalo ?? 0),
    blockedCount: slanje.zaustavljeno ? 1 : 0,
  };
}

/**
 * Izvršava jednu komandu kroz postojeći P3 ciklus.
 *
 * Pozivalac je već uzeo bravu. Komanda ne otvara drugi konkurentni scan — ako
 * neki ciklus već radi, ovaj poziv se uopšte ne dešava.
 */
export async function izvrsiKomandu(ctx) {
  const { store, konfiguracija, kljuc, komanda, lokalniDatum } = ctx;

  // 1. „Počeo sam.“ Događaj se upisuje lokalno pa šalje.
  const start = store.dodajDogadjaj({
    komandaId: komanda.id,
    eventId: `evt-${randomUUID()}`,
    stanje: "running",
    brojaci: brojaciZa({ skeniranje: {}, slanje: {} }),
  });
  await posaljiDogadjaj({ ...ctx, dogadjaj: start });

  // 2. Isti P3 ciklus kao `run-once`.
  const skeniranje = await skenirajURed({
    store,
    konfiguracija,
    // Samo testovi prosleđuju granice; `undefined` znači podrazumevane.
    granice: ctx.granice,
    log: ctx.log,
  });
  const slanje = await posaljiIzReda({
    store,
    konfiguracija,
    kljuc,
    lokalniDatum,
    fetchImpl: ctx.fetchImpl,
    dozvoliHttp: ctx.dozvoliHttp,
    log: ctx.log,
  });

  // 3. Terminalni ishod.
  const { stanje, failureCode } = stanjeZaIshod({ skeniranje, slanje });
  const kraj = store.dodajDogadjaj({
    komandaId: komanda.id,
    eventId: `evt-${randomUUID()}`,
    stanje,
    failureCode,
    brojaci: brojaciZa({ skeniranje, slanje }),
  });
  const poslat = await posaljiDogadjaj({ ...ctx, dogadjaj: kraj });

  /*
   * Komanda se lokalno zatvara i kada odgovor nije stigao.
   *
   * Događaj ostaje nepotvrđen i biće poslat ponovo sa ISTIM `eventId`; posao je
   * već obavljen i ne sme se izvršiti drugi put.
   */
  store.zavrsiKomandu({ id: komanda.id, stanje, failureCode });

  return { stanje, failureCode, skeniranje, slanje, ackPoslat: poslat.poslat === true };
}

/** Stanja iz kojih lokalna komanda više ne izlazi. */
export const LOKALNA_ZAVRSNA = Object.freeze([
  "completed",
  "completed_with_review",
  "retry_pending",
  "failed",
  "blocked",
]);

export { STANJA };
