/*
 * 0046 — Obaveštenja kancelariji o zahtevima kupaca (revizija 2026-10-11, B3).
 *
 * Kancelarija je za nov zahtev saznavala samo dok joj je lista zahteva otvorena.
 * Sada nov zahtev, potvrđen izmenjen predlog i nov upit za cenu prave
 * obaveštenje za `customer_orders:review` (kancelarija, vlasnik). Komercijaliste
 * namerno ne: obaveštenje se vidi po sposobnosti, ne po kupcu.
 */
ALTER TYPE "notification_kind" ADD VALUE IF NOT EXISTS 'customer_order_submitted';
--> statement-breakpoint
ALTER TYPE "notification_kind" ADD VALUE IF NOT EXISTS 'customer_price_request_submitted';
