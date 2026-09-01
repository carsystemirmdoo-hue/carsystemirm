import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID, sign as cryptoSign } from "node:crypto";
import test, { after, before, beforeEach } from "node:test";
import {
  cleanupQa,
  closeTestDatabase,
  ensureTestCryptoEnv,
  initTestDatabase,
  seedAccounts,
  skipReason,
  type TestDatabase,
} from "./harness.mts";

/**
 * Ručne komande konektoru — nad STVARNIM rukovaocima i pravim PostgreSQL-om.
 *
 * Testira se ono što odlučuje da li će posao na kancelarijskom računaru biti
 * pokrenut dvaput, nikad, ili tačno jednom — i da li server ikada može da
 * pošalje uređaju nešto što liči na uputstvo.
 *
 * Svi uređaji, ključevi i komande su SINTETIČKI i nastaju u ovom procesu.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let office: { id: string; name: string; role: string };

const ISSUER = "QA01";
const BASE = "https://qa.invalid";

function noviPar() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    publicKeySpki: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  /*
   * OBA gate-a se pale isključivo ovde.
   *
   * Podrazumevano su isključeni; poslednja grupa testova to i dokazuje tako što
   * ih privremeno gasi.
   */
  process.env.FEATURE_SYNC_DEVICE_INGEST = "1";
  process.env.FEATURE_SYNC_OPERATIONS = "1";
  db = await initTestDatabase();
  const a = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "office", role: "kancelarija" },
  ]);
  owner = { id: a.owner.id, name: a.owner.name, role: a.owner.role };
  office = { id: a.office.id, name: a.office.name, role: a.office.role };
});

after(async () => {
  if (!reason && db) {
    await ocisti();
    await cleanupQa(db);
  }
  delete process.env.FEATURE_SYNC_DEVICE_INGEST;
  delete process.env.FEATURE_SYNC_OPERATIONS;
  await closeTestDatabase();
});

async function ocisti() {
  /*
   * `TRUNCATE`, ne `DELETE`.
   *
   * `sync_command_events` je append-only i okidač odbija brisanje po redu — što
   * i treba. `TRUNCATE` ne pokreće okidače nad redovima, pa se zaštita ne gasi
   * ni na trenutak; test niže i dalje dokazuje da `DELETE` pada.
   */
  await db.sql.unsafe(
    `TRUNCATE TABLE "sync_command_events", "sync_commands", "sync_request_nonces",
       "sync_device_keys", "sync_devices", "auth_rate_limits", "audit_log"
     RESTART IDENTITY CASCADE`,
  );
}

beforeEach(async () => {
  if (!reason) await ocisti();
});

/* =========================================================================
 * Pomoćno
 * ====================================================================== */

async function aktivanUredjaj(kod = `dev-${randomUUID().slice(0, 8)}`) {
  const { registerDevice, activateDevice } = await import("@/lib/sync/device/registry");
  const par = noviPar();
  const out = await registerDevice(
    {
      deviceCode: kod,
      label: "QA uređaj",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: par.publicKeySpki,
    },
    owner,
  );
  await activateDevice(
    { deviceId: out.deviceId, keyId: "k1", expectedFingerprint: out.fingerprint },
    owner,
  );
  return { ...out, ...par, deviceCode: kod };
}

type Uredjaj = Awaited<ReturnType<typeof aktivanUredjaj>>;

async function potpisanZahtev(
  uredjaj: Uredjaj,
  path: string,
  body: unknown,
  opcije: { nonce?: string; timestamp?: string; keyId?: string } = {},
) {
  const { bodyHash, HEADERS, PROTOCOL_VERSION, signingString } = await import(
    "@/lib/sync/device/signing.mjs"
  );
  const telo = JSON.stringify(body ?? {});
  const bajtovi = new TextEncoder().encode(telo);
  const otisak = bodyHash(bajtovi);
  const nonce = opcije.nonce ?? randomBytes(16).toString("hex");
  const timestamp = opcije.timestamp ?? new Date().toISOString();
  const keyId = opcije.keyId ?? "k1";

  const niz = signingString({
    version: PROTOCOL_VERSION,
    deviceId: uredjaj.deviceCode,
    keyId,
    method: "POST",
    path,
    timestamp,
    nonce,
    bodyHash: otisak,
  });
  const potpis = cryptoSign(null, Buffer.from(niz, "utf8"), uredjaj.privateKey).toString("base64");

  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [HEADERS.version]: PROTOCOL_VERSION,
      [HEADERS.device]: uredjaj.deviceCode,
      [HEADERS.key]: keyId,
      [HEADERS.timestamp]: timestamp,
      [HEADERS.nonce]: nonce,
      [HEADERS.bodyHash]: otisak,
      [HEADERS.signature]: potpis,
    },
    body: telo,
  });
}

const poll = async () => (await import("@/app/api/sync/commands/poll/route")).POST;
const update = async () => (await import("@/app/api/sync/commands/update/route")).POST;
const telo = async (res: Response) => (await res.json()) as Record<string, unknown>;

const BROJACI = {
  foundCount: 2,
  readCount: 2,
  postedCount: 2,
  duplicateCount: 0,
  reviewCount: 0,
  unsupportedCount: 0,
  pendingCount: 0,
  blockedCount: 0,
};

/* =========================================================================
 * Zakazivanje
 * ====================================================================== */

test("dvostruki klik daje JEDNU komandu, ne dve", async (t) => {
  if (guard(t)) return;
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();

  /*
   * Paralelno, ne uzastopno.
   *
   * Uzastopni pozivi bi prošli i kroz običnu aplikativnu proveru; dva
   * istovremena submit-a hvata samo delimičan jedinstveni indeks u bazi.
   */
  const [a, b] = await Promise.all([
    zakaziKomandu({ deviceId: u.deviceId }, owner),
    zakaziKomandu({ deviceId: u.deviceId }, owner),
  ]);

  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sync_commands`;
  assert.equal(n, 1, "otvorena komanda se duplirala");
  assert.equal(a.commandId, b.commandId);
  assert.ok(a.vecPostoji || b.vecPostoji, "jedan poziv je morao prepoznati postojeću");
});

test("komanda neaktivnom i nepostojećem uređaju se odbija", async (t) => {
  if (guard(t)) return;
  const { zakaziKomandu, CommandError } = await import("@/lib/sync/commands/service");
  const { registerDevice } = await import("@/lib/sync/device/registry");

  // Registrovan ali NEAKTIVAN: komanda bi zauvek čekala i ličila na kvar.
  const par = noviPar();
  const neaktivan = await registerDevice(
    {
      deviceCode: `dev-${randomUUID().slice(0, 8)}`,
      label: "Neaktivan",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: par.publicKeySpki,
    },
    owner,
  );

  await assert.rejects(
    () => zakaziKomandu({ deviceId: neaktivan.deviceId }, owner),
    (e: unknown) => e instanceof CommandError && e.code === "device_not_active",
  );
  await assert.rejects(
    () => zakaziKomandu({ deviceId: randomUUID() }, owner),
    (e: unknown) => e instanceof CommandError && e.code === "device_not_found",
  );
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sync_commands`;
  assert.equal(n, 0);
});

test("opseg i naručilac dolaze sa uređaja i naloga, ne iz poziva", async (t) => {
  if (guard(t)) return;
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  const { commandId } = await zakaziKomandu({ deviceId: u.deviceId }, office);

  const [red] = await db.sql<
    { source_system: string; issuer_code: string; requested_by: string; command_type: string }[]
  >`SELECT source_system, issuer_code, requested_by, command_type
      FROM sync_commands WHERE id = ${commandId}`;
  assert.equal(red.source_system, "biznisoft");
  assert.equal(red.issuer_code, ISSUER);
  assert.equal(red.requested_by, office.id);
  assert.equal(red.command_type, "scan_and_sync");
});

/* =========================================================================
 * Poll
 * ====================================================================== */

test("poll vraća zatvoren opis komande, bez ijednog uputstva", async (t) => {
  if (guard(t)) return;
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  await zakaziKomandu({ deviceId: u.deviceId }, owner);

  const res = await (await poll())(await potpisanZahtev(u, "/api/sync/commands/poll", {}));
  const body = await telo(res);
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.code, "command");

  const k = body.command as Record<string, unknown>;
  /*
   * Tačno četiri polja.
   *
   * Svako dodatno polje je prilika da server pošalje putanju, URL ili podešavanje
   * koje bi uređaj protumačio kao uputstvo — pa se lista zaključava ovde.
   */
  assert.deepEqual(Object.keys(k).sort(), ["expiresAt", "id", "type", "version"]);
  assert.equal(k.type, "scan_and_sync");
  assert.equal(k.version, 1);

  const serijalizovano = JSON.stringify(body);
  for (const zabranjeno of ["path", "folder", "url", "command_line", "script", "argv", "env"]) {
    assert.ok(
      !serijalizovano.toLowerCase().includes(zabranjeno),
      `odgovor nosi „${zabranjeno}“`,
    );
  }
});

test("prazan red daje `no_command`, ne grešku", async (t) => {
  if (guard(t)) return;
  const u = await aktivanUredjaj();
  const res = await (await poll())(await potpisanZahtev(u, "/api/sync/commands/poll", {}));
  assert.equal(res.status, 200);
  assert.equal((await telo(res)).code, "no_command");
});

test("dva istovremena poll-a ne dobijaju istu komandu dvaput", async (t) => {
  if (guard(t)) return;
  const { preuzmiKomandu, zakaziKomandu } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  await zakaziKomandu({ deviceId: u.deviceId }, owner);

  /*
   * Servis se ovde zove direktno da bi oba poziva zaista bila istovremena:
   * kroz HTTP bi ih anti-replay razdvojio pre nego što stignu do lease-a.
   */
  const now = new Date();
  const [a, b] = await Promise.all([
    preuzmiKomandu({ deviceId: u.deviceId, now }),
    preuzmiKomandu({ deviceId: u.deviceId, now }),
  ]);

  /*
   * Isti uređaj SME da dobije istu komandu ponovo (nastavak posle restarta);
   * ono što se dokazuje jeste da nikad ne postoje DVE komande.
   */
  const dobijene = [a, b].filter(Boolean);
  assert.ok(dobijene.length >= 1);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sync_commands`;
  assert.equal(n, 1);
  if (a && b) assert.equal(a.id, b.id);
});

test("uređaj ne vidi TUĐU komandu", async (t) => {
  if (guard(t)) return;
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");
  const prvi = await aktivanUredjaj();
  const drugi = await aktivanUredjaj();
  await zakaziKomandu({ deviceId: prvi.deviceId }, owner);

  const res = await (await poll())(await potpisanZahtev(drugi, "/api/sync/commands/poll", {}));
  assert.equal((await telo(res)).code, "no_command", "uređaj je dobio tuđu komandu");
});

test("istekla komanda se ne izvršava kad neko upali računar", async (t) => {
  if (guard(t)) return;
  const { preuzmiKomandu, zakaziKomandu } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  const { commandId } = await zakaziKomandu({ deviceId: u.deviceId }, owner);
  await db.sql`UPDATE sync_commands SET expires_at = now() - interval '1 day' WHERE id = ${commandId}`;

  assert.equal(await preuzmiKomandu({ deviceId: u.deviceId }), null);
  const [red] = await db.sql<{ status: string; failure_code: string | null }[]>`
    SELECT status, failure_code FROM sync_commands WHERE id = ${commandId}`;
  assert.equal(red.status, "expired");
  assert.equal(red.failure_code, "expired");
});

test("opozvan uređaj ne dobija komandu", async (t) => {
  if (guard(t)) return;
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");
  const { revokeDevice } = await import("@/lib/sync/device/registry");
  const u = await aktivanUredjaj();
  await zakaziKomandu({ deviceId: u.deviceId }, owner);

  // Opoziv usred posla: sledeći poll mora pasti na autentifikaciji.
  await revokeDevice({ deviceId: u.deviceId, reason: "QA opoziv" }, owner);

  const res = await (await poll())(await potpisanZahtev(u, "/api/sync/commands/poll", {}));
  assert.ok(res.status === 401 || res.status === 403, `neočekivan status ${res.status}`);
});

test("ponovljen nonce je replay i na poll-u", async (t) => {
  if (guard(t)) return;
  const u = await aktivanUredjaj();
  const nonce = randomBytes(16).toString("hex");
  const timestamp = new Date().toISOString();

  const prvi = await (await poll())(
    await potpisanZahtev(u, "/api/sync/commands/poll", {}, { nonce, timestamp }),
  );
  assert.equal(prvi.status, 200);

  const drugi = await (await poll())(
    await potpisanZahtev(u, "/api/sync/commands/poll", {}, { nonce, timestamp }),
  );
  assert.equal(drugi.status, 409, "isti nonce je prošao drugi put");
});

/* =========================================================================
 * Update
 * ====================================================================== */

async function otvorenaKomanda(u: Uredjaj) {
  const { zakaziKomandu, preuzmiKomandu } = await import("@/lib/sync/commands/service");
  await zakaziKomandu({ deviceId: u.deviceId }, owner);
  const k = await preuzmiKomandu({ deviceId: u.deviceId });
  assert.ok(k);
  return k;
}

test("ponovljen ACK je idempotentan, isti ID sa drugim sadržajem je konflikt", async (t) => {
  if (guard(t)) return;
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);
  const dogadjaj = {
    commandId: k.id,
    eventId: "evt-11111111",
    status: "completed",
    sequence: 2,
    counters: BROJACI,
  };

  const prvi = await (await update())(
    await potpisanZahtev(u, "/api/sync/commands/update", dogadjaj),
  );
  assert.equal((await telo(prvi)).code, "recorded");

  // Isti ID, isti sadržaj: izgubljen odgovor, ne novi događaj.
  const drugi = await (await update())(
    await potpisanZahtev(u, "/api/sync/commands/update", dogadjaj),
  );
  assert.equal(drugi.status, 200);
  assert.equal((await telo(drugi)).code, "already_recorded");

  // Isti ID, DRUGI sadržaj: dva različita događaja tvrde isti identitet.
  const treci = await (await update())(
    await potpisanZahtev(u, "/api/sync/commands/update", {
      ...dogadjaj,
      counters: { ...BROJACI, postedCount: 99 },
    }),
  );
  assert.equal(treci.status, 409);
  assert.equal((await telo(treci)).code, "event_id_content_mismatch");

  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sync_command_events`;
  assert.equal(n, 1, "idempotentan ACK je upisao drugi red");
});

test("terminalna komanda se ne otvara ponovo", async (t) => {
  if (guard(t)) return;
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);

  await (await update())(
    await potpisanZahtev(u, "/api/sync/commands/update", {
      commandId: k.id, eventId: "evt-aaaaaaaa", status: "completed", sequence: 1, counters: BROJACI,
    }),
  );

  const posle = await (await update())(
    await potpisanZahtev(u, "/api/sync/commands/update", {
      commandId: k.id, eventId: "evt-bbbbbbbb", status: "running", sequence: 2, counters: BROJACI,
    }),
  );
  assert.equal(posle.status, 409);
  assert.equal((await telo(posle)).code, "command_terminal");
});

test("unazadan prelaz se odbija", async (t) => {
  if (guard(t)) return;
  const { primiNapredak } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);

  await primiNapredak({
    commandId: k.id, actorDeviceId: u.deviceId, clientEventId: "evt-cccccccc",
    status: "running", sequence: 1, counters: BROJACI,
  });
  // `delivered` posle `running` bi vratio komandu unazad.
  const ishod = await primiNapredak({
    commandId: k.id, actorDeviceId: u.deviceId, clientEventId: "evt-dddddddd",
    status: "delivered" as never, sequence: 2, counters: BROJACI,
  });
  assert.equal(ishod.result, "konflikt");
});

test("uređaj ne može da zatvori TUĐU komandu", async (t) => {
  if (guard(t)) return;
  const prvi = await aktivanUredjaj();
  const drugi = await aktivanUredjaj();
  const k = await otvorenaKomanda(prvi);

  // Potpis je ispravan — ali pripada drugom uređaju.
  const res = await (await update())(
    await potpisanZahtev(drugi, "/api/sync/commands/update", {
      commandId: k.id, eventId: "evt-eeeeeeee", status: "completed", sequence: 1, counters: BROJACI,
    }),
  );
  assert.equal(res.status, 409);
  assert.equal((await telo(res)).code, "command_not_yours");
});

test("neograničeni i besmisleni brojači se odbijaju", async (t) => {
  if (guard(t)) return;
  const { primiNapredak, CommandError } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);

  for (const loši of [
    { postedCount: 10_000_000 },
    { postedCount: -1 },
    { foundCount: Number.NaN },
  ]) {
    await assert.rejects(
      () =>
        primiNapredak({
          commandId: k.id, actorDeviceId: u.deviceId,
          clientEventId: `evt-${randomBytes(4).toString("hex")}`,
          status: "completed", sequence: 1, counters: loši as never,
        }),
      (e: unknown) => e instanceof CommandError && e.code === "counter_out_of_range",
      `brojač ${JSON.stringify(loši)} je prošao`,
    );
  }
});

test("nepoznato polje i nedozvoljeno stanje padaju PRE ijednog upita", async (t) => {
  if (guard(t)) return;
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);

  const sa = async (dodatak: Record<string, unknown>) =>
    (await update())(
      await potpisanZahtev(u, "/api/sync/commands/update", {
        commandId: k.id, eventId: "evt-ffffffff", status: "completed", sequence: 1,
        counters: BROJACI, ...dodatak,
      }),
    );

  // `deviceId` u telu bi pokušao da odluči ono što odlučuje potpis.
  const nepoznato = await sa({ deviceId: randomUUID() });
  assert.equal(nepoznato.status, 400);
  assert.equal((await telo(nepoznato)).code, "unknown_field");

  const stanje = await sa({ status: "expired" });
  assert.equal((await telo(stanje)).code, "status_not_allowed");

  const sekvenca = await sa({ sequence: 10_001 });
  assert.equal((await telo(sekvenca)).code, "sequence_invalid");

  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sync_command_events`;
  assert.equal(n, 0);
});

test("sirova poruka razloga se skraćuje i čisti", async (t) => {
  if (guard(t)) return;
  const { primiNapredak } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);

  await primiNapredak({
    commandId: k.id, actorDeviceId: u.deviceId, clientEventId: "evt-99999999",
    status: "blocked", sequence: 1, counters: BROJACI,
    // Putanja i ime kupca u razlogu ne smeju da prežive.
    failureCode: "C:\\Users\\Mile\\Fakture\\Petrović doo.pdf nije pročitan",
  });

  const [red] = await db.sql<{ failure_code: string }[]>`
    SELECT failure_code FROM sync_commands WHERE id = ${k.id}`;
  assert.ok(red.failure_code.length <= 64);
  assert.ok(!red.failure_code.includes("\\"), "putanja je preživela");
  assert.ok(!/Petrović/.test(red.failure_code), "ime kupca je preživelo");
});

/* =========================================================================
 * Trag
 * ====================================================================== */

test("trag čuva OBA aktera: čoveka koji je tražio i uređaj koji je izvršio", async (t) => {
  if (guard(t)) return;
  const { primiNapredak } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);
  await primiNapredak({
    commandId: k.id, actorDeviceId: u.deviceId, clientEventId: "evt-77777777",
    status: "completed", sequence: 1, counters: BROJACI,
  });

  const redovi = await db.sql<
    { action: string; actor_kind: string; actor_user_id: string | null; actor_device_id: string | null }[]
  >`SELECT action, actor_kind, actor_user_id, actor_device_id
      FROM audit_log WHERE entity_type = 'Komanda sinhronizacije' ORDER BY created_at`;

  const zatrazeno = redovi.find((r) => r.action === "Zatražena sinhronizacija");
  const zavrseno = redovi.find((r) => r.action === "Komanda sinhronizacije završena");
  assert.ok(zatrazeno && zavrseno, `nedostaje trag: ${JSON.stringify(redovi)}`);

  // Čovek je ZATRAŽIO.
  assert.equal(zatrazeno.actor_kind, "user");
  assert.equal(zatrazeno.actor_user_id, owner.id);
  /*
   * Uređaj je IZVRŠIO.
   *
   * Spajanje ova dva reda značilo bi da izveštaj tvrdi da je čovek uneo
   * dokumente — a nije ih ni video.
   */
  assert.equal(zavrseno.actor_kind, "device");
  assert.equal(zavrseno.actor_device_id, u.deviceId);
  assert.equal(zavrseno.actor_user_id, null);
});

test("događaji komande su append-only", async (t) => {
  if (guard(t)) return;
  const { primiNapredak } = await import("@/lib/sync/commands/service");
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);
  await primiNapredak({
    commandId: k.id, actorDeviceId: u.deviceId, clientEventId: "evt-55555555",
    status: "running", sequence: 1, counters: BROJACI,
  });

  await assert.rejects(
    () => db.sql`UPDATE sync_command_events SET status = 'completed'`,
    /append|izmena|update/i,
  );
  await assert.rejects(
    () => db.sql`DELETE FROM sync_command_events WHERE client_event_id = 'evt-55555555'`,
    /append|brisanje|delete/i,
  );
});

/* =========================================================================
 * Gate
 * ====================================================================== */

test("bez `FEATURE_SYNC_OPERATIONS` obe rute su 404, i kada prijem radi", async (t) => {
  if (guard(t)) return;
  const u = await aktivanUredjaj();
  const k = await otvorenaKomanda(u);

  delete process.env.FEATURE_SYNC_OPERATIONS;
  try {
    /*
     * 404, ne 403: isključen kanal se ne najavljuje. Prijem dokumenata pritom
     * i dalje radi — dva gate-a su dve odluke.
     */
    const p = await (await poll())(await potpisanZahtev(u, "/api/sync/commands/poll", {}));
    assert.equal(p.status, 404);

    const a = await (await update())(
      await potpisanZahtev(u, "/api/sync/commands/update", {
        commandId: k.id, eventId: "evt-66666666", status: "completed", sequence: 1, counters: BROJACI,
      }),
    );
    assert.equal(a.status, 404);
  } finally {
    process.env.FEATURE_SYNC_OPERATIONS = "1";
  }
});

test("prijem isključen gasi i komande", async (t) => {
  if (guard(t)) return;
  const u = await aktivanUredjaj();
  delete process.env.FEATURE_SYNC_DEVICE_INGEST;
  try {
    // Komanda bi pokrenula ciklus koji ne sme ništa da pošalje.
    const p = await (await poll())(await potpisanZahtev(u, "/api/sync/commands/poll", {}));
    assert.equal(p.status, 404);
  } finally {
    process.env.FEATURE_SYNC_DEVICE_INGEST = "1";
  }
});

test("serverska akcija odbija zakazivanje kada su komande isključene", async (t) => {
  if (guard(t)) return;
  const { isSyncOperationsEnabled } = await import("@/lib/sync/http/gate");
  delete process.env.FEATURE_SYNC_OPERATIONS;
  try {
    assert.equal(isSyncOperationsEnabled(), false);
    // Traži se doslovno "1": „bilo šta što liči na istinu“ ne otvara kanal.
    for (const v of ["0", "true", "yes", "", "01"]) {
      process.env.FEATURE_SYNC_OPERATIONS = v;
      assert.equal(isSyncOperationsEnabled(), false, `vrednost „${v}“ je upalila komande`);
    }
  } finally {
    process.env.FEATURE_SYNC_OPERATIONS = "1";
  }
});
