/**
 * Podupiti moraju da pominju spoljnu tabelu PUNIM imenom kolone.
 *
 * Drizzle u upitu nad jednom tabelom piše `${tabela.kolona}` bez imena
 * tabele („"id"“). Unutar podupita nad drugom tabelom koja ima istoimenu
 * kolonu to postaje kolona PODUPITA, pa uslov tiho postaje uvek tačan ili
 * uvek netačan (storno se nije video na Izvornim dokumentima, storniran račun
 * se brojao kupcu, nepovezan dokument je dobijao tuđeg kupca).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import { count } from "drizzle-orm";
import postgres from "postgres";
import { invoices } from "@/db/schema/sales";
import { effectiveInvoiceCondition, notReversedCondition } from "@/lib/ledger/effective-invoice";

// Klijent se nikad ne povezuje: koristi se samo za `toSQL()`.
const db = drizzle(postgres("postgres://nije-povezano@127.0.0.1:1/x"));

test("notReversedCondition u upitu nad samom tabelom invoices poredi sa invoices.id", () => {
  const { sql } = db.select({ n: count() }).from(invoices).where(notReversedCondition()).toSQL();
  assert.match(sql, /r\.original_invoice_id = invoices\.id/);
  assert.doesNotMatch(sql, /r\.original_invoice_id = "id"/);
});

test("effectiveInvoiceCondition poredi izvorni dokument sa invoices.id", () => {
  const { sql } = db.select({ n: count() }).from(invoices).where(effectiveInvoiceCondition()).toSQL();
  assert.match(sql, /sd\.invoice_id = invoices\.id/);
});

test("alias i dalje radi", () => {
  const { sql } = db.select({ n: count() }).from(invoices).where(notReversedCondition("i")).toSQL();
  assert.match(sql, /r\.original_invoice_id = i\.id/);
});
