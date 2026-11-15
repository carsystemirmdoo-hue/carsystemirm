import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import net from "node:net";
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
 * Pozivnica mejlom (2026-11-14): ista kapija kao ručni poziv, rok 7 dana, outbox `sent`,
 * link postoji samo u mejlu (ne u tragu), i link iz mejla stvarno aktivira nalog.
 * SMTP je lažni lokalni server (bez TLS-a) — ništa ne izlazi na mrežu.
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
let smtp: { server: net.Server; port: number; mails: string[] };
let fx: { customerId: string; office: { id: string; name: string; role: string }; rep: { id: string; name: string } };
const actor = () => ({ id: fx.office.id, name: fx.office.name, role: fx.office.role });

function fakeSmtp(): Promise<typeof smtp> {
  const mails: string[] = [];
  const server = net.createServer((s) => {
    s.setEncoding("utf8");
    s.on("error", () => {});
    let inData = false;
    let buf = "";
    let data = "";
    s.write("220 lazni.test ESMTP\r\n");
    s.on("data", (chunk: string) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            mails.push(data);
            data = "";
            s.write("250 OK\r\n");
          } else data += `${line}\r\n`;
          continue;
        }
        if (line.startsWith("EHLO")) s.write("250-lazni.test\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (line.startsWith("AUTH PLAIN")) s.write("235 OK\r\n");
        else if (line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) s.write("250 OK\r\n");
        else if (line === "DATA") {
          inData = true;
          s.write("354 Go\r\n");
        } else if (line === "QUIT") {
          s.write("221 Bye\r\n");
          s.end();
        }
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ server, mails, port: (server.address() as net.AddressInfo).port })),
  );
}

/** Tekstualni deo poruke (base64) u čitljivom obliku. */
function plainText(raw: string): string {
  const part = raw.split(/Content-Type: text\/plain[^\r\n]*\r\n/)[1] ?? "";
  const body = part.split(/\r\n\r\n/)[1]?.split(/\r\n--/)[0] ?? "";
  return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  smtp = await fakeSmtp();
  Object.assign(process.env, {
    SMTP_USER: "portal@example.com",
    SMTP_PASSWORD: "abcd efgh ijkl mnop",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtp.port),
    PUBLIC_BASE_URL: "https://carsystemirm.com",
  });
  const run = randomUUID().slice(0, 8);
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}m`}, 'QA Pozivnica Kupac') RETURNING id`;
  const accounts = await seedAccounts(db, [
    { key: "office", role: "kancelarija" },
    { key: "rep", role: "komercijalista" },
  ]);
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customer.id}, ${accounts.rep.id})`;
  fx = { customerId: customer.id, office: accounts.office, rep: accounts.rep };
});

after(async () => {
  if (!reason && db) {
    await db.sql`TRUNCATE customer_contact_verifications`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = 'QA-PM'`;
    await db.sql`DELETE FROM customer_account_tokens`;
    await db.sql`DELETE FROM customer_message_outbox`;
    await db.sql`DELETE FROM customer_users`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id = ${fx.customerId}`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  smtp?.server.close();
  await closeTestDatabase();
});

async function contact(verified: boolean): Promise<{ id: string; email: string }> {
  const { proposeCustomerContact } = await import("@/lib/customers/account-service");
  const email = `qa-pozivnica-${randomUUID().slice(0, 8)}@qa-1b.invalid`;
  const { id } = await proposeCustomerContact(
    { customerId: fx.customerId, email, name: "Petar Kupac", reason: "QA predlog kontakta" },
    actor(),
  );
  if (verified) {
    const { verifyCustomerContact } = await import("@/lib/customers/verification-service");
    const [identifier] = await db.sql<{ id: string }[]>`
      INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
      VALUES ('biznisoft', 'QA-PM', 'PM-1', ${fx.customerId}, 'mapped')
      ON CONFLICT (source_system, issuer_code, external_partner_code) DO UPDATE SET status = 'mapped'
      RETURNING id`;
    await verifyCustomerContact(
      {
        accountId: id,
        basisIdentifierId: identifier.id,
        method: "callback_known_number",
        contactSource: "provided_by_company",
        evidenceNote: "QA: povratni poziv na broj sa kartice partnera.",
        personRole: "nabavka",
      },
      actor(),
    );
  }
  return { id, email };
}

test("nepotvrđena osoba ne dobija pozivnicu i mejl ne odlazi", async (t) => {
  if (guard(t)) return;
  const { sendInvitationEmail } = await import("@/lib/customers/invitation-email");
  const { id } = await contact(false);
  const before = smtp.mails.length;
  await assert.rejects(sendInvitationEmail(id, actor()));
  assert.equal(smtp.mails.length, before);
});

test("pozivnica: mejl kupcu, komercijalista po imenu, rok 7 dana, outbox sent, link aktivira nalog", async (t) => {
  if (guard(t)) return;
  const { sendInvitationEmail } = await import("@/lib/customers/invitation-email");
  const { activateWithInvitation } = await import("@/lib/customers/invitation-service");
  const { id, email } = await contact(true);

  const r = await sendInvitationEmail(id, actor());
  assert.equal(r.ok, true, r.text);
  const raw = smtp.mails.at(-1)!;
  assert.match(raw, new RegExp(`^To: .*${email.replace(/[.]/g, "\\.")}`, "m"));
  const text = plainText(raw);
  assert.match(text, new RegExp(`Vaš komercijalista je ${fx.rep.name}\\.`));
  assert.match(text, /022 558 501/);
  assert.match(text, /važi 7 dana/);

  const [tok] = await db.sql<{ expires_at: Date }[]>`
    SELECT expires_at FROM customer_account_tokens WHERE customer_user_id = ${id} AND used_at IS NULL AND superseded_at IS NULL`;
  const days = (new Date(tok.expires_at).getTime() - Date.now()) / 86_400_000;
  assert.ok(days > 6.9 && days <= 7, `rok je ${days} dana`);

  const [box] = await db.sql<{ status: string; handed_over_by: string | null }[]>`
    SELECT status, handed_over_by FROM customer_message_outbox WHERE customer_user_id = ${id}`;
  assert.equal(box.status, "sent");
  assert.equal(box.handed_over_by, fx.office.id);

  const token = decodeURIComponent(/aktivacija\?token=([^\s]+)/.exec(text)![1]);
  const audit = await db.sql<{ payload: string }[]>`
    SELECT coalesce(value_before::text,'') || coalesce(value_after::text,'') || coalesce(reason,'') || coalesce(entity_label,'') AS payload
      FROM audit_log WHERE entity_id = ${id}`;
  assert.ok(audit.length >= 2);
  for (const row of audit) assert.ok(!row.payload.includes(token), "token u tragu");

  assert.deepEqual(await activateWithInvitation({ token, password: "kupceva-lozinka-123" }), { ok: true });
  const [acc] = await db.sql<{ status: string }[]>`SELECT status FROM customer_users WHERE id = ${id}`;
  assert.equal(acc.status, "active");
});
