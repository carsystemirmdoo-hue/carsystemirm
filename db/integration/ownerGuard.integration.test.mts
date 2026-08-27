import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  cleanupQa,
  closeTestDatabase,
  ensureTestCryptoEnv,
  initTestDatabase,
  countActiveOwners,
  isolateOwners,
  seedAccounts,
  skipReason,
  type TestDatabase,
} from "./harness.mts";

/**
 * Zaštita poslednjeg aktivnog vlasnika, nad pravim PostgreSQL-om.
 *
 * Ovo je jedini test koji može da dokaže da `pg_advisory_xact_lock` STVARNO
 * serijalizuje dva istovremena zahteva. Mock to ne može, a PGlite ne može ni
 * da otvori dve nezavisne transakcije.
 *
 * Testira se PRAVI `withOwnerGuard` iz `lib/authz/security-admin.ts`, ne kopija
 * njegovog SQL-a — inače bi test prošao i kada bi se produkcijski kod razišao
 * sa njim.
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

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
});

after(async () => {
  if (!reason && db) await cleanupQa(db);
  await closeTestDatabase();
});

/**
 * Priprema sveta u kome su TAČNO dva aktivna vlasnika.
 *
 * Pravilo gleda ceo skup vlasnika u bazi, pa i test mora da ga kontroliše.
 * Prvi direktni prolaz je pao baš zbog toga: `audit` fajl se izvršava ranije i
 * ostavlja dva aktivna `gazda` naloga sa tragom, koje čišćenje ne sme da
 * obriše. Guard je tada ISPRAVNO dozvolio obe deaktivacije — ostajala su još
 * dva vlasnika. Test je merio raspored fajlova, ne kod.
 */
async function dvaVlasnika(kljucevi: [string, string]) {
  const accounts = await seedAccounts(db, [
    { key: kljucevi[0], role: "gazda" },
    { key: kljucevi[1], role: "gazda" },
  ]);
  const ids = [accounts[kljucevi[0]].id, accounts[kljucevi[1]].id];
  const spusteno = await isolateOwners(db, ids);

  const ukupno = await countActiveOwners(db);
  assert.equal(
    ukupno,
    2,
    `preduslov nije ispunjen: aktivnih vlasnika ${ukupno} (spušteno ${spusteno})`,
  );
  return { accounts, ids };
}

test("dve istovremene deaktivacije poslednja dva vlasnika — prolazi tacno jedna", async (t) => {
  if (guard(t)) return;

  const { withOwnerGuard, SecurityActionError, removesActiveOwner } = await import(
    "@/lib/authz/security-admin"
  );
  const { users } = await import("@/db/schema");

  const { accounts, ids } = await dvaVlasnika(["owner1", "owner2"]);
  const [id1, id2] = ids;
  console.log(`  pre: aktivnih vlasnika = ${await countActiveOwners(db)}`);

  const target = { role: "gazda", active: true };
  const SLEEP_S = 0.4;
  const usaoU: Record<string, number> = {};

  const deactivate = (id: string, oznaka: string) => {
    const t0 = Date.now();
    return withOwnerGuard(
      { targetId: id, removesOwner: removesActiveOwner(target, { nextActive: false }) },
      async (tx) => {
        // Trenutak ulaska u zaštićeni deo — dokaz da druga strana nije ušla
        // dok prva nije završila.
        usaoU[oznaka] = Date.now() - t0;
        /*
         * Pauza UNUTAR transakcije, dok se brava drži.
         *
         * Bez serijalizacije bi obe već pročitale „ostaje jedan" i obe
         * nastavile. Sa bravom druga ni ne stiže dovde dok prva ne završi.
         */
        await tx.execute(sql`SELECT pg_sleep(${SLEEP_S})`);
        await tx.update(users).set({ active: false }).where(eq(users.id, id));
        return oznaka;
      },
    );
  };

  const pocetak = Date.now();
  // Bez ijedne veštačke serijalizacije: obe kreću u istom trenutku.
  const results = await Promise.allSettled([
    deactivate(id1, "prva"),
    deactivate(id2, "druga"),
  ]);
  const ukupnoTrajanje = Date.now() - pocetak;

  const uspele = results.filter((r) => r.status === "fulfilled");
  const pale = results.filter((r) => r.status === "rejected");

  for (const [i, r] of results.entries()) {
    console.log(
      `  akcija ${i + 1}: ${r.status}` +
        (r.status === "rejected" ? ` — ${(r.reason as Error).constructor.name}` : ""),
    );
  }

  /*
   * Dokaz da je druga STVARNO čekala.
   *
   * Da brava ne serijalizuje, obe bi se preklopile i ceo posao bi trajao oko
   * jedne pauze. Serijalizovane, traju bar dve — pa ukupno vreme mora biti
   * osetno veće od jedne pauze.
   */
  assert.ok(
    ukupnoTrajanje > SLEEP_S * 1000 * 1.5,
    `obe transakcije su se preklopile: ukupno ${ukupnoTrajanje} ms za pauzu od ${SLEEP_S * 1000} ms`,
  );

  assert.equal(uspele.length, 1, "obe deaktivacije su prošle — brava ne serijalizuje");
  assert.equal(pale.length, 1);
  assert.ok(
    (pale[0] as PromiseRejectedResult).reason instanceof SecurityActionError,
    `druga transakcija je pala iz pogrešnog razloga: ${(pale[0] as PromiseRejectedResult).reason}`,
  );

  // Odbijena transakcija ne sme ostaviti nijednu svoju izmenu.
  const stanje = await db.sql<{ id: string; active: boolean; session_version: number }[]>`
    SELECT id, active, session_version FROM users WHERE id IN (${id1}, ${id2})
  `;
  const aktivnih = stanje.filter((r) => r.active).length;
  console.log(`  posle: aktivnih od dva = ${aktivnih}, ukupno = ${await countActiveOwners(db)}`);
  assert.equal(aktivnih, 1, "obe mutacije su commitovane");
  assert.equal(await countActiveOwners(db), 1, "završni broj aktivnih vlasnika nije 1");

  void accounts;
});

test("obe transakcije koriste isti kljuc brave", async (t) => {
  if (guard(t)) return;
  const { withOwnerGuard } = await import("@/lib/authz/security-admin");

  /*
   * Ključ ne sme zavisiti od cilja.
   *
   * Da zavisi, dve deaktivacije različitih naloga uzele bi RAZLIČITE brave i ne
   * bi se ni videle — a to je greška koja izgleda kao da sve radi.
   */
  const kljucevi: number[] = [];
  const zabelezi = (id: string) =>
    withOwnerGuard({ targetId: id, removesOwner: false }, async (tx) => {
      const rows = await tx.execute<{ kljuc: string }>(
        sql`SELECT ((classid::bigint << 32) | objid::bigint)::text AS kljuc
            FROM pg_locks
            WHERE locktype = 'advisory' AND granted AND pid = pg_backend_pid()`,
      );
      for (const r of rows) kljucevi.push(Number(r.kljuc));
      return null;
    });

  const a = await seedAccounts(db, [
    { key: "kl1", role: "komercijalista" },
    { key: "kl2", role: "komercijalista" },
  ]);
  await zabelezi(a.kl1.id);
  await zabelezi(a.kl2.id);

  assert.equal(kljucevi.length, 2, "brava nije vidljiva u pg_locks");
  assert.equal(kljucevi[0], kljucevi[1], "ključ zavisi od cilja");
  console.log(`  ključ brave: ${kljucevi[0]}`);
});

test("dve istovremene promene uloge poslednja dva vlasnika — prolazi tacno jedna", async (t) => {
  if (guard(t)) return;
  const { withOwnerGuard, SecurityActionError, removesActiveOwner } = await import(
    "@/lib/authz/security-admin"
  );
  const { users } = await import("@/db/schema");

  const { ids } = await dvaVlasnika(["role1", "role2"]);
  const [id1, id2] = ids;

  const promeni = (id: string) =>
    withOwnerGuard(
      {
        targetId: id,
        removesOwner: removesActiveOwner(
          { role: "gazda", active: true },
          { nextRole: "komercijalista" },
        ),
      },
      async (tx) => {
        await tx.execute(sql`SELECT pg_sleep(0.4)`);
        await tx.update(users).set({ role: "komercijalista" }).where(eq(users.id, id));
        return "ok";
      },
    );

  const results = await Promise.allSettled([promeni(id1), promeni(id2)]);
  assert.equal(
    results.filter((r) => r.status === "fulfilled").length,
    1,
    "obe promene uloge su prošle",
  );
  assert.ok(
    (results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason instanceof
      SecurityActionError,
  );
  assert.equal(await countActiveOwners(db), 1, "završni broj aktivnih vlasnika nije 1");
});

test("brava ne blokira izmene koje ne uklanjaju vlasnika", async (t) => {
  if (guard(t)) return;

  const { withOwnerGuard, removesActiveOwner } = await import("@/lib/authz/security-admin");
  const { users } = await import("@/db/schema");

  const accounts = await seedAccounts(db, [
    { key: "worker1", role: "komercijalista" },
    { key: "worker2", role: "magacioner" },
  ]);

  // Dve paralelne izmene nad ne-vlasnicima moraju obe proći.
  const results = await Promise.all(
    [accounts.worker1.id, accounts.worker2.id].map((id) =>
      withOwnerGuard(
        {
          targetId: id,
          removesOwner: removesActiveOwner({ role: "komercijalista", active: true }, { nextActive: false }),
        },
        async (tx) => {
          await tx.update(users).set({ active: false }).where(eq(users.id, id));
          return "ok";
        },
      ),
    ),
  );
  assert.deepEqual(results, ["ok", "ok"]);
});
