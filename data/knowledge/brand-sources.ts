import type { BrandSourceProfile } from "@/lib/knowledge/manufacturer-catalog";

/**
 * Verified official sources per brand.
 *
 * Every entry was checked by actually fetching the URL during acquisition, and
 * `acquisitionFeasibility` records what the fetch proved — not what the site
 * appears to promise. A brand with a brochure-only site yields almost nothing
 * mechanically, and saying so here prevents repeated fruitless attempts.
 *
 * `verifiedAt` matters because a web source can change without notice, unlike a
 * PDF already in the repository.
 */
export const brandSources: Record<string, BrandSourceProfile> = {
  rm: {
    officialWebsite: "https://www.rmpaint.com/",
    technicalPortal: "https://techinfo.rmpaint.com/",
    tdsUrlPattern: "https://techinfo.rmpaint.com/unicorn/en/{CODE}-{NAME}.pdf",
    acquisitionFeasibility: "structured-portal",
    notes: [
      "117 TDS/product-information PDF-ova već postoji lokalno i obrađeno je u Fazi 3.",
      "Product-information PDF-ovi u projektu sadrže direktne linkove ka techinfo.rmpaint.com.",
      "Tekst je čitljiv; obrada je opisana u RM_EXTRACTION_METHOD.md.",
    ],
    verifiedAt: "2026-08-08",
  },

  baslac: {
    officialWebsite: "https://www.baslac.com/",
    technicalPortal: "https://www.baslac.com/en-emea/technical-data-sheets",
    tdsUrlPattern: "https://techinfo.baslac.com/en/{CODE}.pdf",
    acquisitionFeasibility: "structured-portal",
    notes: [
      "Zvanični indeks ima 9 stranica i 101 dokument (TDS + information charts).",
      "PDF-ovi su čitljivi programski. WebFetch sumarizator ih pogrešno prijavljuje kao slike — provereno direktno kroz pypdf.",
      "Za razliku od R-M, HVLP i Compliant gravity kolone su odvojeno označene, pa podatak o dizni nije dvosmislen.",
      "baslac je brend iz refinish portfolija kompanije Surventis (ranije BASF Coatings, samostalna od 1. jula 2026), kao i R-M i Norbin. Zvanični logo na baslac.com nosi lockup „by Surventis“.",
    ],
    verifiedAt: "2026-09-18",
  },

  norbin: {
    officialWebsite: "https://www.norbin-paint.com/",
    technicalPortal: "https://refinish.basf.us/brands/norbin/",
    acquisitionFeasibility: "catalogue-pdf-only",
    notes: [
      "Brend iz refinish portfolija kompanije Surventis (ranije BASF Coatings). Zvanični norbin-paint.com, logo i ambalaža i dalje nose oznake „BASF Coatings GmbH“ i „A brand of BASF“ (provereno 2026-09-18), pa se Norbin logo i citati ne menjaju dok proizvođač ne objavi novi identitet.",
      "Nema javni TDS portal ekvivalentan baslac/R-M portalu. technicalPortal je BASF Refinish portal za Ameriku: radi (2026-09-18), ali je i dalje pod BASF brendingom i ne pominje Surventis.",
      "Product-portfolio PDF (2021) sa hosta cxportal.basf.com uklonjen je iz aktivnih izvora 2026-09-18: host se ne razrešava u DNS-u još od 2026-08-09, a zamenski zvanični URL nije pronađen. Istorijska referenca ostaje u docs/NORBIN_BRAND_RESEARCH.md (S18).",
      "Lokalno imamo 2 proizvoda (N15-020), oba bez dokumentacije.",
    ],
    verifiedAt: "2026-09-18",
  },

  "cosmos-lac": {
    officialWebsite: "https://www.cosmoslac.com/",
    technicalPortal: "https://www.cosmoslac.com/products/",
    cataloguePdf:
      "https://www.cosmoslac.com/pdfs/catalogs/ENG_Catalogue2022_FINAL_DIGITAL%20USE.pdf",
    acquisitionFeasibility: "catalogue-pdf-only",
    notes: [
      "Najveći brend u našem katalogu (742 varijante) i bez ijednog tehničkog dokumenta lokalno.",
      "Zvanični sajt ima /products/ sekciju i katalog PDF, ali nema strukturiran TDS repozitorijum.",
      "TDS/MSDS dokumenti postoje kod distributera; prioritet je zvanični izvor ili direktan kontakt sa proizvođačem (factory@cosmoslac.com).",
    ],
    verifiedAt: "2026-08-08",
  },

  carsystem: {
    officialWebsite: "https://www.carsystem.org/en",
    technicalPortal: "https://www.carsystem.org/en/products",
    cataloguePdf:
      "https://www.carsystem.org/fileadmin/CS-Kataloge-2025/Carsystem-product-catalogue-2025.pdf",
    acquisitionFeasibility: "product-pages",
    notes: [
      "Proizvođač navodi preko 2.000 proizvoda; lokalno imamo 9.",
      "10 kategorija proizvoda sa zasebnim stranicama.",
      "Zvanični katalog 2025 je dostupan kao PDF.",
      "Isti vlasnik kao C.A.R.FIT (August Handel GmbH).",
    ],
    verifiedAt: "2026-08-08",
  },

  carfit: {
    officialWebsite: "https://carfitrepair.com/",
    cataloguePdf:
      "https://carfitrepair.com/wp-content/uploads/2025/09/CARFIT-FINAL-2026.pdf",
    acquisitionFeasibility: "catalogue-pdf-only",
    notes: [
      "Puno ime brenda je C.A.R.FIT, proizvođač August Handel GmbH.",
      "Zvanični katalog 2026 je dostupan kao PDF.",
      "Kategorije: masking, abrasives, cleaning & accessories; serije Black Label i Red Label.",
      "Lokalno imamo 2 proizvoda (maskirna folija).",
    ],
    verifiedAt: "2026-08-08",
  },

  sata: {
    officialWebsite: "https://www.sata.com/en/",
    technicalPortal: "https://www.sata.com/en-us/all-products/",
    acquisitionFeasibility: "product-pages",
    notes: [
      "Oprema, ne premazi — tehnički model se razlikuje (dizne, protok, pritisak).",
      "Zvanične stranice po proizvodu postoje.",
      "Lokalno imamo 1 proizvod (SATAjet X 5500).",
    ],
    verifiedAt: "2026-08-08",
  },

  befar: {
    officialWebsite: "https://www.befar.com.tr/",
    cataloguePdf:
      "https://www.befar.com.tr/_files/ugd/446a5e_9192e551cfa540ae95f10c5247f2587b.pdf",
    acquisitionFeasibility: "catalogue-pdf-only",
    notes: [
      "Proizvođač je Befar Otomotiv San. Tic. Ltd. Şti., Bursa, Turska; porodična firma koja proizvodi od 2002.",
      "Prethodni zapis „no-official-source-found“ (2026-08-08) bio je netačan i ispravljen je 2026-08-09; vidi docs/BEFAR_BRAND_RESEARCH.md.",
      "Identitet je potvrđen na tri načina: logo arhiviran sa starog carsystemirm.com sajta poklapa se sa befar.com.tr markom; imena fajlova naših starih slika su Befar šifre (240100 → 02401, 930150 → 93015); Srbija je na Befarovoj štampanoj listi izvoznih tržišta.",
      "Zvanični sajt je Wix brošura na turskom (19 stranica, bez TDS-a). Zvanični katalog je dvojezični PDF od 48 strana, ko-brendiran sa izvoznom firmom Nargil Dış Ticaret.",
      "Drugi zvanični izvor je izvozni sajt https://www.nargildisticaret.com/ (engleski); TLS sertifikat mu ne validira, a slike su adresirane po Befar šifri (images/urunler/<kod>/).",
      "Katalog sadrži zvaničnu hardness legendu (boja pene = tvrdoća, ★ do ★★★★★) i pravilo uparivanja prečnika pena/tanjira — vidi docs/BEFAR_PRODUCT_ARCHITECTURE.md.",
      "TDS, SDS i sertifikati nisu objavljeni ni na jednom zvaničnom izvoru; za njih je potreban direktan kontakt.",
      "Pod-brendovi: befar, befar +Plus, Opencell, Leo, turQuaz (zvanični lockup sheet je strana 47 kataloga).",
      "Ne mešati sa Befar Group Co., Ltd. / 滨化集团 (befar.com) — kineska petrohemijska kompanija bez ikakve veze; verovatan uzrok prvobitne pogrešne pretrage.",
    ],
    verifiedAt: "2026-08-09",
  },

  rupes: {
    officialWebsite: "https://www.rupes.com/",
    acquisitionFeasibility: "product-pages",
    notes: [
      "Aktivan brend od 2026-09-21. Opseg je RUPES_PRODUCTS_FROM_CARSYSTEM_PROGRAM: samo RUPES proizvodi koje vodi Carsystem katalog 2026/27 i carsystem.org — nije RUPES katalog (rupes.com ima 576 stranica proizvoda).",
      "Zapisi potiču iz Carsystem synca; identitet proizvođača (oznaka modela, nivo dokaza, status kod proizvođača) je u data/carsystem-sync/third-party-manufacturers.json.",
      "rupes.com služi samo za potvrdu identiteta i oznaka modela. Slike i logotip se odatle ne preuzimaju: sajt navodi da su vlasništvo RUPES S.p.A. (oznaka RUPES_IMAGE_RIGHTS_REVIEW).",
      "Bez tvrdnji o statusu distribucije; bezbedna formulacija je „RUPES proizvodi iz Carsystem programa”.",
    ],
    verifiedAt: "2026-09-21",
  },
};
