import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");

/** Izvor bez komentara — komentar sme da pomene ono sto kod ne sme da radi. */
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

const gate = await read("./portal-commerce.ts");
const rootLayout = await read("../../app/layout.tsx");
const portalLayout = await read("../../app/portal/layout.tsx");
const header = await read("../../components/layout/Header.tsx");
const baslacPdp = await read("../../components/baslac-brand/BaslacSystemPdp.tsx");
const publicCart = await read("../../app/korpa/page.tsx");
const portalCart = await read("../../app/portal/korpa/page.tsx");

test("kapija trazi i feature flag i ovlascenu sesiju", () => {
  assert.match(gate, /isEnabled\(process\.env\.PORTAL_COMMERCE\)/);
  assert.match(gate, /can\(user, PORTAL_COMMERCE_CAPABILITY\)/);
  // Korpa je vezana za PRODAJNI capability. Ako se ovde ikad vrati
  // `orders:create`, nabavni paket ponovo otvara korpu — vidi
  // docs/b2b/02-auth-roles-tenancy.md.
  assert.match(gate, /PORTAL_COMMERCE_CAPABILITY = "customer_orders:create"/);
  assert.doesNotMatch(gate, /PORTAL_COMMERCE_CAPABILITY = "orders:create"/);
  assert.match(gate, /^import "server-only";/m);
  // Ne sme se oslanjati na pathname u klijentskom JS-u (komentar sme, kod ne).
  const code = gate.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /usePathname|location\.pathname/);
});

test("javni layout i header nemaju cart sloj", () => {
  for (const source of [rootLayout, header]) {
    assert.doesNotMatch(source, /CartProvider|CartDrawer|CartButton/);
  }
});

test("cart je montiran u portal layoutu iza kapije", () => {
  assert.match(portalLayout, /getPortalCommerceAccess/);
  assert.match(portalLayout, /if \(!commerce\.allowed\) return shell;/);
  assert.match(portalLayout, /<CartProvider userScope=\{user\.id\}>/);
  assert.match(portalLayout, /<CartDrawer \/>/);
});

test("portal korpa odbija neovlascen direktan pristup", () => {
  assert.match(portalCart, /requireUser\("\/portal\/korpa"\)/);
  assert.match(portalCart, /if \(!commerce\.allowed\) forbidden\(\)/);
});

test("javna /korpa samo preusmerava, nema druge korpe", () => {
  assert.match(publicCart, /redirect\("\/portal\/korpa"\)/);
  assert.doesNotMatch(publicCart, /CartPage|CartProvider/);
});

test("javni Baslac PDP nema cart kontrole nego upit", () => {
  assert.doesNotMatch(baslacPdp, /useCart|Dodaj u korpu|Dodaj izabrano u korpu|pickButton/);
  assert.doesNotMatch(baslacPdp, /quickAdd/);
  assert.match(baslacPdp, /Pošalji upit/);
});

test("zapremina i dalje bira tacnu sliku, bez fallbacka", () => {
  assert.match(baslacPdp, /baslacAssetSlot\(system, base\.volumeL\)\?\.src \?\? null/);
});

/* ==========================================================================
 * SOURCE-CONTRACT: granica portala i skladiste korpe
 *
 * Sve ispod cita izvor. Nista se ne izvrsava i nijedna sesija se ne pravi —
 * bezbednosno ponasanje dokazuje browser QA nad stvarnom bazom, ne ovaj fajl.
 * ========================================================================== */

test("[source-contract] enrollment-only povratak dolazi PRE cart kapije", async () => {
  const layout = await read("../../app/portal/layout.tsx");

  const enrollmentAt = layout.indexOf("session.enrollmentOnly");
  const commerceAt = layout.indexOf("getPortalCommerceAccess()");
  const providerAt = layout.indexOf("<CartProvider");

  assert.ok(enrollmentAt > 0, "enrollment grana ne postoji");
  assert.ok(commerceAt > 0, "cart kapija ne postoji");
  assert.ok(
    enrollmentAt < commerceAt,
    "cart kapija se poziva pre nego sto enrollment-only sesija bude odbijena",
  );
  assert.ok(providerAt > commerceAt, "CartProvider se montira pre kapije");

  // Prijava se trazi pre svega ostalog.
  const loginAt = layout.indexOf("redirect(loginUrlFor())");
  assert.ok(loginAt > 0 && loginAt < enrollmentAt);
});

test("[source-contract] bez dozvole se cart sloj uopste ne montira", async () => {
  const layout = await read("../../app/portal/layout.tsx");
  assert.match(layout, /if \(!commerce\.allowed\) return shell;/);
  // Ljuska bez korpe se vraca PRE providera.
  const guardAt = layout.indexOf("if (!commerce.allowed) return shell;");
  assert.ok(guardAt < layout.indexOf("<CartProvider"));
});

test("[source-contract] CartProvider trazi identitet korisnika", async () => {
  const provider = await read("../../components/cart/CartProvider.tsx");
  const layout = await read("../../app/portal/layout.tsx");

  // Prop je obavezan (bez `?`), pa se provider ne moze montirati bez identiteta.
  assert.match(provider, /userScope: string;/);
  assert.doesNotMatch(provider, /userScope\?: string/);

  // Kljuc se izvodi iz njega, ne iz konstante.
  assert.match(provider, /cartStorageKey\(userScope\)/);
  assert.doesNotMatch(
    provider,
    /localStorage\.(get|set)Item\(\s*CART_STORAGE_KEY/,
    "provider i dalje koristi globalni nescope-ovani kljuc",
  );

  // Layout prosledjuje identitet prijavljenog korisnika.
  assert.match(layout, /<CartProvider userScope=\{user\.id\}>/);
});

test("[source-contract] javne strane nemaju cart sloj", async () => {
  for (const rel of [
    "../../components/baslac-brand/BaslacSystemPdp.tsx",
    "../../components/home/HomeCampaignCarousel.tsx",
    "../../components/home/CarsystemHomePage.tsx",
  ]) {
    const source = await read(rel);
    assert.doesNotMatch(source, /useCart|CartProvider|CartDrawer|CartButton/, rel);
    assert.doesNotMatch(source, /Dodaj u korpu/i, rel);
  }
});

test("[source-contract] nigde se ne tvrdi da je porudzbina poslata", async () => {
  for (const rel of [
    "../../components/cart/CartPage.tsx",
    "../../components/cart/CartDrawer.tsx",
    "../../app/portal/korpa/page.tsx",
  ]) {
    /*
     * Tvrdnje idu nad KODOM. Komentar sme — i treba — da kaze „lista nije
     * porudzbina" i „cena se ne prikazuje"; to objasnjava bas ono sto se ovde
     * brani i ne sme da obori test.
     */
    const source = codeOf(await read(rel));
    assert.doesNotMatch(
      source,
      /porud[žz]bina (je )?(poslata|primljena|kreirana)|narud[žz]bina je|checkout|plati|placanje|plaćanje/i,
      `${rel}: tvrdi zavrsenu porudzbinu ili nudi placanje`,
    );
    // Ni cena ni ukupan iznos.
    assert.doesNotMatch(source, /\bcena\b|\bprice\b|ukupno za napla|\btotal\b|\bRSD\b|\bEUR\b/i, rel);
  }
});
