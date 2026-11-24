/*
 * 0067 — obaveštenje o storniranoj fakturi (zahtev vlasnika 2026-11-24).
 *
 * Kada konektor pošalje storno i portal ga poveže sa originalom (primenjeno ili za proveru),
 * vlasnik, kancelarija i komercijalista tog kupca dobijaju obaveštenje. Samo nova vrednost enuma;
 * kod pre ove migracije proverava da li vrednost postoji i bez nje ne šalje ništa.
 */
ALTER TYPE "notification_kind" ADD VALUE IF NOT EXISTS 'invoice_storno';
