import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  belgradeDateKey,
  isDateKey,
  orthodoxEasterDate,
  parseSeasonalMode,
  resolveSeasonalCampaign,
  seasonalWindowsAround,
  usableSeasonalImage,
} from "./seasonalCalendar.mjs";
import { existsSync } from "node:fs";
import { seasonalCampaigns, seasonalImageLibrary } from "./seasonalCampaigns.config.mjs";

const campaigns = seasonalCampaigns;
const activeId = (dateKey, mode) =>
  resolveSeasonalCampaign({ campaigns, dateKey, mode })?.campaign.id ?? null;

test("pravoslavni Vaskrs odgovara objavljenim datumima", () => {
  const known = {
    2024: "2024-05-05",
    2025: "2025-04-20",
    2026: "2026-04-12",
    2027: "2027-05-02",
    2028: "2028-04-16",
    2029: "2029-04-08",
    2030: "2030-04-28",
    2031: "2031-04-13",
    2032: "2032-05-02",
    2033: "2033-04-24",
  };
  for (const [year, date] of Object.entries(known)) {
    assert.equal(orthodoxEasterDate(Number(year)), date, `Vaskrs ${year}`);
  }
});

test("Vaskrs je uvek nedelja i van opsega funkcija odbija da računa", () => {
  for (let year = 1990; year <= 2099; year += 1) {
    const [y, m, d] = orthodoxEasterDate(year).split("-").map(Number);
    assert.equal(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), 0, `${year}`);
  }
  assert.throws(() => orthodoxEasterDate(2100), RangeError);
  assert.throws(() => orthodoxEasterDate(1899), RangeError);
});

test("datum se računa u zoni Europe/Belgrade, ne u UTC-u", () => {
  // 31.12. 23:30 UTC je već 1.1. u Beogradu (UTC+1).
  assert.equal(belgradeDateKey(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  // 14.12. 23:30 UTC = 15.12. 00:30 u Beogradu → Nova godina počinje.
  assert.equal(activeId(belgradeDateKey(new Date("2026-12-14T23:30:00Z"))), "nova-godina");
  assert.equal(activeId(belgradeDateKey(new Date("2026-12-14T22:30:00Z"))), null);
  // Letnje vreme (UTC+2): 7.1. nije relevantan, ali granica Vaskrsa jeste.
  assert.equal(belgradeDateKey(new Date("2027-04-22T22:30:00Z")), "2027-04-23");
});

test("Nova godina: 15. decembar – 7. januar, oba dana uključena", () => {
  assert.equal(activeId("2026-12-14"), null);
  assert.equal(activeId("2026-12-15"), "nova-godina");
  assert.equal(activeId("2026-12-31"), "nova-godina");
  assert.equal(activeId("2027-01-01"), "nova-godina");
  assert.equal(activeId("2027-01-07"), "nova-godina");
  assert.equal(activeId("2027-01-08"), null);
  assert.deepEqual(
    resolveSeasonalCampaign({ campaigns, dateKey: "2027-01-03" }).window,
    { start: "2026-12-15", end: "2027-01-07" },
  );
});

test("Vaskrs: 10 dana pre do Vaskršnjeg ponedeljka, po godinama", () => {
  // 2027: Vaskrs 2. maja → 22. april – 3. maj.
  assert.equal(activeId("2027-04-21"), null);
  assert.equal(activeId("2027-04-22"), "vaskrs");
  assert.equal(activeId("2027-05-02"), "vaskrs");
  assert.equal(activeId("2027-05-03"), "vaskrs");
  assert.equal(activeId("2027-05-04"), null);
  // 2026: Vaskrs 12. aprila; katolički Vaskrs 2026. je 5. aprila i nije sidro.
  assert.equal(activeId("2026-04-01"), null);
  assert.equal(activeId("2026-04-02"), "vaskrs");
  assert.equal(activeId("2026-04-13"), "vaskrs");
  assert.equal(activeId("2026-04-14"), null);
});

test("današnji datum zadatka i običan dan daju standardnu stranicu", () => {
  assert.equal(activeId("2026-09-25"), null);
  assert.equal(activeId("2026-07-01"), null);
});

test("ručni prekidač: off gasi, id forsira, nepoznato ne uključuje ništa", () => {
  assert.equal(parseSeasonalMode(undefined, campaigns), "auto");
  assert.equal(parseSeasonalMode("", campaigns), "auto");
  assert.equal(parseSeasonalMode(" OFF ", campaigns), "off");
  assert.equal(parseSeasonalMode("false", campaigns), "off");
  assert.equal(parseSeasonalMode("vaskrs", campaigns), "vaskrs");
  assert.equal(parseSeasonalMode("bozic", campaigns), "auto");

  assert.equal(activeId("2026-12-20", "off"), null);
  assert.equal(activeId("2026-09-25", "vaskrs"), "vaskrs");
  const forced = resolveSeasonalCampaign({ campaigns, dateKey: "2026-09-25", mode: "nova-godina" });
  assert.equal(forced.forced, true);
  assert.equal(forced.window, null);
});

test("isključena kampanja se ne aktivira automatski", () => {
  const disabled = campaigns.map((campaign) =>
    campaign.id === "nova-godina" ? { ...campaign, enabled: false } : campaign,
  );
  assert.equal(
    resolveSeasonalCampaign({ campaigns: disabled, dateKey: "2026-12-20" }),
    null,
  );
});

test("rok slike sa portala ima prednost: posle roka slika se ne koristi", () => {
  const image = {
    desktopSrc: "/x.webp",
    width: 1,
    height: 1,
    alt: "x",
    validUntil: "2026-12-31",
    reuse: { status: "generic-confirmed", evidence: "test" },
    source: { portal: "p", assetName: "a", path: "p", originalFile: "f", usageNotes: "" },
  };
  assert.equal(usableSeasonalImage(image, "2026-12-31"), image);
  assert.equal(usableSeasonalImage(image, "2027-01-01"), null);
  assert.equal(usableSeasonalImage({ ...image, validFrom: "2026-12-20" }, "2026-12-19"), null);
  assert.equal(usableSeasonalImage(null, "2026-12-20"), null);

  const withImage = campaigns.map((campaign) =>
    campaign.id === "nova-godina" ? { ...campaign, image } : campaign,
  );
  const lateDecember = resolveSeasonalCampaign({ campaigns: withImage, dateKey: "2027-01-05" });
  assert.equal(lateDecember.campaign.id, "nova-godina");
  assert.equal(lateDecember.image, null, "kampanja ostaje, ali bez isteklog vizuala");
});

test("konfiguracija je ispravna i bezbedna po difoltu", () => {
  const ids = campaigns.map((campaign) => campaign.id);
  assert.deepEqual(ids, ["nova-godina", "vaskrs"]);
  assert.equal(new Set(ids).size, ids.length);

  for (const campaign of campaigns) {
    assert.match(campaign.id, /^[a-z0-9-]+$/);
    assert.ok(seasonalWindowsAround(campaign.window, 2026).length > 0);
    assert.ok(campaign.copy.title && campaign.copy.description && campaign.copy.eyebrow);
    assert.ok(campaign.copy.cta.href.startsWith("/"), "CTA vodi na postojeću internu rutu");
    // Aktivan vizual mora da nosi poreklo i izričitu odluku o ponovnoj upotrebi.
    if (campaign.image) {
      assert.ok(campaign.image.reuse?.evidence, `${campaign.id}: vizual bez dokaza o upotrebi`);
    }
  }

  // Prozori se ne preklapaju ni u jednoj godini koju sajt realno doživi.
  for (let year = 2026; year <= 2040; year += 1) {
    for (const [a, b] of [["nova-godina", "vaskrs"]]) {
      const [wa] = seasonalWindowsAround(campaigns.find((c) => c.id === a).window, year).slice(-1);
      const [wb] = seasonalWindowsAround(campaigns.find((c) => c.id === b).window, year);
      assert.ok(wa.end < wb.start || wb.end < wa.start, `preklapanje ${year}`);
    }
  }
});

test("pomoćne funkcije datuma odbijaju nepostojeće datume", () => {
  assert.equal(isDateKey("2026-02-29"), false);
  assert.equal(isDateKey("2028-02-29"), true);
  assert.equal(isDateKey("2026-13-01"), false);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.throws(() => resolveSeasonalCampaign({ campaigns, dateKey: "20.12.2026." }));
});

test("sezonski vizual bez izričite odluke o ponovnoj upotrebi se nikad ne prikazuje", () => {
  const base = { desktopSrc: "/x.webp", width: 1, height: 1, alt: "x", source: {} };
  assert.equal(usableSeasonalImage(base, "2026-12-20"), null, "bez `reuse`");
  assert.equal(
    usableSeasonalImage({ ...base, reuse: { status: "generic-confirmed", evidence: " " } }, "2026-12-20"),
    null,
    "generički bez dokaza",
  );
  assert.equal(
    usableSeasonalImage({ ...base, reuse: { status: "nepoznato", evidence: "x" } }, "2026-12-20"),
    null,
  );
  const once = {
    ...base,
    reuse: { status: "campaign-only", campaignWindow: { start: "2024-12-01", end: "2025-01-31" }, evidence: "x" },
  };
  assert.equal(usableSeasonalImage(once, "2024-12-20"), once, "u svojoj kampanji");
  assert.equal(usableSeasonalImage(once, "2025-12-20"), null, "sledeće sezone ne");
  assert.equal(
    usableSeasonalImage({ ...once, reuse: { ...once.reuse, campaignWindow: undefined } }, "2024-12-20"),
    null,
    "campaign-only bez perioda kampanje",
  );
});

test("preuzeti vizuali 2024/25 i 2025 ne postaju aktivni u narednim sezonama", () => {
  // Trenutna konfiguracija: nijedna kampanja nema aktivan vizual (CSS dekoracija).
  for (const campaign of campaigns) assert.equal(campaign.image, null, campaign.id);

  // Čak i ako se vizual iz biblioteke greškom poveže sa kampanjom, ne prikazuje se
  // ni u jednoj kasnijoj sezoni — samo u periodu sopstvene kampanje.
  const attached = campaigns.map((campaign) => ({
    ...campaign,
    image:
      campaign.id === "nova-godina"
        ? seasonalImageLibrary["baslac-new-year-2024-25"]
        : seasonalImageLibrary["baslac-easter-2025"],
  }));
  for (const dateKey of ["2026-12-20", "2027-01-05", "2027-04-30", "2027-12-24", "2028-04-10", "2030-12-31"]) {
    const active = resolveSeasonalCampaign({ campaigns: attached, dateKey });
    assert.ok(active, `kampanja postoji ${dateKey}`);
    assert.equal(active.image, null, `zastareo vizual aktivan ${dateKey}`);
  }
  // Ručno forsiranje kampanje (preview) takođe ne zaobilazi pravilo.
  assert.equal(
    resolveSeasonalCampaign({ campaigns: attached, dateKey: "2026-09-28", mode: "vaskrs" }).image,
    null,
  );
  // U periodu originalne kampanje pravilo ih propušta — pravilo je tačno, ne slepo.
  assert.equal(
    resolveSeasonalCampaign({ campaigns: attached, dateKey: "2024-12-20" }).image,
    seasonalImageLibrary["baslac-new-year-2024-25"],
  );
});

test("biblioteka sezonskih vizuala: poreklo, odluka o upotrebi i fajl na disku", () => {
  const entries = Object.entries(seasonalImageLibrary);
  assert.ok(entries.length >= 2);
  for (const [id, image] of entries) {
    const { source, reuse } = image;
    assert.ok(source.portal && source.assetId && source.assetName && source.path && source.originalFile, id);
    assert.ok(image.alt.length > 10, id);
    assert.ok(reuse.evidence.trim(), `${id}: dokaz`);
    assert.notEqual(reuse.status, "generic-confirmed", `${id}: nema dokaza da je generički`);
    assert.equal(reuse.status, "campaign-only", id);
    assert.ok(isDateKey(reuse.campaignWindow.start) && isDateKey(reuse.campaignWindow.end), id);
    assert.ok(
      existsSync(new URL(`../../public${image.desktopSrc}`, import.meta.url)),
      `${id}: ${image.desktopSrc} ne postoji`,
    );
  }
});
