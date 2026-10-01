/**
 * JEDINO mesto gde se definišu sezonske kampanje sajta.
 *
 * Sledeće godine se po pravilu ništa ne menja: Nova godina ima fiksne datume,
 * a Vaskrs se računa (pravoslavni, `orthodoxEasterDate`). Menja se samo:
 * - `image` — kada stigne odobren sezonski vizual (vidi `seasonalImageLibrary`), ili
 * - `enabled` — da se jedna kampanja trajno isključi.
 *
 * Ručni prekidač za ceo sajt je env `NEXT_PUBLIC_SEASONAL_CAMPAIGNS`
 * (`auto` | `off` | id kampanje) — vidi `docs/SEASONAL_CAMPAIGNS.md`.
 *
 * Tekst je namerno neutralan prema brendu i bez poslovnih tvrdnji (radno
 * vreme, popusti, dostupnost), jer se ništa od toga ne sme podrazumevati.
 */

/**
 * Preuzeti sezonski vizuali (Surventis Brand Portal, poreklo u
 * `docs/BASLAC_PORTAL_ASSETS.md`). Biblioteka ih samo čuva — kampanja ih
 * koristi tek kada se u njenom zapisu postavi `image: seasonalImageLibrary[…]`.
 *
 * Oba vizuala su `campaign-only`: portal ih vezuje za jednu kampanju (tagovi
 * „xmas2024“ i „happy easter 2025“) i nigde ne navodi da su generički. Zato
 * `usableSeasonalImage` ne dozvoljava da se prikažu van originalnog perioda
 * kampanje, čak i ako se greškom povežu sa kampanjom za 2026/27.
 *
 * Aktivacija kasnije, na jedan od dva načina:
 * 1. dobavljač potvrdi da je vizual generički → `reuse.status:
 *    "generic-confirmed"` + doslovan dokaz u `reuse.evidence`, pa u kampanji
 *    `image: seasonalImageLibrary["…"]` (po želji uz `validFrom`/`validUntil`);
 * 2. stigne novi vizual za tekuću sezonu → novi zapis sa `campaignWindow`
 *    te sezone.
 *
 * @type {Readonly<Record<string, import("./seasonalCalendar.mjs").SeasonalImage>>}
 */
export const seasonalImageLibrary = Object.freeze({
  "baslac-new-year-2024-25": {
    desktopSrc: "/images/brands/baslac/campaign/baslac-seasonal-new-year.webp",
    width: 1019,
    height: 1019,
    alt: "Ilustracija vatrometa u baslac plavoj koji izlazi iz baslac limenke, na tamnoj pozadini",
    reuse: {
      status: "campaign-only",
      campaignWindow: { start: "2024-12-01", end: "2025-01-31" },
      evidence:
        "Portal: tag „xmas2024“; prateći PDF (asset 45524) naslovljen „baslac / 2024-12 Holidays / 2025-01 New Year“. Nema oznake generičke ili evergreen upotrebe.",
    },
    source: {
      portal: "Surventis Brand Portal (brand.surventiscoatings.com), baslac hub",
      assetId: 45532,
      assetName: "baslac_SoMe_2025-01_New_Year_1080x1080px_No_Copy",
      path: "Media Library › kolekcija „SoMe - International Days“",
      originalFile: "baslac_SoMe_2025-01_New_Year_1080x1080px_No_Copy.jpeg",
      campaign: "baslac / 2024-12 Holidays / 2025-01 New Year (tag „xmas2024“)",
      usageNotes:
        "Portal ne navodi rok ni ograničenje; prateći tekst sadrži samo predložene social tekstove. Odsečena je donja plava traka social šablona.",
    },
  },
  "baslac-easter-2025": {
    desktopSrc: "/images/brands/baslac/campaign/baslac-seasonal-easter.webp",
    width: 1014,
    height: 1014,
    alt: "Baslac limenka sa zečjim ušima, uskršnjim jajima i prolećnim cvećem u baslac plavoj",
    reuse: {
      status: "campaign-only",
      // Uskrs 2025. (i pravoslavni i katolički) je bio 20. 4. 2025.
      campaignWindow: { start: "2025-04-01", end: "2025-04-30" },
      evidence:
        "Portal: tag „happy easter 2025“, asset dodat 2025-04-04. Nema oznake generičke ili evergreen upotrebe.",
    },
    source: {
      portal: "Surventis Brand Portal (brand.surventiscoatings.com), baslac hub",
      assetId: 50625,
      assetName: "BASLAC VIDE",
      path: "Media Library (pretraga „BASLAC VIDE“)",
      originalFile: "BASLAC VIDE.jpeg",
      campaign: "Uskrs 2025 (tag „happy easter 2025“), serija bez teksta",
      usageNotes:
        "Portal ne navodi rok ni ograničenje. Odsečena je donja plava traka social šablona.",
    },
  },
});

/** @type {readonly import("./seasonalCalendar.mjs").SeasonalCampaign[]} */
export const seasonalCampaigns = Object.freeze([
  {
    id: "nova-godina",
    label: "Nova godina i Božić",
    enabled: true,
    theme: "winter",
    // 15. decembar – 7. januar (pravoslavni Božić), oba dana uključena.
    window: { type: "fixed", start: "12-15", end: "01-07" },
    /*
     * Bez aktivnog vizuala: CSS dekoracija je produkcijsko rešenje. Preuzeti
     * vizual kampanje 2024/25 je u `seasonalImageLibrary` i NE aktivira se za
     * kasnije sezone dok dobavljač ne potvrdi da je generički.
     */
    image: null,
    copy: {
      eyebrow: "Praznični pozdrav",
      title: "Srećna Nova godina i Božić.",
      description:
        "Hvala radionicama i partnerima na saradnji u godini za nama. Želimo vam mirne praznike i uspešnu novu sezonu.",
      cta: { href: "/prodavnice", label: "Pronađite najbližu prodavnicu" },
      controlLabel: "Praznici",
    },
  },
  {
    id: "vaskrs",
    label: "Vaskrs",
    enabled: true,
    theme: "spring",
    // Pravoslavni Vaskrs: 10 dana pre (oko Cveti) do Vaskršnjeg ponedeljka.
    window: { type: "orthodox-easter", startOffsetDays: -10, endOffsetDays: 1 },
    // Bez aktivnog vizuala — vidi `seasonalImageLibrary` iznad.
    image: null,
    copy: {
      eyebrow: "Vaskršnji praznici",
      title: "Srećan Vaskrs.",
      description:
        "Želimo vam mirne praznike u krugu porodice i uspešan nastavak sezone u radionici.",
      cta: { href: "/prodavnice", label: "Pronađite najbližu prodavnicu" },
      controlLabel: "Vaskrs",
    },
  },
]);
