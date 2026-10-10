import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import type { CustomerSession } from "@/lib/authz/customer-session";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { isPreparedForPortal } from "@/lib/customers/commercial-status.mjs";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { formatRequestNumber, lineAmounts, MAX_LINE_QUANTITY, orderTotals, parseQuantity, quantityProblem, quoteKey, transitionProblem } from "@/lib/ordering/orderRules.mjs";
import { customerPrices } from "@/lib/pricing/customer-price-service";
import { approvedPaymentOptions } from "@/lib/pricing/payment-option-service";
import { optionLabel, optionNote } from "@/lib/pricing/paymentOptions.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { foldedMatch } from "@/lib/ordering/search-fold";

/**
 * Zahtev za porudžbinu iz STVARNOG cenovnika (0044):
 * osnovna cena (article_base_prices) − odobren rabat kupca za izabranu odobrenu
 * opciju plaćanja. Kupac bira jednu opciju za ceo zahtev. Stavka bez potvrđene
 * cene za tu opciju je „na upit“: bez iznosa, ne ulazi u zbir, ne izmišlja se.
 *
 * Uključuje se sa CUSTOMER_ORDERING=cenovnik. Slanje NE pravi fakturu ni
 * rezervaciju u BizniSoftu: kancelarija proverava, štampa i unosi ručno.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Exec = Database | Tx;

/** Globalni prekidač (svi kupci). Za pojedinačnog kupca koristiti `orderingEnabledFor`. */
export function requestOrderingEnabled() {
  return process.env.CUSTOMER_ORDERING === "cenovnik";
}

const PIECES = ["KOM", "KT"];
const stepFor = (unit: string | null) => (PIECES.includes(String(unit ?? "").toUpperCase()) ? 1 : 0.1);

export type OptionPrice =
  | { status: "cena"; listPrice: number; discountPercent: number; netPrice: number; vatPercent: number; basis: string }
  | { status: "na_upit"; reason: string; message: string };

export type RequestLine = {
  articleId: string;
  articleCode: string;
  articleName: string;
  unit: string;
  packLabel: string;
  packConfirmed: boolean;
  quantity: number;
  step: number;
  quantityProblem: string | null;
  problem: string | null;
  byOption: Record<string, OptionPrice>;
  /** Za izabranu opciju. */
  selected: OptionPrice | null;
  amounts: { net: number; vat: number; gross: number } | null;
};

export type RequestQuote = {
  enabled: boolean;
  reason: string | null;
  options: { code: string | null; key: string; label: string; note: string }[];
  selected: string | null;
  lines: RequestLine[];
  totals: { net: number; vat: number; gross: number };
  onRequest: number;
  fingerprint: string;
  canSubmit: boolean;
  blockers: string[];
  correcting: { orderId: string; requestNumber: string } | null;
};

const keyOf = (code: string | null) => code ?? "osnovni";

async function priceLines(exec: Exec, customerId: string, items: { articleId: string; quantity: number }[], option: string | null, today: string) {
  const ids = items.map((i) => i.articleId);
  const [opts, arts, vats] = await Promise.all([
    approvedPaymentOptions(customerId, today),
    ids.length
      ? exec.execute<{ id: string; code: string; name: string; unit: string | null; out: boolean }>(sql`
          SELECT a.id, a.code, a.name, a.unit, EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out
            FROM articles a WHERE a.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)
      : Promise.resolve([] as { id: string; code: string; name: string; unit: string | null; out: boolean }[]),
    ids.length
      ? exec.execute<{ article_id: string; vat: string }>(sql`
          SELECT DISTINCT ON (article_id) article_id, vat_percent::text AS vat FROM article_base_prices
           WHERE valid_from <= ${today}::date AND article_id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})
           ORDER BY article_id, valid_from DESC, created_at DESC`)
      : Promise.resolve([] as { article_id: string; vat: string }[]),
  ]);
  const codes: (string | null)[] = opts.length ? opts : [null];
  const options = codes.map((c) => ({ code: c, key: keyOf(c), label: optionLabel(c), note: optionNote(c) }));
  const selected = codes.includes(option) ? option : codes[0];
  const vat = new Map([...vats].map((v) => [v.article_id, Number(v.vat)]));
  const byId = new Map([...arts].map((a) => [a.id, a]));
  const perOption = new Map<string, Awaited<ReturnType<typeof customerPrices>>["prices"]>();
  for (const c of codes) perOption.set(keyOf(c), (await customerPrices(customerId, ids, today, c)).prices);
  const lines: RequestLine[] = items.map((it) => {
    const a = byId.get(it.articleId)!;
    const unit = (a.unit ?? "").toUpperCase() || "JM";
    const step = stepFor(unit);
    const byOption: Record<string, OptionPrice> = {};
    let pack: { confirmed: boolean; label: string } = { confirmed: false, label: `JM: ${unit}` };
    for (const c of codes) {
      const p = perOption.get(keyOf(c))!.get(it.articleId);
      if (p && p.status === "cena" && p.baseCents !== null && vat.has(it.articleId)) {
        byOption[keyOf(c)] = {
          status: "cena",
          listPrice: p.baseCents / 100,
          discountPercent: p.discountPercent ?? 0,
          netPrice: p.netCents / 100,
          vatPercent: vat.get(it.articleId)!,
          basis: `${p.basis} · ${optionLabel(c)}`,
        };
        if (p.pack && p.pack.status === "cena_pakovanja") pack = { confirmed: true, label: `${p.pack.packQuantity} ${p.pack.unit}` };
      } else {
        const reason = p && "reason" in p ? String(p.reason) : "nema_cene";
        byOption[keyOf(c)] = { status: "na_upit", reason, message: p && "message" in p ? p.message : "Cena na upit." };
      }
    }
    const qp = quantityProblem(it.quantity, { minQuantity: step, quantityStep: step });
    const sel = byOption[keyOf(selected)];
    const problem = a.out ? "Artikal nije u aktuelnoj ponudi." : null;
    return {
      articleId: a.id,
      articleCode: a.code,
      articleName: a.name,
      unit,
      packLabel: pack.label,
      packConfirmed: pack.confirmed,
      quantity: it.quantity,
      step,
      quantityProblem: qp,
      problem,
      byOption,
      selected: sel,
      amounts:
        sel.status === "cena" && !qp && !problem
          ? lineAmounts({ quantity: it.quantity, netPrice: sel.netPrice, vatPercent: sel.vatPercent, listPrice: sel.listPrice, discountPercent: sel.discountPercent })
          : null,
    };
  });
  return { options, selected, lines };
}

function fingerprintOf(option: string | null, lines: RequestLine[]) {
  const key = `${keyOf(option)}#${quoteKey(lines.map((l) => ({ articleId: l.articleId, quantity: l.quantity, netPrice: l.selected?.status === "cena" ? l.selected.netPrice : -1, vatPercent: l.selected?.status === "cena" ? l.selected.vatPercent : -1 })))}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

/** Korpa firme kao zahtev, sa cenama za SVE odobrene opcije i zbirom za izabranu. */
export async function loadRequestQuote(customerId: string, option: string | null, exec: Exec = getDb()): Promise<RequestQuote> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const today = belgradeDate(new Date());
  const enabled = await orderingEnabledFor(customerId);
  const cart = [...(await exec.execute<{ article_id: string; quantity: string; source_order_id: string | null }>(sql`
    SELECT article_id, quantity::text AS quantity, source_order_id FROM customer_cart_items WHERE customer_id = ${customerId} ORDER BY created_at, article_id`))];
  const priced = await priceLines(exec, customerId, cart.map((c) => ({ articleId: c.article_id, quantity: Number(c.quantity) })), option, today);
  const sources = [...new Set(cart.map((c) => c.source_order_id).filter((x): x is string => Boolean(x)))];
  let correcting: RequestQuote["correcting"] = null;
  if (sources.length === 1) {
    const [src] = [...(await exec.execute<{ id: string; request_number: string; replaced: boolean }>(sql`
      SELECT o.id, o.request_number, EXISTS (SELECT 1 FROM customer_orders r WHERE r.replaces_order_id = o.id AND r.status <> 'cancelled') AS replaced
        FROM customer_orders o WHERE o.id = ${sources[0]}::uuid AND o.customer_id = ${customerId}`))];
    if (src && !src.replaced) correcting = { orderId: src.id, requestNumber: src.request_number };
  }
  const valid = priced.lines.filter((l) => l.amounts);
  const blockers = [
    ...(enabled ? [] : ["Poručivanje preko sajta još nije uključeno."]),
    ...(cart.length ? [] : ["Korpa je prazna."]),
    ...priced.lines.filter((l) => l.problem).map((l) => `${l.articleName}: ${l.problem}`),
    ...priced.lines.filter((l) => l.quantityProblem).map((l) => `${l.articleName}: ${l.quantityProblem}`),
  ];
  return {
    enabled,
    reason: enabled ? null : "Poručivanje preko sajta još nije uključeno.",
    options: priced.options,
    selected: priced.selected,
    lines: priced.lines,
    totals: orderTotals(valid.map((l) => ({ quantity: l.quantity, netPrice: (l.selected as { netPrice: number }).netPrice, vatPercent: (l.selected as { vatPercent: number }).vatPercent, listPrice: (l.selected as { listPrice: number }).listPrice, discountPercent: (l.selected as { discountPercent: number }).discountPercent }))),
    onRequest: priced.lines.filter((l) => l.selected?.status === "na_upit").length,
    fingerprint: fingerprintOf(priced.selected, priced.lines),
    canSubmit: blockers.length === 0,
    blockers,
    correcting,
  };
}

/* ---------------------------------------------------------------------------
 * Izbor robe i korpa
 * ------------------------------------------------------------------------ */

/** Artikli koje kupac može da izabere: u programu, sa osnovnom cenom ili ranije kupljeni. Pretraga po šifri/nazivu. */
export async function listRequestArticles(customerId: string, query: string | null, limit = 60) {
  const q = (query ?? "").trim().slice(0, 60);
  const rows = await getDb().execute<{ id: string; code: string; name: string; unit: string | null; bought: boolean; last_on: string | null }>(sql`
    SELECT a.id, a.code, a.name, a.unit,
           EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid) AS bought,
           (SELECT max(i.issued_on)::text FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid) AS last_on
      FROM articles a
     WHERE NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       AND (EXISTS (SELECT 1 FROM article_base_prices b WHERE b.article_id = a.id)
            OR EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid))
       AND ${q ? foldedMatch([sql`a.code`, sql`a.name`], q) : sql`EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid)`}
     ORDER BY bought DESC, last_on DESC NULLS LAST, a.code
     LIMIT ${limit}`);
  const today = belgradeDate(new Date());
  const priced = await priceLines(getDb(), customerId, rows.map((r) => ({ articleId: r.id, quantity: stepFor(r.unit) })), null, today);
  return { options: priced.options, articles: priced.lines.map((l, i) => ({ ...l, bought: rows[i].bought, lastOn: rows[i].last_on })) };
}

export type RequestCartChange = { ok: true; count: number; lineQuantity?: number } | { ok: false; message: string };

async function cartCount(customerId: string, exec: Exec = getDb()) {
  const [{ n }] = [...(await exec.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM customer_cart_items WHERE customer_id = ${customerId}`))];
  return n;
}

export async function addRequestItem(session: CustomerSession, input: { articleId: string; quantity: unknown }): Promise<RequestCartChange> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (!(await orderingEnabledFor(customerId))) return { ok: false, message: "Poručivanje preko sajta još nije uključeno." };
  if (!/^[0-9a-f-]{36}$/.test(input.articleId)) return { ok: false, message: "Neispravan artikal." };
  const db = getDb();
  const [a] = [...(await db.execute<{ unit: string | null; out: boolean; ok: boolean }>(sql`
    SELECT a.unit, EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out,
           (EXISTS (SELECT 1 FROM article_base_prices b WHERE b.article_id = a.id)
            OR EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid)) AS ok
      FROM articles a WHERE a.id = ${input.articleId}::uuid`))];
  if (!a || !a.ok) return { ok: false, message: "Artikal nije dostupan za zahtev." };
  if (a.out) return { ok: false, message: "Artikal nije u aktuelnoj ponudi." };
  const step = stepFor(a.unit);
  const qp = quantityProblem(input.quantity, { minQuantity: step, quantityStep: step });
  if (qp) return { ok: false, message: qp };
  await db.execute(sql`
    INSERT INTO customer_cart_items (customer_id, article_id, quantity, added_by)
    VALUES (${customerId}, ${input.articleId}::uuid, ${parseQuantity(input.quantity)}, ${session.accountId})
    ON CONFLICT (customer_id, article_id)
    DO UPDATE SET quantity = LEAST(customer_cart_items.quantity + EXCLUDED.quantity, ${MAX_LINE_QUANTITY}), updated_at = now()`);
  const [line] = [...(await db.execute<{ q: string }>(sql`SELECT quantity::text AS q FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`))];
  return { ok: true, count: await cartCount(customerId, db), lineQuantity: line ? Number(line.q) : undefined };
}

export async function setRequestQuantity(session: CustomerSession, input: { articleId: string; quantity: unknown }): Promise<RequestCartChange> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const db = getDb();
  if (String(input.quantity ?? "").trim() === "" || Number(input.quantity) === 0) {
    await db.execute(sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`);
    return { ok: true, count: await cartCount(customerId, db) };
  }
  const [a] = [...(await db.execute<{ unit: string | null }>(sql`
    SELECT a.unit FROM customer_cart_items c JOIN articles a ON a.id = c.article_id WHERE c.customer_id = ${customerId} AND c.article_id = ${input.articleId}::uuid`))];
  if (!a) return { ok: false, message: "Stavka nije u korpi." };
  const step = stepFor(a.unit);
  const qp = quantityProblem(input.quantity, { minQuantity: step, quantityStep: step });
  if (qp) return { ok: false, message: qp };
  await db.execute(sql`UPDATE customer_cart_items SET quantity = ${parseQuantity(input.quantity)}, updated_at = now() WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`);
  return { ok: true, count: await cartCount(customerId, db) };
}

/* ---------------------------------------------------------------------------
 * Slanje
 * ------------------------------------------------------------------------ */

export type RequestSubmitResult =
  | { status: "created" | "existing"; orderId: string; requestNumber: string }
  | { status: "reauth"; message: string }
  | { status: "price_changed"; message: string }
  | { status: "blocked"; message: string; blockers: string[] };

const clip = (v: unknown, n: number) => (v ? String(v).trim().slice(0, n) || null : null);

async function existingByKey(exec: Exec, key: string) {
  const [r] = [...(await exec.execute<{ id: string; customer_id: string; request_number: string }>(sql`
    SELECT id, customer_id, request_number FROM customer_orders WHERE idempotency_key = ${key}`))];
  return r ?? null;
}

/** Razlog „na upit“ u dokumentu: neutralan tekst (čita ga i kancelarija i kupac). */
const ON_REQUEST_NOTE: Record<string, string> = {
  rabat_nepoznat: "rabat kupca za ovaj artikal nije odobren",
  nema_osnovne_cene: "artikal nema važeću osnovnu cenu",
  izuzetak_za_pregled: "poseban dogovor artikla — proveriti za izabranu opciju plaćanja",
  rabat_u_sukobu: "uslovi u sukobu — proveriti",
};

async function insertLines(tx: Tx, orderId: string, lines: RequestLine[]) {
  let n = 0;
  for (const l of lines) {
    n += 1;
    const p = l.selected!;
    if (p.status === "cena") {
      await tx.execute(sql`
        INSERT INTO customer_order_lines (order_id, line_number, article_id, article_code, article_name, unit, pack_label, pack_confirmed, quantity,
          list_price, discount_percent, net_price, vat_percent, line_net, line_vat, line_gross, price_basis, price_status)
        VALUES (${orderId}, ${n}, ${l.articleId}, ${l.articleCode}, ${l.articleName}, ${l.unit}, ${l.packLabel}, ${l.packConfirmed}, ${l.quantity},
          ${p.listPrice}, ${p.discountPercent}, ${p.netPrice}, ${p.vatPercent}, ${l.amounts!.net}, ${l.amounts!.vat}, ${l.amounts!.gross}, ${p.basis}, 'cena')`);
    } else {
      await tx.execute(sql`
        INSERT INTO customer_order_lines (order_id, line_number, article_id, article_code, article_name, unit, pack_label, pack_confirmed, quantity,
          list_price, discount_percent, net_price, vat_percent, line_net, line_vat, line_gross, price_basis, price_status, on_request_reason)
        VALUES (${orderId}, ${n}, ${l.articleId}, ${l.articleCode}, ${l.articleName}, ${l.unit}, ${l.packLabel}, ${l.packConfirmed}, ${l.quantity},
          NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${"cena na upit"}, 'na_upit', ${ON_REQUEST_NOTE[p.reason] ?? "cenu potvrđuje kancelarija"})`);
    }
  }
}

/**
 * Slanje zahteva. Server: opcija mora biti odobrena tom kupcu i važiti danas;
 * cena se računa ponovo u transakciji (otisak); isti ključ → isti zahtev.
 */
export async function submitOrderRequest(
  session: CustomerSession,
  input: { idempotencyKey: string; fingerprint: string; paymentOption: string | null; note?: string | null; deliveryAddress?: string | null; contactPhone?: string | null },
): Promise<RequestSubmitResult> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (session.assurance === "remembered") return { status: "reauth", message: "Radi sigurnosti, pre slanja ponovo unesite lozinku." };
  const key = String(input.idempotencyKey ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(key)) return { status: "blocked", message: "Neispravan zahtev.", blockers: [] };
  const db = getDb();
  const earlier = await existingByKey(db, key);
  if (earlier) return earlier.customer_id === customerId ? { status: "existing", orderId: earlier.id, requestNumber: earlier.request_number } : { status: "blocked", message: "Neispravan zahtev.", blockers: [] };
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`);
      const again = await existingByKey(tx, key);
      if (again) return again.customer_id === customerId ? { status: "existing" as const, orderId: again.id, requestNumber: again.request_number } : { status: "blocked" as const, message: "Neispravan zahtev.", blockers: [] };
      const [st] = [...(await tx.execute<{ status: string }>(sql`SELECT status FROM customer_commercial_status WHERE customer_id = ${customerId}::uuid`))];
      if (st && !isPreparedForPortal(st.status)) return { status: "blocked" as const, message: "Zahtev preko sajta nije dostupan za ovu firmu. Javite se kancelariji.", blockers: [] };
      const today = belgradeDate(new Date());
      const approved = await approvedPaymentOptions(customerId, today);
      const opt = input.paymentOption ?? null;
      if (approved.length ? !approved.includes(opt ?? "") : opt !== null) {
        // Opcija je opozvana ili promenjena posle prikaza korpe: nova potvrda kupca, ne tiha zamena.
        return { status: "price_changed" as const, message: "Izabrana opcija plaćanja više nije odobrena za Vašu firmu. Izaberite odobrenu opciju, pregledajte nove iznose i potvrdite ponovo." };
      }
      const quote = await loadRequestQuote(customerId, opt, tx);
      if (!quote.canSubmit) return { status: "blocked" as const, message: "Zahtev se ne može poslati.", blockers: quote.blockers };
      if (quote.fingerprint !== input.fingerprint) {
        return { status: "price_changed" as const, message: "Cene, opcija plaćanja ili stavke su se promenile od prikaza. Pregledajte nove iznose i potvrdite ponovo." };
      }
      const year = Number(today.slice(0, 4));
      const [{ n }] = [...(await tx.execute<{ n: string }>(sql`SELECT nextval('customer_order_request_seq')::text AS n`))];
      const requestNumber = formatRequestNumber(year, Number(n));
      const correcting = quote.correcting?.orderId ?? null;
      const [order] = [...(await tx.execute<{ id: string }>(sql`
        INSERT INTO customer_orders (customer_id, submitted_by, request_number, status, idempotency_key, pricing_source, currency,
                                     net_total, vat_total, gross_total, customer_note, replaces_order_id, payment_option, payment_option_label,
                                     delivery_address, contact_phone, on_request_lines)
        VALUES (${customerId}, ${session.accountId}, ${requestNumber}, 'submitted', ${key}, 'cenovnik', 'RSD',
                ${quote.totals.net}, ${quote.totals.vat}, ${quote.totals.gross}, ${clip(input.note, 1000)}, ${correcting}::uuid, ${opt}, ${opt ? optionLabel(opt) : null},
                ${clip(input.deliveryAddress, 300)}, ${clip(input.contactPhone, 40)}, ${quote.onRequest})
        RETURNING id`))];
      if (correcting) {
        await tx.execute(sql`INSERT INTO customer_order_events (order_id, kind, actor_customer_user_id, actor_name, reason)
                             VALUES (${correcting}::uuid, 'replaced', ${session.accountId}, ${session.name}, ${`Ispravka poslata kao ${requestNumber}`})`);
      }
      await insertLines(tx, order.id, quote.lines);
      await tx.execute(sql`INSERT INTO customer_order_events (order_id, from_status, to_status, kind, actor_customer_user_id, actor_name)
                           VALUES (${order.id}, NULL, 'submitted', 'submitted', ${session.accountId}, ${session.name})`);
      await tx.execute(sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`);
      return { status: "created" as const, orderId: order.id, requestNumber };
    });
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      const found = await existingByKey(db, key);
      if (found && found.customer_id === customerId) return { status: "existing", orderId: found.id, requestNumber: found.request_number };
    }
    throw error;
  }
}

/* ---------------------------------------------------------------------------
 * Izmenjen predlog kancelarije → potvrda kupca
 * ------------------------------------------------------------------------ */

async function statusEvent(tx: Tx, orderId: string, from: string | null, to: string, actor: { staff?: PortalUser; customer?: CustomerSession }, reason: string | null) {
  await tx.execute(sql`
    INSERT INTO customer_order_events (order_id, from_status, to_status, kind, actor_user_id, actor_customer_user_id, actor_name, reason)
    VALUES (${orderId}, ${from}::customer_order_status, ${to}::customer_order_status, 'status', ${actor.staff?.id ?? null}, ${actor.customer?.accountId ?? null},
            ${actor.staff?.name ?? actor.customer?.name ?? "—"}, ${reason})`);
}

/**
 * Kancelarija priprema IZMENJEN PREDLOG (roba, količine; cene po važećim odobrenim
 * uslovima i istoj opciji plaćanja). Original ostaje netaknut ('changes_requested'
 * sa razlogom); predlog je nova verzija koja čeka potvrdu kupca.
 */
export async function proposeOrderRevision(viewer: PortalUser, orderId: string, input: { lines: { articleId: string; quantity: number }[]; reason: string }) {
  if (!can(viewer, "customer_orders:review")) throw new Error("Nemate pravo da menjate zahteve.");
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Razlog izmene: najmanje 5 znakova.");
  const items = input.lines.filter((l) => l.quantity > 0);
  if (!items.length) throw new Error("Izmenjen predlog mora imati bar jednu stavku.");
  const scope = await resolveLedgerScope(viewer);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [o] = [...(await tx.execute<{ id: string; customer_id: string; status: string; request_number: string; revision: number; payment_option: string | null; pricing_source: string; delivery_address: string | null; contact_phone: string | null; customer_note: string | null }>(sql`
      SELECT id, customer_id, status::text AS status, request_number, revision, payment_option, pricing_source, delivery_address, contact_phone, customer_note
        FROM customer_orders WHERE id = ${orderId}::uuid FOR UPDATE`))];
    if (!o) throw new Error("Zahtev ne postoji.");
    if (scope.customerIds !== null && !scope.customerIds.includes(o.customer_id)) throw new Error("Zahtev nije u Vašem opsegu.");
    if (o.pricing_source !== "cenovnik") throw new Error("Izmenjen predlog važi samo za zahteve iz stvarnog cenovnika.");
    if (!["submitted", "under_review", "changes_requested"].includes(o.status)) throw new Error("Predlog izmene je moguć dok je zahtev poslat, u obradi ili čeka izmenu.");
    // Posle odbijenog predloga (otkazan) sme novi; dok jedan čeka kupca ili je potvrđen — ne.
    const [active] = [...(await tx.execute<{ n: string }>(sql`
      SELECT request_number AS n FROM customer_orders WHERE replaces_order_id = ${o.id}::uuid AND status <> 'cancelled' LIMIT 1`))];
    if (active) throw new Error(`Za ovaj zahtev već postoji predlog ${active.n}. Novi je moguć tek ako ga kupac odbije.`);
    const today = belgradeDate(new Date());
    const approved = await approvedPaymentOptions(o.customer_id, today);
    if (o.payment_option && !approved.includes(o.payment_option)) throw new Error("Opcija plaćanja iz zahteva više nije odobrena — dogovorite novu sa kupcem.");
    const priced = await priceLines(tx, o.customer_id, items, o.payment_option, today);
    const bad = priced.lines.filter((l) => l.problem || l.quantityProblem);
    if (bad.length) throw new Error(bad.map((l) => `${l.articleCode}: ${l.problem ?? l.quantityProblem}`).join("; "));
    const valid = priced.lines.filter((l) => l.amounts);
    const totals = orderTotals(valid.map((l) => ({ quantity: l.quantity, netPrice: (l.selected as { netPrice: number }).netPrice, vatPercent: (l.selected as { vatPercent: number }).vatPercent, listPrice: (l.selected as { listPrice: number }).listPrice, discountPercent: (l.selected as { discountPercent: number }).discountPercent })));
    // Original: u obradu (ako nije) pa „potrebna izmena“ sa razlogom — ostaje netaknut.
    if (o.status === "submitted") {
      await tx.execute(sql`UPDATE customer_orders SET status = 'under_review', reviewed_by = ${viewer.id}::uuid, reviewed_at = now(), updated_at = now() WHERE id = ${o.id}::uuid`);
      await statusEvent(tx, o.id, "submitted", "under_review", { staff: viewer }, null);
    }
    const [{ last }] = [...(await tx.execute<{ last: number }>(sql`
      SELECT coalesce(max(revision), ${o.revision})::int AS last FROM customer_orders WHERE replaces_order_id = ${o.id}::uuid`))];
    const rev = Math.max(o.revision, last) + 1;
    const number = `${o.request_number}/${rev}`;
    const why = `Kancelarija je pripremila izmenjen predlog ${number}: ${reason}`;
    if (o.status === "changes_requested") {
      await tx.execute(sql`UPDATE customer_orders SET status_reason = ${why}, decided_by = ${viewer.id}::uuid, decided_at = now(), updated_at = now() WHERE id = ${o.id}::uuid`);
    } else {
      const problem = transitionProblem({ from: "under_review", to: "changes_requested", actor: "office", reason: why });
      if (problem) throw new Error(problem);
      await tx.execute(sql`UPDATE customer_orders SET status = 'changes_requested', status_reason = ${why}, decided_by = ${viewer.id}::uuid, decided_at = now(), updated_at = now() WHERE id = ${o.id}::uuid`);
      await statusEvent(tx, o.id, "under_review", "changes_requested", { staff: viewer }, why);
    }
    const [nw] = [...(await tx.execute<{ id: string }>(sql`
      INSERT INTO customer_orders (customer_id, submitted_by, prepared_by, request_number, status, idempotency_key, pricing_source, currency,
                                   net_total, vat_total, gross_total, customer_note, status_reason, replaces_order_id, payment_option, payment_option_label,
                                   delivery_address, contact_phone, on_request_lines, revision)
      VALUES (${o.customer_id}, NULL, ${viewer.id}::uuid, ${number}, 'awaiting_customer', ${randomUUID()}, 'cenovnik', 'RSD',
              ${totals.net}, ${totals.vat}, ${totals.gross}, ${o.customer_note}, ${reason}, ${o.id}::uuid, ${o.payment_option}, ${o.payment_option ? optionLabel(o.payment_option) : null},
              ${o.delivery_address}, ${o.contact_phone}, ${priced.lines.filter((l) => l.selected?.status === "na_upit").length}, ${rev})
      RETURNING id`))];
    await insertLines(tx, nw.id, priced.lines);
    await statusEvent(tx, nw.id, null, "awaiting_customer", { staff: viewer }, reason);
    await recordAudit(
      { actor: { id: viewer.id, name: viewer.name, role: viewer.role }, action: AUDIT_ACTIONS.orderRevisionProposed, entityType: "Zahtev za porudžbinu", entityId: nw.id, entityLabel: number, before: { original: o.request_number }, after: { stavki: priced.lines.length, verzija: rev }, reason },
      tx,
    );
    return { orderId: nw.id, requestNumber: number };
  });
}

/** Zahtev iz opsega kancelarije koji sme da dobije izmenjen predlog (bez upisa). */
async function revisableOrder(viewer: PortalUser, orderId: string) {
  if (!can(viewer, "customer_orders:review")) throw new Error("Nemate pravo da menjate zahteve.");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new Error("Zahtev ne postoji.");
  const scope = await resolveLedgerScope(viewer);
  const [o] = [...(await getDb().execute<{ id: string; customer_id: string; payment_option: string | null }>(sql`
    SELECT id, customer_id, payment_option FROM customer_orders WHERE id = ${orderId}::uuid AND pricing_source = 'cenovnik'`))];
  if (!o || (scope.customerIds !== null && !scope.customerIds.includes(o.customer_id))) throw new Error("Zahtev ne postoji.");
  return o;
}

/** Pretraga artikala za izmenjen predlog: šifra ili naziv, bez artikala van programa. */
export async function searchRevisionArticles(viewer: PortalUser, orderId: string, query: string) {
  await revisableOrder(viewer, orderId);
  const q = String(query ?? "").trim().slice(0, 60);
  if (q.length < 2) return [];
  const rows = await getDb().execute<{ code: string; name: string; unit: string | null }>(sql`
    SELECT a.code, a.name, a.unit FROM articles a
     WHERE ${foldedMatch([sql`a.code`, sql`a.name`], q)}
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
     ORDER BY (a.code = ${q}) DESC, a.name LIMIT 12`);
  return [...rows].map((r) => ({ code: r.code, name: r.name, unit: r.unit ?? "" }));
}

/** Pregled izmenjenog predloga pre slanja: cena po stavci za opciju iz zahteva, zbir. Ništa ne upisuje. */
export async function previewOrderRevision(viewer: PortalUser, orderId: string, items: { articleId: string; quantity: number }[]) {
  const o = await revisableOrder(viewer, orderId);
  const today = belgradeDate(new Date());
  const priced = await priceLines(getDb(), o.customer_id, items.filter((i) => i.quantity > 0), o.payment_option, today);
  const lines = priced.lines.map((l) => ({
    code: l.articleCode,
    problem: l.problem ?? l.quantityProblem,
    status: l.selected?.status ?? null,
    netPrice: l.selected?.status === "cena" ? l.selected.netPrice : null,
    discountPercent: l.selected?.status === "cena" ? l.selected.discountPercent : null,
    gross: l.amounts?.gross ?? null,
    note: l.selected?.status === "na_upit" ? ON_REQUEST_NOTE[l.selected.reason] ?? "cenu potvrđuje kancelarija" : null,
  }));
  const gross = lines.reduce((sum, l) => sum + (l.gross ?? 0), 0);
  return { lines, gross: Math.round(gross * 100) / 100, onRequest: lines.filter((l) => l.status === "na_upit").length };
}

/** Kupac potvrđuje (postaje poslat zahtev; original „vraćen na ispravku“) ili odbija izmenjen predlog. */
export async function answerOrderRevision(session: CustomerSession, orderId: string, accept: boolean) {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (accept && session.assurance === "remembered") return { ok: false as const, message: "Radi sigurnosti, pre potvrde ponovo unesite lozinku." };
  const db = getDb();
  return db.transaction(async (tx) => {
    const [r] = [...(await tx.execute<{ id: string; status: string; replaces_order_id: string | null }>(sql`
      SELECT id, status::text AS status, replaces_order_id FROM customer_orders WHERE id = ${orderId}::uuid AND customer_id = ${customerId} FOR UPDATE`))];
    if (!r) return { ok: false as const, message: "Predlog ne postoji." };
    if (r.status !== "awaiting_customer") return { ok: false as const, message: "Predlog više ne čeka potvrdu." };
    const to = accept ? "submitted" : "cancelled";
    const problem = transitionProblem({ from: "awaiting_customer", to, actor: "customer", reason: null });
    if (problem) return { ok: false as const, message: problem };
    await tx.execute(sql`UPDATE customer_orders SET status = ${to}::customer_order_status, submitted_by = ${session.accountId}::uuid, updated_at = now() WHERE id = ${r.id}::uuid`);
    await statusEvent(tx, r.id, "awaiting_customer", to, { customer: session }, accept ? "Kupac je potvrdio izmenjen predlog" : "Kupac je odbio izmenjen predlog");
    if (accept && r.replaces_order_id) {
      await tx.execute(sql`UPDATE customer_orders SET status = 'superseded', updated_at = now() WHERE id = ${r.replaces_order_id}::uuid AND status = 'changes_requested'`);
      await statusEvent(tx, r.replaces_order_id, "changes_requested", "superseded", { customer: session }, "Zamenjen potvrđenim izmenjenim predlogom");
    }
    return { ok: true as const, message: accept ? "Potvrdili ste izmenjen zahtev. Kancelarija ga obrađuje." : "Odbili ste izmenjen predlog. Raniji zahtev ostaje sa statusom „Potrebna izmena“." };
  });
}
