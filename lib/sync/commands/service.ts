import "server-only";
import { and, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  OTVORENA_STANJA,
  syncCommandEvents,
  syncCommands,
  syncDeviceCycles,
  syncDevices,
  TERMINALNA_STANJA,
  type SyncCommandStatus,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";

/**
 * Životni ciklus ručne komande konektoru.
 *
 * Jedini tip je `scan_and_sync`, i on pokreće POSTOJEĆI P3 ciklus. Server ne
 * šalje program, putanju, folder, argument ni bilo šta što uređaj tumači —
 * samo identitet komande i njen zatvoren tip.
 *
 * Ova tabela NIJE knjigovodstvena istina. `completed` znači „ciklus je
 * završen“, ne „sve fakture su knjižene“; za to su merodavni `invoices` i
 * `import_runs`.
 */

/** Koliko dugo komanda čeka uređaj pre nego što istekne. */
export const ROK_KOMANDE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Koliko dugo uređaj drži preuzetu komandu bez javljanja.
 *
 * Kraće od roka komande: uređaj koji je preuzeo pa nestao ne sme da je drži
 * nedeljama. Istek lease-a NE pravi novu komandu — isti uređaj nastavlja istu.
 */
export const ROK_LEASE_MS = 30 * 60 * 1000;

export class CommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

/**
 * Dozvoljeni prelazi. Monotoni — unazad se ne ide.
 *
 * Uređaj koji prijavi `queued` posle `running` bi obrisao činjenicu da je posao
 * počeo. Provera je serverska; klijent ne odlučuje šta je napredak.
 */
const PRELAZI: Record<SyncCommandStatus, readonly SyncCommandStatus[]> = {
  queued: ["delivered", "expired", "blocked"],
  /*
   * `delivered` sme PRAVO u završno stanje, bez `running`.
   *
   * Nije popuštanje: uređaj prvo šalje „počeo sam“, ali taj ACK ume da se
   * izgubi na mreži. Posao se svejedno obavi i završni izveštaj stigne prvi.
   * Da se prelaz odbija, gotova komanda bi na ekranu zauvek stajala kao
   * „preuzeto“ — tačno stanje koje ovaj model postoji da spreči.
   *
   * Zakašnjeli `running` posle toga pada kao `command_terminal`, i tako treba:
   * ishod se ne otvara ponovo.
   */
  delivered: [
    "running",
    "completed",
    "completed_with_review",
    "retry_pending",
    "failed",
    "blocked",
    "expired",
  ],
  running: [
    "running", // periodičan progress u istom stanju
    "completed",
    "completed_with_review",
    "retry_pending",
    "failed",
    "blocked",
  ],
  retry_pending: ["running", "delivered", "completed", "completed_with_review", "failed", "blocked", "expired"],
  completed: [],
  completed_with_review: [],
  failed: [],
  blocked: [],
  expired: [],
};

export function prelazDozvoljen(iz: SyncCommandStatus, u: SyncCommandStatus): boolean {
  return (PRELAZI[iz] ?? []).includes(u);
}

/** Gornja granica brojača — izveštaj uređaja se ograničava, ne veruje mu se. */
const MAX_BROJAC = 100_000;

export type Brojaci = {
  foundCount: number;
  readCount: number;
  postedCount: number;
  duplicateCount: number;
  reviewCount: number;
  unsupportedCount: number;
  pendingCount: number;
  blockedCount: number;
};

const NULA: Brojaci = {
  foundCount: 0, readCount: 0, postedCount: 0, duplicateCount: 0,
  reviewCount: 0, unsupportedCount: 0, pendingCount: 0, blockedCount: 0,
};

/**
 * Provera brojača.
 *
 * Brojači dolaze od uređaja i nisu nezavisno dokazani. Server ih ograničava na
 * razuman opseg da jedan pogrešan izveštaj ne pretvori ekran u besmislicu; ne
 * pretvara ih u knjigovodstvenu tvrdnju.
 */
export function proveriBrojace(ulaz: Partial<Brojaci>): Brojaci {
  const out = { ...NULA };
  for (const kljuc of Object.keys(NULA) as (keyof Brojaci)[]) {
    const v = ulaz[kljuc];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0 || v > MAX_BROJAC) {
      throw new CommandError("counter_out_of_range", "Brojač je izvan dozvoljenog opsega.");
    }
    out[kljuc] = v;
  }
  return out;
}

/* =========================================================================
 * Portal → komanda
 * ====================================================================== */

/**
 * Zakazuje `scan_and_sync` za jedan uređaj.
 *
 * Opseg se PREPISUJE sa uređaja; pozivalac ga ne bira. Korisnik koji je
 * zatražio ostaje zapisan i uređaj ga ne može promeniti.
 *
 * Dvostruki klik ne pravi dve komande: delimičan jedinstveni indeks nad
 * otvorenim stanjima to sprečava u BAZI, jer aplikativna provera ne preživljava
 * dva paralelna submit-a.
 */
export async function zakaziKomandu(
  input: { deviceId: string; now?: Date },
  actor: { id: string; name: string; role: string },
): Promise<{ commandId: string; vecPostoji: boolean }> {
  const db = getDb();
  const now = input.now ?? new Date();

  return db.transaction(async (tx) => {
    const [uredjaj] = await tx
      .select()
      .from(syncDevices)
      .where(eq(syncDevices.id, input.deviceId))
      .limit(1);
    if (!uredjaj) throw new CommandError("device_not_found", "Uređaj ne postoji.");
    if (uredjaj.status !== "active") {
      /*
       * Komanda neaktivnom uređaju bi zauvek čekala i izgledala kao kvar.
       * Bolje odmah reći da uređaj ne radi.
       */
      throw new CommandError("device_not_active", "Uređaj nije aktivan.");
    }

    // Već otvorena komanda se PONOVO KORISTI, ne duplira.
    const [otvorena] = await tx
      .select({ id: syncCommands.id })
      .from(syncCommands)
      .where(
        and(
          eq(syncCommands.deviceId, input.deviceId),
          eq(syncCommands.commandType, "scan_and_sync"),
          inArray(syncCommands.status, [...OTVORENA_STANJA]),
        ),
      )
      .limit(1);
    if (otvorena) return { commandId: otvorena.id, vecPostoji: true };

    const [red] = await tx
      .insert(syncCommands)
      .values({
        deviceId: uredjaj.id,
        sourceSystem: uredjaj.sourceSystem,
        issuerCode: uredjaj.issuerCode,
        commandType: "scan_and_sync",
        commandVersion: 1,
        requestedBy: actor.id,
        status: "queued",
        availableAt: now,
        expiresAt: new Date(now.getTime() + ROK_KOMANDE_MS),
      })
      .returning({ id: syncCommands.id });

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.syncCommandQueued,
        entityType: "Komanda sinhronizacije",
        entityId: red.id,
        entityLabel: `dev:${uredjaj.deviceCode}`,
        after: { tip: "scan_and_sync", opseg: `${uredjaj.sourceSystem}/${uredjaj.issuerCode}` },
        reason: "Ručno zatražena sinhronizacija.",
      },
      tx,
    );

    return { commandId: red.id, vecPostoji: false };
  });
}

/* =========================================================================
 * Uređaj → poll
 * ====================================================================== */

/**
 * Uzima NAJVIŠE JEDNU komandu za dati uređaj i zaključava je lease-om.
 *
 * `UPDATE … WHERE` sa uslovom nad lease-om je jedina provera: dva istovremena
 * `poll`-a ne mogu oba dobiti istu komandu, jer drugi ne pogađa nijedan red.
 * Čitanje pa upis bi ostavilo prozor u kome oba vide slobodnu komandu.
 *
 * Uređaj dobija SAMO svoje komande. Opseg se ne čita iz zahteva — filtrira se
 * po `device_id` koji dolazi iz potpisa.
 */
export async function preuzmiKomandu(input: {
  deviceId: string;
  now?: Date;
}): Promise<{
  id: string;
  commandType: string;
  commandVersion: number;
  expiresAt: string;
} | null> {
  const db = getDb();
  const now = input.now ?? new Date();

  /*
   * Istekle komande se prvo zatvaraju.
   *
   * Bez ovoga bi komanda zadata pre mesec dana bila izvršena u trenutku kada
   * neko upali računar — a to više nije ono što je čovek tražio.
   */
  await db
    .update(syncCommands)
    .set({ status: "expired", finishedAt: now, updatedAt: now, failureCode: "expired" })
    .where(
      and(
        eq(syncCommands.deviceId, input.deviceId),
        inArray(syncCommands.status, [...OTVORENA_STANJA]),
        lt(syncCommands.expiresAt, now),
      ),
    );

  const leaseDo = new Date(now.getTime() + ROK_LEASE_MS);

  const preuzete = await db
    .update(syncCommands)
    .set({
      status: sql`CASE WHEN ${syncCommands.status} = 'queued' THEN 'delivered'::sync_command_status ELSE ${syncCommands.status} END`,
      /*
       * `::timestamptz` NIJE ukras.
       *
       * Unutar sirovog `sql` fragmenta Date stiže kao neotipovan tekst, pa
       * `COALESCE(timestamptz, text)` PostgreSQL odbija i ceo `poll` pada.
       * Prvo preuzimanje ostaje prvo: kasniji poll ne pomera `delivered_at`.
       */
      deliveredAt: sql`COALESCE(${syncCommands.deliveredAt}, ${now.toISOString()}::timestamptz)`,
      leaseOwnerDeviceId: input.deviceId,
      leaseExpiresAt: leaseDo,
      updatedAt: now,
    })
    .where(
      and(
        eq(syncCommands.deviceId, input.deviceId),
        inArray(syncCommands.status, [...OTVORENA_STANJA]),
        /*
         * Granica se računa u JS-u, ne u SQL-u.
         *
         * `${now} + interval '1 second'` bi poslalo neotipovan parametar, pa
         * PostgreSQL ne bi umeo da razreši operator — upit pada u celini.
         * Sekunda tolerancije ostaje: komanda zakazana „sad“ sme odmah da se
         * preuzme uprkos sitnoj razlici satova.
         */
        lte(syncCommands.availableAt, new Date(now.getTime() + 1000)),
        /*
         * Slobodna, ili je lease istekao, ili je već naša.
         *
         * Istek lease-a dozvoljava ISTOM uređaju da nastavi — ne pravi novu
         * poslovnu komandu i ne daje je drugom uređaju (filter po `device_id`
         * to ionako sprečava).
         */
        or(
          isNull(syncCommands.leaseOwnerDeviceId),
          lt(syncCommands.leaseExpiresAt, now),
          eq(syncCommands.leaseOwnerDeviceId, input.deviceId),
        ),
      ),
    )
    .returning({
      id: syncCommands.id,
      commandType: syncCommands.commandType,
      commandVersion: syncCommands.commandVersion,
      expiresAt: syncCommands.expiresAt,
    });

  const prva = preuzete[0];
  if (!prva) return null;

  /*
   * Vraća se NAJVIŠE JEDNA.
   *
   * Delimičan jedinstveni indeks ionako dopušta samo jednu otvorenu po uređaju;
   * ovo je odbrana u dubini, da promena indeksa ne pretvori odgovor u listu.
   */
  return {
    id: prva.id,
    commandType: prva.commandType,
    commandVersion: prva.commandVersion,
    expiresAt: prva.expiresAt.toISOString(),
  };
}

/* =========================================================================
 * Uređaj → update
 * ====================================================================== */

export type UpdateIshod =
  | { result: "primljeno"; status: SyncCommandStatus }
  | { result: "vec_primljeno"; status: SyncCommandStatus }
  | { result: "konflikt"; razlog: string };

/**
 * Prima jedan događaj napretka.
 *
 * `clientEventId` je stabilan ID koji pravi uređaj. Zahvaljujući njemu je
 * ponovljen ACK idempotentan; isti ID sa DRUGIM sadržajem je konflikt, jer bi
 * značilo da dva različita događaja tvrde isti identitet.
 *
 * `actorDeviceId` dolazi IZ POTPISA. Telo ga ne nosi i ne bi mu se verovalo.
 */
export async function primiNapredak(input: {
  commandId: string;
  actorDeviceId: string;
  clientEventId: string;
  status: SyncCommandStatus;
  sequence: number;
  failureCode?: string | null;
  counters?: Partial<Brojaci>;
  now?: Date;
}): Promise<UpdateIshod> {
  const db = getDb();
  const now = input.now ?? new Date();
  const brojaci = proveriBrojace(input.counters ?? {});
  const failureCode = ogranicenKod(input.failureCode);

  return db.transaction(async (tx) => {
    const [komanda] = await tx
      .select()
      .from(syncCommands)
      .where(eq(syncCommands.id, input.commandId))
      .limit(1);
    if (!komanda) throw new CommandError("command_not_found", "Komanda ne postoji.");

    /*
     * Uređaj ne sme da završi TUĐU komandu.
     *
     * Poređenje ide po `device_id` iz potpisa; bez njega bi jedan kompromitovan
     * uređaj mogao da zatvara tuđe komande kao uspešne.
     */
    if (komanda.deviceId !== input.actorDeviceId) {
      throw new CommandError("command_not_yours", "Komanda ne pripada ovom uređaju.");
    }

    // Ponovljen događaj: isti sadržaj = no-op, drugačiji = konflikt.
    const [postojeci] = await tx
      .select()
      .from(syncCommandEvents)
      .where(
        and(
          eq(syncCommandEvents.commandId, input.commandId),
          eq(syncCommandEvents.clientEventId, input.clientEventId),
        ),
      )
      .limit(1);

    if (postojeci) {
      const isti =
        postojeci.status === input.status &&
        postojeci.sequence === input.sequence &&
        (postojeci.failureCode ?? null) === failureCode &&
        postojeci.postedCount === brojaci.postedCount &&
        postojeci.foundCount === brojaci.foundCount &&
        postojeci.reviewCount === brojaci.reviewCount;
      if (!isti) {
        return { result: "konflikt", razlog: "event_id_content_mismatch" } as const;
      }
      return { result: "vec_primljeno", status: komanda.status } as const;
    }

    if (TERMINALNA_STANJA.includes(komanda.status)) {
      /*
       * Terminalna komanda se ne otvara ponovo.
       *
       * Uređaj koji posle isteka javi „running“ ne sme da je oživi — čovek je
       * već video ishod.
       */
      return { result: "konflikt", razlog: "command_terminal" } as const;
    }

    if (!prelazDozvoljen(komanda.status, input.status)) {
      return { result: "konflikt", razlog: "transition_not_allowed" } as const;
    }

    await tx.insert(syncCommandEvents).values({
      commandId: input.commandId,
      clientEventId: input.clientEventId,
      actorDeviceId: input.actorDeviceId,
      sequence: input.sequence,
      status: input.status,
      failureCode,
      ...brojaci,
    });

    const terminalno = TERMINALNA_STANJA.includes(input.status);
    await tx
      .update(syncCommands)
      .set({
        status: input.status,
        startedAt:
          input.status === "running"
            ? sql`COALESCE(${syncCommands.startedAt}, ${now.toISOString()}::timestamptz)`
            : komanda.startedAt,
        finishedAt: terminalno ? now : null,
        failureCode,
        ...brojaci,
        // Lease se otpušta na terminalnom ishodu; komanda više nikoga ne čeka.
        leaseOwnerDeviceId: terminalno ? null : komanda.leaseOwnerDeviceId,
        leaseExpiresAt: terminalno ? null : komanda.leaseExpiresAt,
        updatedAt: now,
      })
      .where(eq(syncCommands.id, input.commandId));

    if (terminalno) {
      await recordAudit(
        {
          actor: {
            kind: "device",
            deviceId: input.actorDeviceId,
            name: "Uređaj za prijem",
            role: "sync_device",
          },
          action: AUDIT_ACTIONS.syncCommandFinished,
          entityType: "Komanda sinhronizacije",
          entityId: input.commandId,
          entityLabel: `cmd:${input.commandId.slice(0, 8)}`,
          after: { status: input.status, ...brojaci },
          reason: failureCode ? `Ishod: ${failureCode}` : `Ishod: ${input.status}`,
        },
        tx,
      );
    }

    return { result: "primljeno", status: input.status } as const;
  });
}

/** Kod razloga: kratak, iz ograničenog oblika; nikad sirova poruka. */
function ogranicenKod(kod: string | null | undefined): string | null {
  if (typeof kod !== "string" || kod.trim() === "") return null;
  const cist = kod.trim().replace(/[^a-z0-9_:.-]/gi, "");
  if (cist === "") return null;
  return cist.slice(0, 64);
}

/* =========================================================================
 * Portal → prikaz
 * ====================================================================== */

/** Uređaji u opsegu, sa poslednjim kontaktom i poslednjom komandom. */
export async function pregledUredjaja(): Promise<
  {
    id: string;
    deviceCode: string;
    label: string;
    status: string;
    sourceSystem: string;
    issuerCode: string;
    lastSeenAt: string | null;
    /* Izveštaj ciklusa (0034); prazno za konektor pre 0.3.9. */
    lastCycleAt: string | null;
    lastCycleOutcome: "obradjeno" | "preskoceno" | "greska" | null;
    lastScanCompletedAt: string | null;
    nextExpectedCycleAt: string | null;
    poslednjiCiklusi: {
      cycleAt: string;
      outcome: "obradjeno" | "preskoceno" | "greska";
      reason: string | null;
      scanCompleted: boolean;
      scanned: number | null;
      newDocuments: number | null;
      sent: number | null;
      errorCode: string | null;
      connectorVersion: string | null;
    }[];
    poslednjaKomanda: {
      id: string;
      status: SyncCommandStatus;
      createdAt: string;
      finishedAt: string | null;
      failureCode: string | null;
      brojaci: Brojaci;
    } | null;
  }[]
> {
  const db = getDb();
  const uredjaji = await db
    .select()
    .from(syncDevices)
    .orderBy(syncDevices.deviceCode);

  const out = [];
  for (const u of uredjaji) {
    const [k] = await db
      .select()
      .from(syncCommands)
      .where(eq(syncCommands.deviceId, u.id))
      .orderBy(desc(syncCommands.createdAt))
      .limit(1);

    out.push({
      id: u.id,
      deviceCode: u.deviceCode,
      label: u.label,
      status: u.status,
      sourceSystem: u.sourceSystem,
      issuerCode: u.issuerCode,
      lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
      lastCycleAt: u.lastCycleAt ? u.lastCycleAt.toISOString() : null,
      lastCycleOutcome: u.lastCycleOutcome ?? null,
      lastScanCompletedAt: u.lastScanCompletedAt ? u.lastScanCompletedAt.toISOString() : null,
      nextExpectedCycleAt: u.nextExpectedCycleAt ? u.nextExpectedCycleAt.toISOString() : null,
      poslednjiCiklusi: (
        await db
          .select()
          .from(syncDeviceCycles)
          .where(eq(syncDeviceCycles.deviceId, u.id))
          .orderBy(desc(syncDeviceCycles.cycleAt))
          .limit(12)
      ).map((c) => ({
        cycleAt: c.cycleAt.toISOString(),
        outcome: c.outcome,
        reason: c.reason,
        scanCompleted: c.scanCompleted,
        scanned: c.scanned,
        newDocuments: c.newDocuments,
        sent: c.sent,
        errorCode: c.errorCode,
        connectorVersion: c.connectorVersion,
      })),
      poslednjaKomanda: k
        ? {
            id: k.id,
            status: k.status,
            createdAt: k.createdAt.toISOString(),
            finishedAt: k.finishedAt ? k.finishedAt.toISOString() : null,
            failureCode: k.failureCode,
            brojaci: {
              foundCount: k.foundCount,
              readCount: k.readCount,
              postedCount: k.postedCount,
              duplicateCount: k.duplicateCount,
              reviewCount: k.reviewCount,
              unsupportedCount: k.unsupportedCount,
              pendingCount: k.pendingCount,
              blockedCount: k.blockedCount,
            },
          }
        : null,
    });
  }
  return out;
}
