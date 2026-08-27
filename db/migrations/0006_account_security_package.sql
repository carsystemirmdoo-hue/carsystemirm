/*
 * Paket „Bezbednost naloga".
 *
 * Zašto zaseban paket
 * -------------------
 * Do sada je paket „Korisnici i dozvole" nosio i otvaranje naloga i preuzimanje
 * tuđeg pristupa — reset lozinke, poništavanje drugog faktora, isključivanje
 * naloga. To znači da je svako kome se poveri svakodnevno vođenje naloga
 * dobijao i mogućnost da preuzme vlasnikov.
 *
 * `user_permissions.permission_key` ima strani ključ ka ovoj tabeli, pa se nov
 * paket ne može dodeliti dok red ovde ne postoji.
 *
 * Migracija je aditivna: ne dira postojeće dodele. Niko ne dobija nove moći
 * automatski — vlasnik paket dodeljuje izričito.
 */
INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES (
  'bezbednost_naloga',
  'Bezbednost naloga',
  'Reset lozinke i drugog faktora, dozvole za vezivanje, isključivanje naloga',
  '6'
)
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
