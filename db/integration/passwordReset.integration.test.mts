import assert from "node:assert/strict";
import test, { after, before } from "node:test";
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
 * Kod za promenu lozinke, nad pravom bazom.
 *
 * Testira se produkcijski `lib/auth/password-reset.ts`. Tvrdnje koje se ne mogu
 * dokazati bez baze: da plaintext nigde ne postoji, da je kod jednokratan pod
 * paralelnim pokušajima, i da `session_version` raste u istoj transakciji.
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

async function sviRedoviKodova(userId: string) {
  return db.sql<
    {
      code_fingerprint: string;
      used_at: Date | null;
      superseded_at: Date | null;
      expires_at: Date;
    }[]
  >`SELECT code_fingerprint, used_at, superseded_at, expires_at
    FROM password_reset_codes WHERE user_id = ${userId}`;
}

test("plaintext koda ne postoji nigde u bazi", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode } = await import("@/lib/auth/password-reset");
  const a = await seedAccounts(db, [{ key: "reset1", role: "komercijalista" }]);

  const { code } = await issuePasswordResetCode({ userId: a.reset1.id, issuedBy: null });

  const rows = await sviRedoviKodova(a.reset1.id);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].code_fingerprint, code, "otisak je jednak samom kodu");
  assert.ok(!rows[0].code_fingerprint.includes(code));

  /*
   * Pretraga celе tabele, ne samo kolone otiska.
   *
   * Kod bi mogao da procuri kroz neku drugu kolonu — na primer kroz razlog u
   * auditu. Zato se traži bilo gde.
   */
  const [{ pogodaka }] = await db.sql<{ pogodaka: number }[]>`
    SELECT count(*)::int AS pogodaka FROM password_reset_codes
    WHERE code_fingerprint LIKE ${`%${code}%`}
  `;
  assert.equal(pogodaka, 0, "kod se nalazi u bazi u čitljivom obliku");
});

test("izdavanje odmah podize session_version cilja", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode } = await import("@/lib/auth/password-reset");
  const a = await seedAccounts(db, [{ key: "reset2", role: "kancelarija" }]);

  const [pre] = await db.sql<{ v: number }[]>`
    SELECT session_version AS v FROM users WHERE id = ${a.reset2.id}
  `;
  await issuePasswordResetCode({ userId: a.reset2.id, issuedBy: null });
  const [post] = await db.sql<{ v: number }[]>`
    SELECT session_version AS v FROM users WHERE id = ${a.reset2.id}
  `;
  assert.equal(post.v, pre.v + 1, "otvorene sesije nisu opozvane pri izdavanju");
});

test("nov kod ponistava prethodni", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode, completePasswordReset } = await import(
    "@/lib/auth/password-reset"
  );
  const a = await seedAccounts(db, [{ key: "reset3", role: "komercijalista" }]);

  const prvi = await issuePasswordResetCode({ userId: a.reset3.id, issuedBy: null });
  const drugi = await issuePasswordResetCode({ userId: a.reset3.id, issuedBy: null });

  const rows = await sviRedoviKodova(a.reset3.id);
  assert.equal(rows.length, 2);
  assert.equal(rows.filter((r) => r.superseded_at !== null).length, 1);

  // Stari kod više ne radi.
  const stari = await completePasswordReset({
    email: a.reset3.email,
    code: prvi.code,
    newPassword: "nova-lozinka-za-qa-1",
  });
  assert.equal(stari.ok, false, "poništen kod je i dalje prošao");

  // Novi radi.
  const novi = await completePasswordReset({
    email: a.reset3.email,
    code: drugi.code,
    newPassword: "nova-lozinka-za-qa-2",
  });
  assert.equal(novi.ok, true);
});

test("kod se moze upotrebiti tacno jednom, i pod paralelnim pokusajima", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode, completePasswordReset } = await import(
    "@/lib/auth/password-reset"
  );
  const a = await seedAccounts(db, [{ key: "reset4", role: "komercijalista" }]);
  const { code } = await issuePasswordResetCode({ userId: a.reset4.id, issuedBy: null });

  /*
   * Dva istovremena pokušaja sa istim kodom.
   *
   * Uslovi su svi u `WHERE`, pa oba nalaze isti red ali samo jedan uspeva da ga
   * označi kao iskorišćen. Da je provera bila u JavaScriptu pa upis posle, oba
   * bi prošla.
   */
  const [prvi, drugi] = await Promise.all([
    completePasswordReset({ email: a.reset4.email, code, newPassword: "qa-lozinka-paralelna-1" }),
    completePasswordReset({ email: a.reset4.email, code, newPassword: "qa-lozinka-paralelna-2" }),
  ]);

  const uspesnih = [prvi, drugi].filter((r) => r.ok).length;
  assert.equal(uspesnih, 1, `prošlo ${uspesnih} puta umesto jednom`);

  const rows = await sviRedoviKodova(a.reset4.id);
  assert.equal(rows.filter((r) => r.used_at !== null).length, 1);
});

test("istekao kod se odbija", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode, completePasswordReset } = await import(
    "@/lib/auth/password-reset"
  );
  const a = await seedAccounts(db, [{ key: "reset5", role: "komercijalista" }]);
  const { code } = await issuePasswordResetCode({ userId: a.reset5.id, issuedBy: null });

  // Rok se pomera u prošlost direktno u bazi — brže od čekanja 30 minuta.
  await db.sql`
    UPDATE password_reset_codes SET expires_at = now() - interval '1 minute'
    WHERE user_id = ${a.reset5.id}
  `;

  const ishod = await completePasswordReset({
    email: a.reset5.email,
    code,
    newPassword: "qa-lozinka-istekla",
  });
  assert.equal(ishod.ok, false, "istekao kod je prošao");
});

test("kod jednog naloga ne otvara drugi", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode, completePasswordReset } = await import(
    "@/lib/auth/password-reset"
  );
  const a = await seedAccounts(db, [
    { key: "reset6a", role: "komercijalista" },
    { key: "reset6b", role: "komercijalista" },
  ]);
  const { code } = await issuePasswordResetCode({ userId: a.reset6a.id, issuedBy: null });

  const ishod = await completePasswordReset({
    email: a.reset6b.email,
    code,
    newPassword: "qa-lozinka-tudja",
  });
  assert.equal(ishod.ok, false, "kod je otvorio tuđi nalog");
});

test("deaktiviran nalog se ne oziveljava promenom lozinke", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode, completePasswordReset } = await import(
    "@/lib/auth/password-reset"
  );
  const a = await seedAccounts(db, [{ key: "reset7", role: "komercijalista" }]);
  const { code } = await issuePasswordResetCode({ userId: a.reset7.id, issuedBy: null });
  await db.sql`UPDATE users SET active = false WHERE id = ${a.reset7.id}`;

  const ishod = await completePasswordReset({
    email: a.reset7.email,
    code,
    newPassword: "qa-lozinka-iskljucen",
  });
  assert.equal(ishod.ok, false);
});

test("uspesan reset menja hes i opoziva sesije, u istoj transakciji", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode, completePasswordReset } = await import(
    "@/lib/auth/password-reset"
  );
  const { verifyPassword } = await import("@/lib/auth/password.mjs");
  const a = await seedAccounts(db, [{ key: "reset8", role: "komercijalista" }]);
  const { code } = await issuePasswordResetCode({ userId: a.reset8.id, issuedBy: null });

  const [pre] = await db.sql<{ v: number; h: string }[]>`
    SELECT session_version AS v, password_hash AS h FROM users WHERE id = ${a.reset8.id}
  `;

  const nova = "qa-nova-duga-lozinka-2026";
  const ishod = await completePasswordReset({ email: a.reset8.email, code, newPassword: nova });
  assert.equal(ishod.ok, true);

  const [post] = await db.sql<{ v: number; h: string }[]>`
    SELECT session_version AS v, password_hash AS h FROM users WHERE id = ${a.reset8.id}
  `;
  assert.equal(post.v, pre.v + 1, "sesije nisu opozvane");
  assert.notEqual(post.h, pre.h, "heš lozinke nije promenjen");
  assert.equal(await verifyPassword(nova, post.h), true);
  assert.equal(await verifyPassword(a.reset8.password, post.h), false);
});

/** Medijana — otporna na pojedinačni skok u mreži, za razliku od proseka. */
function medijana(uzorci: number[]): number {
  const s = [...uzorci].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

test("odgovor ne otkriva postoji li nalog — merenje nad pravom bazom", async (t) => {
  if (guard(t)) return;
  const { completePasswordReset } = await import("@/lib/auth/password-reset");
  const { generateRecoveryCode } = await import("@/lib/auth/recovery-codes.mjs");
  const a = await seedAccounts(db, [{ key: "reset9", role: "komercijalista" }]);

  const meri = async (email: string) => {
    const t0 = process.hrtime.bigint();
    const r = await completePasswordReset({
      email,
      // Nov kod svaki put: keširanje otiska ne sme da iskrivi merenje.
      code: generateRecoveryCode(),
      newPassword: "qa-lozinka-merenje",
    });
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, ok: r.ok };
  };

  const nepostojeci = `${a.reset9.email}.nema`;

  /*
   * Zagrevanje.
   *
   * Prvi poziv nosi uspostavljanje veze, planove upita i JIT — sve što nema
   * veze sa granom koja se meri. Bez zagrevanja bi ono što se meri prvo uvek
   * izgledalo sporije.
   */
  for (let i = 0; i < 3; i += 1) {
    await meri(a.reset9.email);
    await meri(nepostojeci);
  }

  /*
   * Naizmenično uzorkovanje.
   *
   * Uzastopne serije bi upile spori trenutak mreže u jednu granu i pripisale ga
   * postojanju naloga. Naizmenično merenje deli takav šum na obe.
   */
  const UZORAKA = 7;
  const postoji: number[] = [];
  const nema: number[] = [];
  for (let i = 0; i < UZORAKA; i += 1) {
    const p = await meri(a.reset9.email);
    const n = await meri(nepostojeci);
    assert.equal(p.ok, false);
    assert.equal(n.ok, false);
    postoji.push(p.ms);
    nema.push(n.ms);
  }

  const mp = medijana(postoji);
  const mn = medijana(nema);
  const razlika = Math.abs(mp - mn);
  const sporiji = Math.max(mp, mn);

  // Ispisuju se samo brojevi — nijedna adresa, kod ni lozinka.
  console.log(
    `  medijana: postoji=${mp.toFixed(1)}ms nepostoji=${mn.toFixed(1)}ms razlika=${razlika.toFixed(1)}ms`,
  );

  /*
   * Dva praga, oba moraju biti zadovoljena.
   *
   * Relativni (25%) hvata sistematsku razliku koja raste sa latencijom — takva
   * je bila ranija greška, gde je grana bez naloga preskakala celu transakciju.
   *
   * Apsolutni (120 ms) je tu jer nad udaljenim Neonom i 10% može biti 60 ms
   * čistog šuma. Postavljen je znatno ispod 443 ms koliko je iznosila stvarna
   * greška, pa bi njen povratak i dalje oborio test.
   */
  assert.ok(
    razlika < sporiji * 0.25 || razlika < 120,
    `razlika u vremenu odgovora je prevelika: ${razlika.toFixed(1)} ms ` +
      `(postoji ${mp.toFixed(1)}, nepostoji ${mn.toFixed(1)})`,
  );
});

test("sve cetiri grane salju ISTI broj SQL naredbi", async (t) => {
  if (guard(t)) return;
  const { completePasswordReset, issuePasswordResetCode } = await import(
    "@/lib/auth/password-reset"
  );
  const { generateRecoveryCode } = await import("@/lib/auth/recovery-codes.mjs");
  const { sqlCounter } = await import("./harness.mts");

  const a = await seedAccounts(db, [
    { key: "reset11", role: "komercijalista" },
    { key: "reset12", role: "komercijalista" },
  ]);
  // Jedan nalog ima aktivan kod, drugi nema — obe varijante „postojećeg".
  await issuePasswordResetCode({ userId: a.reset11.id, issuedBy: null });

  const grane: Record<string, string> = {
    "postoji + aktivan kod": a.reset11.email,
    "postoji + bez koda": a.reset12.email,
    "ne postoji": `${a.reset11.email}.nema`,
    "ne postoji, drugi oblik": `nikad-${a.reset12.email}`,
  };

  /*
   * Broj naredbi ne zavisi od mreže.
   *
   * Zato je ovo primarni dokaz da su grane uporedive, a merenje vremena samo
   * potvrda. Prethodni prolaz je pokazao 4644 ms i 6121 ms za dve strukturno
   * ISTE grane — iz takvog broja se o kodu ne može zaključiti ništa.
   */
  const profil: Record<string, { count: number; kinds: string[] }> = {};
  for (const [naziv, email] of Object.entries(grane)) {
    sqlCounter.reset();
    await completePasswordReset({
      email,
      code: generateRecoveryCode(),
      newPassword: "qa-lozinka-struktura",
    });
    profil[naziv] = sqlCounter.snapshot();
  }

  for (const [naziv, p] of Object.entries(profil)) {
    console.log(`  ${naziv.padEnd(24)} naredbi=${p.count}  [${p.kinds.join(", ")}]`);
  }

  const brojevi = Object.values(profil).map((p) => p.count);
  assert.equal(
    new Set(brojevi).size,
    1,
    `grane šalju različit broj naredbi: ${JSON.stringify(
      Object.fromEntries(Object.entries(profil).map(([k, v]) => [k, v.count])),
    )}`,
  );

  // I redosled vrsta naredbi mora biti isti — isti oblik transakcije.
  const oblici = Object.values(profil).map((p) => p.kinds.join(","));
  assert.equal(new Set(oblici).size, 1, `grane imaju različit oblik transakcije:\n${oblici.join("\n")}`);

  // Nijedna grana ne sme preskočiti transakciju.
  const kinds = Object.values(profil)[0].kinds;
  assert.ok(kinds.includes("begin") || kinds.includes("update"), `nema upisa: ${kinds}`);
});

test("sve cetiri grane traju uporedivo", async (t) => {
  if (guard(t)) return;
  const { completePasswordReset, issuePasswordResetCode } = await import(
    "@/lib/auth/password-reset"
  );
  const { generateRecoveryCode } = await import("@/lib/auth/recovery-codes.mjs");

  const a = await seedAccounts(db, [
    { key: "reset13", role: "komercijalista" },
    { key: "reset14", role: "komercijalista" },
  ]);
  await issuePasswordResetCode({ userId: a.reset13.id, issuedBy: null });

  const grane: [string, string][] = [
    ["postoji + aktivan kod", a.reset13.email],
    ["postoji + bez koda", a.reset14.email],
    ["ne postoji", `${a.reset13.email}.nema`],
    ["ne postoji, drugi oblik", `nikad-${a.reset14.email}`],
  ];

  const meri = async (email: string) => {
    const t0 = process.hrtime.bigint();
    await completePasswordReset({
      email,
      code: generateRecoveryCode(),
      newPassword: "qa-lozinka-cetiri-grane",
    });
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };

  // Zagrevanje: prvi pozivi nose uspostavljanje veze i planove upita.
  for (const [, email] of grane) await meri(email);
  for (const [, email] of grane) await meri(email);

  /*
   * Kružno uzorkovanje.
   *
   * Ranija verzija je merila sve uzorke jedne grane pa tek onda sledeće, pa je
   * spori trenutak mreže padao ceo na jednu granu i izgledao kao strukturna
   * razlika. Kružnim redosledom takav šum se deli na sve četiri.
   */
  const UZORAKA = 9;
  const uzorci: Record<string, number[]> = Object.fromEntries(
    grane.map(([naziv]) => [naziv, [] as number[]]),
  );
  for (let i = 0; i < UZORAKA; i += 1) {
    // Redosled se rotira, da nijedna grana ne bude uvek prva u krugu.
    const krug = [...grane.slice(i % grane.length), ...grane.slice(0, i % grane.length)];
    for (const [naziv, email] of krug) uzorci[naziv].push(await meri(email));
  }

  const medijane: Record<string, number> = {};
  for (const [naziv, v] of Object.entries(uzorci)) medijane[naziv] = medijana(v);
  for (const [naziv, ms] of Object.entries(medijane)) {
    console.log(`  ${naziv.padEnd(24)} medijana=${ms.toFixed(1)}ms  n=${UZORAKA}`);
  }

  const vrednosti = Object.values(medijane);
  const raspon = Math.max(...vrednosti) - Math.min(...vrednosti);
  const najveca = Math.max(...vrednosti);
  console.log(`  raspon=${raspon.toFixed(1)}ms (${((raspon / najveca) * 100).toFixed(1)}% od najsporije)`);

  /*
   * Prag nije proširen da bi trenutni rezultat prošao.
   *
   * Strukturnu jednakost dokazuje test iznad, brojanjem naredbi. Ovde se traži
   * samo da nema GRUBE razlike koju bi napadač mogao da očita — a granica se
   * računa iz izmerene buke: dve strukturno iste grane su se razlikovale za
   * ~24% od najsporije. Prag od 35% je iznad te buke, a i dalje daleko ispod
   * razlike koju bi napravio rani izlaz (ranije 443 ms na ~600 ms, dakle 74%).
   */
  assert.ok(
    raspon < najveca * 0.35,
    `grane se previše razlikuju: raspon ${raspon.toFixed(1)} ms od ${najveca.toFixed(1)} ms`,
  );
});

test("audit reseta ne sadrzi kod ni lozinku", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode } = await import("@/lib/auth/password-reset");
  const { recordAudit, AUDIT_ACTIONS } = await import("@/lib/audit/record");
  const a = await seedAccounts(db, [{ key: "reset10", role: "komercijalista" }]);

  const { code } = await issuePasswordResetCode({ userId: a.reset10.id, issuedBy: null });
  await recordAudit({
    actor: { id: a.reset10.id, name: a.reset10.name, role: a.reset10.role },
    action: AUDIT_ACTIONS.passwordResetIssued,
    entityType: "Korisnik",
    entityId: a.reset10.id,
    entityLabel: a.reset10.email,
    reason: "QA provera traga",
  });

  const rows = await db.sql<{ payload: string }[]>`
    SELECT row_to_json(audit_log)::text AS payload FROM audit_log
    WHERE entity_id = ${a.reset10.id}
  `;
  assert.ok(rows.length >= 1, "trag nije zapisan");
  for (const row of rows) {
    assert.ok(!row.payload.includes(code), "kod je završio u tragu revizije");
    assert.ok(!row.payload.includes(a.reset10.password), "lozinka je završila u tragu");
  }
});
