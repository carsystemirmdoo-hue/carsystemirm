#!/usr/bin/env python3
"""Generiše JAVNI_SAJT_NEDOSTACI.csv i JAVNI_SAJT_INVENTAR_PROIZVODA.csv iz podataka provere 2026-10-11."""
import csv, json, os, re, sys, collections

A = os.path.dirname(os.path.abspath(__file__))
REPO = "/Users/miledulic/Carsystem/carsystem"
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

J = lambda f: json.load(open(os.path.join(A, f)))
inv = J("inventory.json")
pages = J("pages.json")
dlf = J("dl-findings.json")
links = J("links.json")
P = {p["url"]: p for p in pages}
prod_by_url = {}
for p in inv["products"]:
    prod_by_url.setdefault(p["canonical"], p)
    prod_by_url.setdefault("/proizvodi/" + p["slug"], p)

BRAND = {"rm": "R-M", "carsystem": "Carsystem", "baslac": "baslac", "norbin": "Norbin", "cosmos-lac": "Cosmos Lac",
         "befar": "Befar", "carfit": "C.A.R.FIT", "sata": "SATA", "rupes": "RUPES"}

def brand_of(url):
    pr = prod_by_url.get(url)
    if pr:
        return BRAND.get(pr["brand"], pr["brand"])
    m = re.search(r"/brendovi/([a-z-]+)", url)
    if m:
        return BRAND.get(m.group(1), m.group(1))
    m = re.search(r"grupa/(baslac|cosmos-lac|norbin|rm|carsystem|carfit|befar|sata)", url)
    if m:
        return BRAND[m.group(1)]
    m = re.search(r"/proizvodi/grupa/(\d\d-\d\d)", url)
    if m:
        return "baslac"
    return "—"

def name_of(url):
    pr = prod_by_url.get(url)
    if pr:
        return pr["name"]
    p = P.get(url)
    if p and p.get("h1"):
        return p["h1"][0][:90]
    return url

rows = []
def add(group, status, red, prio, url, vrsta, dokaz, fajl, predlog, izvor, odluka="NE", pitanje="", nacin="automatski", trag="", naziv=None, brend=None):
    rows.append(dict(grupa=group, status=status, radni_red=red, prioritet=prio, url=url,
                     stranica_ili_proizvod=naziv or name_of(url), brend=brend or brand_of(url), vrsta_nedostatka=vrsta,
                     dokaz=dokaz, fajl_u_kodu=fajl, predlog_dopune=predlog, izvor_materijala=izvor,
                     potrebna_odluka=odluka, pitanje_za_vlasnika=pitanje, nacin_provere=nacin, trag=trag))

# ---------------- G01 slike proizvoda: placeholder ----------------
unres = list(csv.DictReader(open(f"{REPO}/docs/catalog/image-gaps-2026-10/UNRESOLVED_IMAGES.csv")))
unres_by_slug = {}
for r in unres:
    slug = r["image_id"].split("__", 1)[-1] if r["image_id"] else ""
    unres_by_slug[slug] = r
ph = [p for p in inv["products"] if "placeholder" in (p["image"] or "") and not (p["brand"] == "baslac" and p["redirect"])]
G01 = {
    "sata": ("G01-SATA", 3, "P1", "SATA zadržava prava na fotografije (CONSENT_REQUIRED); zvanična slika postoji na sata.com.",
             "Zatražiti pisanu dozvolu SATA za packshotove (ili potvrditi postojeći ugovor) pa uvesti zvanične slike sa sata.com (spisak URL-ova: docs/catalog/image-gaps-2026-10/sata-current-official-urls.csv).",
             "sata.com stranica artikla (current_image_url u sata-current-official-urls.csv) — tek uz dozvolu",
             "DA", "Da li imate (ili tražimo) pisanu saglasnost SATA za korišćenje fotografija proizvoda na sajtu? Ko šalje zahtev SATA-i?"),
    "rm": ("G01-RM", 3, "P1", "Packshot ove šifre nije pronađen na Surventis portalu ni na info.rmpaint.com.",
           "Fotografisati ambalažu u magacinu (ujednačena pozadina) ili potvrditi da artikal nije u ponudi.",
           "Fotografija vlasnika (owner supply); Surventis Brand Portal R-M hub 51 je pretražen bez rezultata",
           "DA", "Da li možete da fotografišete ambalažu ovih R-M artikala ili da potvrdite da ih ne držimo?"),
    "norbin": ("G01-NORBIN", 3, "P1", "Proizvođač ne objavljuje sliku ove šifre.",
               "Fotografija ambalaže od vlasnika ili zvanični render uz potvrdu prava.",
               "Fotografija vlasnika; norbin-paint.com nema packshot", "DA",
               "Da li možete da fotografišete ambalažu ovih Norbin artikala?"),
    "baslac": ("G01-BASLAC", 3, "P1", "Packshot ove šifre ne postoji na baslac portalu (441 asset) ni na baslac.com.",
               "Fotografija ambalaže od vlasnika; za 30-S510 prvo potvrditi identitet (Topcoat ili CV Topcoat).",
               "Fotografija vlasnika; Surventis Brand Portal baslac hub 54 pretražen", "DA",
               "Da li možete da fotografišete ambalažu ovih baslac artikala? Za 30-S510: da li je to Line 30 Topcoat ili 30 CV?"),
    "cosmos-lac": ("G01-COSMOS", 3, "P1", "Slika postoji samo na cosmoslac.com; uslovi korišćenja zabranjuju upotrebu bez pisane dozvole (nema je u Brand Kit-u).",
                   "Zatražiti pisanu dozvolu Cosmos Lac-a ili dodatni Brand Kit; do tada ostaje neutralno polje.",
                   "cosmoslac.com (tek uz pisanu dozvolu) / Cosmos Brand Kit", "DA",
                   "Da li tražimo od Cosmos Lac-a pisanu dozvolu ili dopunu Brand Kit-a za 11 artikala bez slike?"),
}
for p in ph:
    code, red, prio, why, predlog, izvor, odl, pit = G01[p["brand"]]
    ur = unres_by_slug.get(p["slug"])
    reason = (ur["reason"][:220] if ur else why)
    if p["brand"] == "sata" and ur and "PLACEHOLDER_ACCEPTED" in (ur.get("state", "") + ur.get("reason", "")):
        reason = "Placeholder prihvaćen (pribor faze 2): " + reason
    url = p["canonical"]
    vis = "„Vizuel u pripremi” na stranici proizvoda (data-product-has-image=false)" if not p["redirect"] else "Varijanta porodice bez slike; posle izbora varijante prikazuje se neutralno polje (zapis: placeholder-product.svg)"
    add(code, "POTVRĐENO", red, prio, url, "Slika: nema fotografije proizvoda",
        f"{vis}. Razlog iz evidencije slika: {reason}",
        "lib/carsystem-data.ts (productImage) · data/catalog/image-supply/", predlog, izvor, odl, pit,
        "automatski (SSR + inventar) + vizuelno uzorak", "UNRESOLVED_IMAGES.csv")
# Norbin samo na Production-u (pending-rights)
for p in inv["products"]:
    if "pending-rights" in (p["image"] or ""):
        add("G01-NORBIN-PROD", "POTVRĐENO", 3, "P1", p["canonical"], "Slika: pravo korišćenja nije potvrđeno",
            "Slika iz review-assets/pending-rights se prikazuje lokalno i na Preview-u, a na Production-u se krije (VERCEL_ENV=production) — tamo stranica prikazuje „Vizuel u pripremi”. Izvor: render proizvođača sa sajta distributera Väritikka.",
            "lib/supplied-image-rights.mjs · scripts/catalog/stage-pending-rights-images.mjs", "Posle potvrde prava prebaciti sliku u public/products/norbin/supplied/; bez potvrde ostaje placeholder.",
            "review-assets/pending-rights/norbin/ (već preuzeto)", "DA",
            "Da li potvrđujete pravo da koristimo Norbin rendere sa sajta distributera Väritikka (6 slika)?", "automatski (kod + inventar)", "OLD-058…063")

# ---------------- G02 baslac sistemske strane ----------------
for fam, n in [("baslac-line-35", 56), ("baslac-line-45", 69), ("baslac-line-30", 21), ("baslac-line-30-cv", 2)]:
    add("G02", "POTVRĐENO", 3, "P3", f"/proizvodi/grupa/{fam}", "Slika: generička ambalaža umesto tačne zapremine",
        f"Sistemska stranica prikazuje „Primer ambalaže linije — ne prikazuje izabranu nijansu ni zapreminu”; {n} adresa ?varijanta= dele istu sliku. Portal nema generičku limenku za pakovanja 1 L / 0,5 L / 0,1 L / 5 L (spisak u UNRESOLVED_IMAGES, grupa PACKAGE_SLOT).",
        "components/product/BaslacSystemPdp* · lib/baslac-systems.ts", "Fotografisati praznu/generičku limenku svake zapremine (1 L, 0,5 L, 0,1 L, 5 L) ili ostaviti postojeći primer sa napomenom.",
        "Fotografija vlasnika (Surventis portal nema generičku limenku)", "DA",
        "Da li možete da fotografišete po jednu limenku baslac baze u zapreminama 1 L, 0,5 L, 0,1 L i 5 L?", "automatski + vizuelno", "OLD-043…049")

# ---------------- G03 brend strane: slike ----------------
add("G03", "POTVRĐENO", 3, "P1", "/brendovi/norbin", "Slika: placeholder na brend stranici",
    "Dva vidljiva polja „Fotografija u pripremi” (hero radionice i sekcija porekla); aria-label „Fotografija radionice još nije dostupna”.",
    "components/norbin-brand/NorbinBrandPage.tsx", "Sakriti prazna polja dok nema fotografije ili postaviti zvaničnu grupnu sliku asortimana uz potvrdu prava.",
    "norbin-paint.com/images/gamme_NORBIN-mai-2024.jpg (traži odluku o pravu)", "DA",
    "Da li sakrivamo prazna foto-polja na Norbin strani ili tražimo pravo na zvaničnu grupnu sliku asortimana?", "automatski + vizuelno", "OLD-053, OLD-054, OLD-104")
add("G03", "POTVRĐENO", 3, "P1", "/brendovi/rm", "Slika: prazne kartice na brend stranici",
    "Kartice „Efektne komponente” i „Kompatibilna završnica” (CRYSTAL BASE) imaju prazan foto-slot: „Fotografija proizvoda za … još nije dostupna”.",
    "components/rm-brand/rmBrandData.ts", "Ukloniti dve kartice dok CRYSTAL BASE nije u programu ili ih vezati za stvarne artikle.",
    "—", "DA", "Da li je R-M CRYSTAL BASE u Vašem programu? Ako nije, uklanjamo te dve kartice.", "automatski + vizuelno", "OLD-055")
add("G03", "POTVRĐENO", 3, "P2", "/brendovi/carsystem", "Slika: brend stranica bez fotografija",
    "Folder public/images/brands/carsystem/ ne postoji; hero i faze procesa prikazuju SVG šemu umesto fotografija. Kandidati na carsystem.org, ali impressum zabranjuje upotrebu bez dozvole.",
    "components/carsystem-brand/* · lib/content-assets/content-asset-slots.mjs", "Tražiti dozvolu Carsystem/VOSSCHEMIE za 3–4 fotografije (hero + faze) ili napraviti sopstvene fotografije u radionici.",
    "carsystem.org (Flow_Banner.jpg i dr. — samo uz dozvolu) / sopstvene fotografije", "DA",
    "Da li tražimo dozvolu od Carsystem/VOSSCHEMIE za fotografije sa carsystem.org ili radimo sopstveno fotografisanje?", "automatski + vizuelno", "OLD-050…052, OLD-093")
add("G03", "POTVRĐENO", 3, "P2", "/brendovi/sata", "Slika: brend stranica bez ijedne slike",
    "SSR HTML strane nema nijedan <img> (ni logo, ni proizvod); vezano za SATA prava na slike.",
    "components/brand/sata/SataBrandPage.tsx", "Posle dozvole SATA dodati logo i 3–4 packshota ključnih pištolja.",
    "sata.com (uz dozvolu)", "DA", "(isto kao G01-SATA) Saglasnost SATA za slike.", "automatski + vizuelno", "OLD-006")
add("G03", "POTVRĐENO", 3, "P2", "/brendovi/rupes", "Slika: brend bez logotipa",
    "RUPES nema logo na /brendovi i na svojoj strani (komentar u lib/carsystem-data.ts: „odobren RUPES logo fajl ne postoji”).",
    "lib/carsystem-data.ts (RUPES bez logo) · components/brand/BrandPage.tsx", "Dodati zvaničan RUPES logo posle potvrde prava.",
    "RUPES press/brand materijal (uz dozvolu)", "DA", "Da li imate odobren RUPES logo i pravo da ga koristimo?", "automatski", "OLD-064")

# ---------------- G04 SATA mrtvi PDF linkovi ----------------
bad = {r["u"]: r for r in links["external"] if not str(r["st"]).startswith("200")}
for p in pages:
    if p.get("status") != 200 or not p.get("hrefs") or "?" in p["url"]:
        continue
    dead = sorted({h for h in p["hrefs"] if h in bad})
    if dead:
        names = ", ".join(re.sub(r"\?ts=\d+", "", d.rsplit("/", 1)[-1]) for d in dead)
        add("G04", "POTVRĐENO", 2, "P1", p["url"], "Dokument: neispravan link (404)",
            f"{len(dead)} PDF link(a) ka sata.com vraća HTTP 404 (provereno 2026-10-11): {names}. SATA menja putanju /media/…/<ts>/ pri objavi.",
            "data/sata-catalog-products.generated.json (izvor: data/sata-sync/raw/articles.generated.json)",
            "Ponovo preuzeti aktuelne URL-ove dokumenata sa stranice artikla na sata.com (sata:sync acquire) ili linkovati stranicu artikla umesto direktnog PDF-a.",
            "sata.com stranica artikla (product_page_url u docs/catalog/image-gaps-2026-10/sata-current-official-urls.csv)", nacin="automatski (HTTP provera svih spoljnih linkova)")

# ---------------- G05/G06/G07 tehnički podaci ----------------
for r in dlf:
    u, b = r["u"], r["b"]
    if r["dups"] and b in ("rm", "norbin"):
        add("G05", "POTVRĐENO", 1, "P2", u, "Tekst: dupliran tehnički podatak",
            "Isti podatak dva puta u „Tehnički podaci”: " + " ; ".join(r["dups"][:3]),
            "lib/rm-catalog-products.ts (technicalFacts: facts + technical.*)" if b == "rm" else "lib/norbin-catalog-products.ts",
            "Prikazati jedan red po podatku (lokalizovanu vrednost), sirovu TDS vrednost izostaviti; isto i u JSON-LD additionalProperty.",
            "Postojeći podaci u data/rm-sync / data/norbin-sync (bez novog izvora)")
    elif r["dups"]:
        add("G05-PROVERA", "NEPROVERENO", 1, "P3", u, "Tekst: moguće dupliran tehnički podatak",
            "Ista oznaka više puta (može biti legitimna lista): " + " ; ".join(r["dups"][:2]),
            "data/*-catalog-products.generated.json", "Pregledati; ako su lista vrednosti, spojiti u jedan red sa nabrajanjem.",
            "Postojeći podaci")
    if r["ens"]:
        official = b in ("sata", "carsystem")
        add("G06", "PREPORUKA" if official else "POTVRĐENO", 1, "P3" if official else "P2", u, "Tekst: neprevedena (engleska) vrednost",
            " ; ".join(r["ens"][:3]),
            "data/<brend>-sync/technical-localization.json", "Prevesti kroz technical-localization.json („24 meseca”, „na 20 °C”, „7 dana”); zvaničan SATA naziv zadržati ako je namerno prikazan.",
            "Postojeći tehnički list (vrednost je već tu, samo prevod)")
    if r["dps"]:
        add("G07", "POTVRĐENO", 1, "P3", u, "Tekst: format broja (decimalna tačka)",
            " ; ".join(r["dps"][:3]),
            "lib/<brend>-catalog-products.ts / data/<brend>-sync (format vrednosti)",
            "Formatirati po srpskom standardu: decimalni zarez i razmak oko crte („1,3–1,4 mm”, „2,5 bar”).", "Postojeći podaci")

# ---------------- G08 baslac sušenje ----------------
for s in ["baslac-40-440-2k-voc-clear", "baslac-40-450-universal-clear-voc"]:
    add("G08", "POTVRĐENO", 3, "P1", f"/proizvodi/{s}", "Informacija: netačan tehnički podatak",
        "„Sušenje: 20°C: 50-415 · 60°C: 50-415 …” — umesto vremena prikazane su šifre učvršćivača; TDS str. 2 navodi vreme po učvršćivaču.",
        "lib/baslac-catalog-products.ts (dryingText) · data/baslac-sync/technical-localization.json",
        "Ispraviti parser/lokalizaciju prema TDS-u (tabela GAP-009 je već pripremljena).",
        "techinfo.baslac.com/en/40-440.pdf i 40-450.pdf, str. 2 (zvaničan TDS)", "DA",
        "Odobravate li tabelu GAP-009 (17 ispravki/prevoda TDS teksta, uključujući sušenje baslac 40-440/40-450)?", "automatski + iz starog izveštaja", "OLD-001, OLD-002")

# ---------------- G09/G10 dokumentacija ----------------
cnt = collections.Counter(); ex = {}
for p in pages:
    if p.get("status") != 200 or "?" in p["url"] or not p.get("segsMain"):
        continue
    t = " | ".join(p["segsMain"])
    if "bezbednosne listove izdaje lokalni predstavnik" in t:
        b = brand_of(p["url"]); cnt[b] += 1; ex.setdefault(b, p["url"])
    if "ne objavljuje tehnički list. | U pripremi" in t:
        add("G09", "POTVRĐENO", 1, "P2", p["url"], "Tekst: kontradiktoran status dokumenta",
            "„Proizvođač za ovaj proizvod ne objavljuje tehnički list.” uz oznaku „U pripremi”.",
            "lib/norbin-catalog-products.ts (documents)", "Ukloniti oznaku „U pripremi” kada dokument ne postoji; ostaviti samo rečenicu ili uputiti na upit.",
            "—")
    if "U pripremi za javni katalog." in t:
        add("G10", "POTVRĐENO", 1, "P2", p["url"], "Tekst: placeholder dokumenta",
            "Stavka „Uputstvo za upotrebu — U pripremi za javni katalog. — U pripremi” u Dokumentaciji.",
            "lib/carsystem-data.ts / lib/carsystem-catalog-products.ts / lib/rm-catalog-products.ts (documents status placeholder)",
            "Ukloniti placeholder stavku dok uputstvo ne postoji (ili linkovati TDS koji već postoji).", "—")
for b, n in cnt.items():
    add("G09-SDS", "PREPORUKA", 3, "P3", ex[b], "Dokument: bezbednosni list samo na upit",
        f"Na {n} stranica proizvoda ({b}) stoji „{b} bezbednosne listove izdaje lokalni predstavnik — dostupno na upit.” uz oznaku „U pripremi”.",
        "lib/rm-catalog-products.ts / lib/baslac-catalog-products.ts (detailDocuments, SDS)",
        "Ukloniti oznaku „U pripremi” (SDS se ne priprema — daje se na upit) ili dodati dugme „Zatražite bezbednosni list”.",
        "Lokalni predstavnik R-M/baslac (SDS na srpskom)", "DA",
        "Da li bezbednosne listove za R-M i baslac možemo da objavimo (dobijamo ih od lokalnog predstavnika) ili ostaju „na upit”?", "automatski", "OLD-102")

# baslac sistemske strane bez dokumentacije
for fam in ["baslac-line-30", "baslac-line-35", "baslac-line-45"]:
    add("G11", "POTVRĐENO", 2, "P2", f"/proizvodi/grupa/{fam}", "Dokument: nedostaje tehnički list sistema",
        "Sistemska stranica nema sekciju Dokumentacija (0 dokumenata u HTML-u).",
        "components/product/BaslacSystemPdp* · lib/baslac-systems.ts",
        "Dodati sekciju sa zvaničnim TDS-om linije (*_Line.pdf) sa techinfo.baslac.com.",
        "techinfo.baslac.com (zvaničan TDS linije)", nacin="automatski", trag="OLD-081")

# ---------------- G12 stranice i navigacija ----------------
add("G12", "POTVRĐENO", 1, "P1", "/katalozi", "Stranica: sadržaj se ne vidi bez JavaScript-a / SEO",
    "SSR HTML /katalozi sadrži samo H1 i jednu rečenicu; spisak 25 dokumenata renderuje se tek u pregledaču (DocumentLibraryExplorer u Suspense). Pretraživači i pregled bez JS ne vide nijedan katalog.",
    "components/documents/DocumentLibraryPage.tsx · DocumentLibraryExplorer.tsx",
    "Renderovati spisak dokumenata na serveru (filter iz URL-a primeniti posle hidracije).", "Postojeći dokumenti u public/documents (25 fajlova, svi postoje)", nacin="automatski (SSR) + vizuelno")
add("G12", "POTVRĐENO", 3, "P2", "/katalozi", "Informacija: nedostaju katalozi brendova",
    "Biblioteka ima 25 dokumenata: Carsystem 8 (brošure na nemačkom: Schleifmittel, Desinfektionsprozess), C.A.R.FIT 1, Cosmos Lac 1 (2022, EN), baslac 15. Nema R-M, Norbin, SATA, Befar ni RUPES kataloga.",
    "lib/documents.ts", "Dodati zvanične kataloge/brošure za R-M, Norbin, SATA, Befar, RUPES i noviji Cosmos katalog ako postoje i ako je objava dozvoljena.",
    "Zvanični sajtovi proizvođača / materijal od dobavljača", "DA",
    "Da li imate (ili smemo da objavimo) kataloge R-M, Norbin, SATA, Befar i RUPES, i noviji Cosmos Lac katalog?", "automatski", "")
add("G12", "POTVRĐENO", 3, "P2", "/o-nama", "Stranica: ne postoji",
    "/o-nama vraća 404; u meniju i footeru nema stranice o firmi (istorija, tim, centrala, delatnost).",
    "app/ (ruta ne postoji) · components/layout/Header.tsx, Footer.tsx",
    "Napraviti stranicu „O nama” (kratko o firmi, centrala u Inđiji, tehnička podrška, partnerska mreža, pravni podaci).",
    "Podaci od vlasnika (godina osnivanja, delatnost, tim, fotografije)", "DA",
    "Želite li stranicu „O nama”? Ako da: godina osnivanja, kratka istorija, šta firma radi, da li prikazujemo tim i fotografiju centrale.", "automatski", "OLD-156")
add("G12", "POTVRĐENO", 3, "P1", "/kontakt", "Stranica: nema politike privatnosti",
    "Kontakt forma traži ime, firmu, telefon, e-poštu i grad, a na sajtu ne postoji stranica o privatnosti/kolačićima (nijedna ruta u app/, nijedan link u footeru).",
    "app/ (ruta ne postoji) · components/contact/* · components/layout/Footer.tsx",
    "Dodati stranicu „Politika privatnosti” (i kolačići, ako se koriste) i link u footeru i uz formu.",
    "Pravni tekst koji odobrava vlasnik/pravnik", "DA",
    "Ko priprema/odobrava tekst politike privatnosti (ZZPL)? Da li sajt koristi analitiku ili kolačiće osim neophodnih?", "automatski", "OLD-155")
add("G12", "POTVRĐENO", 3, "P3", "/vodici", "Stranica: prazna rubrika dostupna posetiocu",
    "„Vodiči su u pripremi…” — stranica je dostupna (noindex), a na početnoj sekcija „Edukacija i znanje” nudi 5 tema koje vode na kontakt formu, ne na tekstove. 224 vodiča čekaju na grani feat/saveti-i-vodici (nije spojena).",
    "app/vodici/page.tsx · components/home/* (Edukacija)", "Ili objaviti proverene vodiče (posle stručne potvrde) ili sakriti /vodici do objave.",
    "Grana feat/saveti-i-vodici (184 provereno, 40 čeka stručnu potvrdu)", "DA",
    "Da li je tehnički tim potvrdio 40 preostalih vodiča i ko imenovano odobrava objavu?", "automatski", "OLD-111")
add("G12", "POTVRĐENO", 1, "P2", "/", "Navigacija: RUPES nedostaje u meniju i footeru",
    "Meni „Brendovi” i footer navode 8 brendova (R-M, Carsystem, Baslac, Norbin, SATA, Car Fit, Cosmos Lac, Befar); RUPES (25 proizvoda, /brendovi/rupes) dostupan je samo preko /brendovi.",
    "components/layout/Footer.tsx (brandLinks) · components/layout/navigation-data.ts", "Dodati RUPES u meni i footer.", "—", nacin="automatski (linkovi na svim stranicama)")
add("G12", "POTVRĐENO", 1, "P3", "/korpa", "Link: javna adresa vodi u interni portal",
    "/korpa → 307 /portal/korpa → prijava zaposlenih (/prijava). Neprijavljen kupac koji otvori /korpa završava na internoj prijavi.",
    "next.config.ts (redirects) / app/korpa/page.tsx", "Preusmeriti /korpa na /prijava/kupac?callbackUrl=/kupac/korpa (ili /kupac/korpa).", "—", nacin="automatski (HTTP)")
add("G12", "PREPORUKA", 1, "P3", "/brendovi/sata", "Link: spoljni linkovi na američku verziju sajta",
    "Linkovi ka https://www.sata.com/en-us/service/… (spare parts finder, premium warranty) umesto evropske verzije.",
    "lib/sata-brand-data.ts", "Koristiti evropsku/nemačku verziju sata.com.", "sata.com", nacin="automatski")

# ---------------- G13 brojevi ----------------
add("G13", "POTVRĐENO", 1, "P2", "/program", "Informacija: neusklađeni brojevi proizvoda",
    "/program: Boje i lakovi 467, Priprema i abrazivi 241, Pištolji i oprema 217, Poliranje 111, Potrošni materijal 876 (zbir 1.912 = zapisi sa varijantama). Filter kataloga za iste programe: 307 / 223 / 217 / 111 / 209 (ukupno 1.167 kartica).",
    "components/program/ProgramHero.tsx · lib/carsystem-data.ts (getCarsystemProductsByPublicProgramSlug)",
    "Brojati kartice kataloga (isto kao /katalog?program=…).", "—", nacin="automatski (SSR + pregledač)")
add("G13", "POTVRĐENO", 1, "P2", "/katalog", "Informacija: neusklađen broj programa",
    "Hero kataloga: „9 brendova | 7 programa”, a sajt ima 5 javnih programa (/program).",
    "components/catalog/CatalogPage.tsx", "Prikazati 5 programa (ili ukloniti brojač).", "—")

# ---------------- G14 pretraga ----------------
add("G14", "POTVRĐENO", 2, "P2", "/katalog?q=brusni%20papir", "Pretraga: srpski pojam ne nalazi proizvode",
    "Upit „brusni papir” vraća 1 proizvod (Car Fit Wet Sanding Paper); Carsystem brusni diskovi i trake (F.19, F.23…) se ne nalaze, iako „P80” vraća 11.",
    "lib/search/buildSearchIndex.ts (searchTerms / sinonimi)", "Dodati srpske sinonime za abrazive (brusni papir, brusni disk, brusna traka) u indeks.",
    "Postojeći katalog", nacin="automatski (pregledač, polje pretrage)")
add("G14", "POTVRĐENO", 1, "P3", "/katalog?q=sprej%20crni%20mat", "Pretraga: preširok rezultat",
    "Upit „sprej crni mat” vraća 886 proizvoda (gotovo ceo katalog) — reči se spajaju sa ILI.",
    "lib/search/*", "Rangirati rezultate koji sadrže sve reči ispred ostalih ili tražiti sve reči.", "—", nacin="automatski (pregledač)")
add("G14", "POTVRĐENO", 1, "P3", "/katalog?q=600%20ml", "Pretraga: pogrešan rezultat po pakovanju",
    "scripts/validate-search-deltas.mjs: upit „600 ml” vraća Cosmos artikle od 400 ml; pakovanje je u indeksu zapisano dvaput („400 ml 400 ml”). validate-catalog-search-index: zabranjeno polje `purpose` 2× u indeksu.",
    "lib/search/buildSearchIndex.ts", "Ispraviti tokenizaciju pakovanja i ukloniti dupli zapis; ukloniti `purpose` iz indeksa.", "—", nacin="automatski (validatori repoa)")

# ---------------- G15 SEO ----------------
groups = collections.defaultdict(list)
for p in pages:
    if p.get("status") == 200 and p.get("canon") and p["canon"].replace("https://carsystemirm.com", "") == p["url"]:
        groups[p["title"]].append(p["url"])
for t, us in groups.items():
    if len(us) > 1:
        for u in us:
            add("G15", "POTVRĐENO", 1, "P3", u, "SEO: dupli naslov stranice",
                f"Isti <title> „{t}” na {len(us)} stranica: {', '.join(us)}",
                "lib/seo/* (productMetadata)", "Dodati šifru proizvoda u naslov (npr. „R-M A 2A54 BlendingADD”).", "Postojeći podaci (šifra)")
long_titles = [p for p in pages if p.get("status") == 200 and p.get("canon") and p["canon"].replace("https://carsystemirm.com", "") == p["url"] and len(p.get("title") or "") > 70]
add("G15", "PREPORUKA", 1, "P3", "(318 stranica — vidi JAVNI_SAJT_INVENTAR_PROIZVODA.csv, kolona seo_title_duzina)", "SEO: predugačak naslov",
    f"{len(long_titles)} indeksabilnih stranica ima <title> duži od 70 znakova (npr. „{long_titles[0]['title']}”).",
    "lib/seo/metadata-builders.ts", "Skratiti sufiks („ | Carsystem i R-M”) ili naziv varijanti na stranicama porodica.", "—", naziv="više stranica", brend="više")
add("G15", "POTVRĐENO", 1, "P3", "/proizvodi/rm-a-2a54-blendingadd", "SEO: pogrešan jezik dokumenta u JSON-LD",
    "JSON-LD subjectOf → DigitalDocument „Tehnički list” ima inLanguage „sr-Latn”, a PDF je engleski (techinfo.rmpaint.com/unicorn/en/…). Isto na svim R-M stranicama sa TDS-om; additionalProperty takođe ponavlja Mlaznica/VOC.",
    "lib/seo/* (productJsonLd)", "inLanguage uzeti iz jezika dokumenta (en).", "—")

# ---------------- G16 varijante ----------------
add("G16", "PREPORUKA", 1, "P3", "/proizvodi/grupa/cosmos-lac-fast-acrylic?varijanta=CL-FAST-ACRYLIC-RAL-8011-SJAJ-400-ML-FAST-ACRYLIC-RAL-8011-NUT-BROWN",
    "Prikaz: pogrešna varijanta pre učitavanja JavaScript-a",
    "734 od 774 adrese ?varijanta= u serverskom HTML-u prikazuju podrazumevanu varijantu (npr. H1 „…RAL 1007 Daffodil Yellow”), a tačnu tek posle hidracije (provereno u pregledaču: „…RAL 8011 Nut Brown”). Kanonski URL je porodica, pa SEO nije pogođen; posetilac na sporoj vezi kratko vidi pogrešan proizvod.",
    "app/proizvodi/grupa/[slug]/page.tsx (statički prerender bez searchParams)", "Razmotriti dinamički render varijante ili skelet umesto podrazumevane varijante.", "—",
    nacin="automatski (SSR) + pregledač", naziv="Cosmos Lac Fast Acrylic (i ostale porodice)")
add("G16", "POTVRĐENO", 2, "P3", "/proizvodi/grupa/cosmos-lac-ral", "Identitet: dvosmislen ključ varijante",
    "validate-product-identity: ?varijanta=CL-301 pokazuje na 2, CL-304 na 3 varijante; isto master-mechanic-ral (10 → 5) i master-mechanic-wheel-paint (14 → 2).",
    "lib/catalog/product-identity.mjs · data/cosmos-lac-*", "Razrešiti ključeve (korak 2B iz identitetskog plana).", "Cosmos Brand Kit / TDS", nacin="automatski (validator repoa)")

# ---------------- G17 slike: kvalitet (audit) ----------------
aud = list(csv.DictReader(open(f"{REPO}/data/catalog/image-quality/evidence/CARSYSTEM_IMAGE_AUDIT.csv")))
slugs = {p["slug"]: p for p in inv["products"]}
for r in aud:
    if r["class"][0] in "BED" and r["slug"] in slugs and slugs[r["slug"]]["image"] == r["runtimePath"]:
        add("G17", "POTVRĐENO", 2, "P3", slugs[r["slug"]]["canonical"], "Slika: kvalitet (ton/okvir/izvor)",
            f"Image audit 2026-09-22, klasa {r['class']}, problem {r['problemType']}: {r['why'][:160]}. Runtime fajl {r['runtimePath']} nije menjan posle merenja (git log).",
            "public" + r["runtimePath"] + " · scripts/catalog/image-remaster/",
            (r["treatment"] or "Ponovo izvesti iz zvaničnog originala")[:200], r["officialOriginalUrl"] or "carsystem.org original",
            nacin="iz starog izveštaja + provera da je fajl isti", trag="CARSYSTEM_IMAGE_AUDIT.csv rank " + r["rank"])

# ---------------- G18 prava ----------------
for p in inv["products"]:
    if p["brand"] == "rupes":
        add("G18-RUPES", "POTVRĐENO", 3, "P2", p["canonical"], "Slika: pravo korišćenja nije potvrđeno",
            f"Slika {p['image']} (izvor carsystem.org) se prikazuje; pravo prikaza pod RUPES brendom nije potvrđeno (RUPES_IMAGE_RIGHTS_REVIEW).",
            "lib/carsystem-data.ts · data/catalog/image-supply/", "Potvrditi pravo ili zameniti zvaničnim RUPES materijalom.",
            "carsystem.org / RUPES", "DA", "Da li je korišćenje slika RUPES proizvoda sa carsystem.org dozvoljeno (dobavljač/ugovor)?", "automatski", "OLD-064")

# ---------------- G19 interni tekst u opisima proizvoda ----------------
for p in inv["products"]:
    if re.search(r"dostavljen", p["short"] + p["long"] + p["purpose"]):
        add("G19", "POTVRĐENO", 1, "P2", p["canonical"], "Tekst: interni opis umesto namene",
            f"Kratak opis: „{p['short'][:140]}”",
            "data/rm-imported-products.generated.json / lib/rm-catalog-products.ts",
            "Napisati namenu iz TDS-a (tip, upotreba, kompatibilni sistem).", "Zvaničan R-M TDS (techinfo.rmpaint.com) — već povezan gde postoji")
    if p["brand"] == "befar" and "prikazani kao radionički potrošni program" in p["long"]:
        add("G19", "PREPORUKA", 1, "P3", p["canonical"], "Tekst: generički opis",
            "Isti dugi opis na 8 Befar proizvoda: „Befar sunđeri su prikazani kao radionički potrošni program…”.",
            "data/befar-catalog-products.generated.json", "Kratak opis po proizvodu (tvrdoća, prečnik, namena) iz Befar kataloga.", "Befar katalog (već u data/befar-sync)")
    alt = p["imageAlt"] or ""
for p in [x for x in inv["products"] if not x["redirect"]]:
    pass
alt_counts = collections.Counter()
for p in inv["products"]:
    m = re.search(r",\s*(zvanična Cosmos Lac ambalaža|ilustrativni prikaz proizvoda|dostavljeni prikaz proizvoda)$", p["imageAlt"] or "")
    if m:
        alt_counts[(BRAND[p["brand"]], m.group(1))] += 1
for (b, s), n in alt_counts.items():
    add("G20", "POTVRĐENO", 1, "P3", f"/katalog?brend={[k for k,v in BRAND.items() if v==b][0]}", "SEO/pristupačnost: alt tekst sa internom napomenom",
        f"{n} zapisa ima alt koji se završava sa „, {s}” (napomena o poreklu slike, ne opis).",
        "lib/<brend>-catalog-products.ts (productImage.alt)", "Alt = naziv + vrsta proizvoda + pakovanje.", "Postojeći podaci", naziv=f"{b} — slike proizvoda", brend=b)

# ---------------- G21 ostalo potvrđeno ----------------
add("G21", "POTVRĐENO", 1, "P2", "/proizvodi/carsystem-f23-brusni-diskovi", "Informacija: nedostaju kompatibilni proizvodi",
    "Zvanično preporučeni Interface Pad 150 mm i Excenter Back Pad T.19 ne prikazuju se, iako zapisi carsystem-interface-pad i carsystem-excenter-back-pad-t-19 sada postoje.",
    "lib/carsystem-catalog-products.ts (compatibleProducts)", "Povezati postojeće zapise kao kompatibilne proizvode.", "carsystem.org (zvanična preporuka, već zabeležena)", trag="OLD-084")
add("G21", "POTVRĐENO", 1, "P3", "/proizvodi/carsystem-finish-back-pad-m-14", "Tekst: interna napomena o izvoru",
    "U tehničkim podacima: „Prethodna šifra artikla 157.721 Šifra iz kataloga proizvođača: CARSYSTEM Product Catalogue 2026/27 (EN), PDF str. 72.”",
    "data/carsystem-catalog-products.generated.json", "Ukloniti napomenu o izvoru iz vidljivog teksta.", "—", trag="OLD-112")
add("G21", "POTVRĐENO", 1, "P3", "/proizvodi/sata-coupling-with", "SEO: odsečen slug",
    "Adresa /proizvodi/sata-coupling-with (naziv „Spojka, G 1/8\" unutrašnji navoj za SATA BVD i Spray-Master”) — slug je presečen na navodniku.",
    "data/sata-sync (slug) + redirect", "Preimenovati slug uz 308 preusmerenje (slugRenames).", "—", "DA", "Odobravate li promenu adrese uz trajno preusmerenje?", trag="OLD-110")
add("G21", "POTVRĐENO", 1, "P3", "/katalog?kategorija=sprejevi", "Taksonomija: pogrešno svrstani proizvodi",
    "taxonomy:validate: 25 baslac zapisa neklasifikovano (baslac-30-s00…); 123 baslac zapisa ušlo u „Sprejevi” kroz Cosmos aerosol granu (limenke, ne sprejevi).",
    "lib/productTaxonomy.mjs", "Ispraviti mapiranje kategorija za baslac.", "—", "DA", "Odobravate li izmenu klasifikacije baslac proizvoda (izlaze iz „Sprejevi”)?", nacin="automatski (validator repoa)")

# ---------------- G22 lokacije ----------------
add("G22", "POTVRĐENO", 3, "P2", "/prodavnice", "Informacija: prodajna mesta",
    "Javno je 9 od 91 lokacije (82 čekaju proveru: 57 geokodiranih, 25 približnih). Nijedna lokacija nema radno vreme (workingHours prazno); 2 adrese bez poštanskog broja (BAST DOO, Markus Professional); naziv „Zoran Vukonjanski / Vukonjanski” dupliran.",
    "data/store-locations.json · data/public-location-overrides.json", "Potvrditi i objaviti dodatne lokacije, radno vreme i pune adrese.",
    "Podaci od partnera / vlasnika", "DA",
    "Da li možete da potvrdite radno vreme 9 javnih prodavnica i da li objavljujemo još neke od 82 lokacije na čekanju?", "automatski (podaci) + vizuelno", "OLD-003…005")

# ---------------- G23 odluke stručnog pregleda ----------------
tracks = list(csv.DictReader(open(os.path.join(os.path.dirname(A), "old-reports-tracks.csv"))))
for t in tracks:
    if t["gap_type"] != "decision" or not re.match(r"(CS|CF|CL|NB)-\d+", t["claim"]):
        continue
    m = re.search(r"(/proizvodi/[^\s,;()]+)", t["slug_or_url"])
    url = m.group(1) if m and P.get(m.group(1), {}).get("status") in (200, 307) else (t["slug_or_url"][:120] or "—")
    did = t["claim"].split(":")[0]
    affects = "ne direktno" not in t["claim"]
    add("G23", "NEPROVERENO", 3, "P2" if affects else "P3", url, "Odluka: stručni pregled (identitet/izvor/asortiman)",
        t["claim"][:260], "data/<brend>-sync/manual-decisions.json",
        "Primeniti odgovor kroz sync izvor istine (manual-decisions), ne kroz generisani izlaz.",
        "Paket EXPERT_REVIEW_MASTER_FINAL (grana chore/expert-review-package-preservation)", "DA",
        f"Odluka {did} iz paketa stručnog pregleda (2026-09-24) — odgovor još nije primenjen.", "iz starog izveštaja (ID ne postoji u kodu)", t["track_id"])

# ---------------- G25 dokumentacija po brendu (zbirno) ----------------
nodoc = collections.Counter(); tot = collections.Counter()
for p in inv["products"]:
    if p["redirect"]:
        continue
    pg = P.get(p["canonical"], {})
    tot[p["brand"]] += 1
    if not [x for x in pg.get("docItems", []) if x.get("href")]:
        nodoc[p["brand"]] += 1
DOCNOTE = {"befar": ("Za sunđere i podloške TDS uglavnom nije primenljiv; za hemiju (paste) jeste.", "Befar katalog / befar.com.tr", "NE", ""),
           "rupes": ("Za mašine je primenljivo uputstvo/lista rezervnih delova.", "rupes.com (uputstva) — uz potvrdu prava", "DA", "Smemo li da linkujemo RUPES uputstva sa rupes.com?"),
           "carfit": ("302 TDS/SDS fajla C.A.R.FIT-a su preuzeta, ali se ne objavljuju dok se ne potvrdi pravo.", "assets/manufacturer/carfit/documents (već preuzeto)", "DA", "Smemo li da objavimo pojedinačne C.A.R.FIT TDS/SDS (302 fajla, već preuzeta)?"),
           "carsystem": ("Za hemiju (gitovi, prajmeri, lakovi) TDS je primenljiv; za pribor nije.", "carsystem.org (TDS po artiklu)", "NE", ""),
           "sata": ("Pored 37 stranica sa mrtvim linkovima (G04), 118 nema nijedan dokument; za pištolje je primenljivo uputstvo.", "sata.com stranica artikla", "NE", "")}
for b, n in nodoc.items():
    if b not in DOCNOTE or n == 0:
        continue
    note, izvor, odl, pit = DOCNOTE[b]
    add("G25", "NEPROVERENO", 3 if odl == "DA" else 2, "P2", f"/katalog?brend={b}", "Dokument: stranica bez ijednog dokumenta",
        f"{n} od {tot[b]} stranica proizvoda nema nijedan dokument sa linkom (kolona dokumenata_sa_linkom u JAVNI_SAJT_INVENTAR_PROIZVODA.csv). {note} Primenljivost po proizvodu nije pojedinačno ocenjena.",
        "lib/<brend>-catalog-products.ts (documents)", "Dodati TDS/uputstvo gde je primenljivo (hemija, mašine, pištolji).", izvor, odl, pit, "automatski (SSR)",
        "OLD-107" if b == "carfit" else ("OLD-109" if b == "rupes" else ""), naziv=f"{BRAND[b]} — proizvodi bez dokumentacije", brend=BRAND[b])

# ---------------- G26 vizuelno ----------------
add("G26", "POTVRĐENO", 1, "P1", "/brendovi/carfit", "Prikaz: lista proizvoda nevidljiva",
    "Sekcija „Car Fit proizvodi dostupni kod nas” (120 kartica, ~27.800 px na desktopu) ostaje providna (opacity 0) i posle skrolovanja: omotač CarfitReveal ima IntersectionObserver threshold 0,08, a 8 % visine bloka je veće od celog ekrana, pa se reveal nikad ne okine. Posetilac vidi ogroman prazan prostor (desktop i mobilni; sa „reduce motion” se vidi). Provereno u pregledaču: kartica #40 renderovana, roditelj sa data-cf-reveal ima opacity 0.",
    "components/brand/carfit/CarfitReveal.tsx (threshold) · components/brand/carfit/CarfitBrandPage.tsx (omotač showcase-a)",
    "Za visoke blokove koristiti threshold 0 (ili reveal po kartici) i ne omotavati celu listu jednim reveal elementom.", "—",
    nacin="vizuelno (snimak) + pregledač (computed style)")
add("G26", "POTVRĐENO", 1, "P2", "/brendovi/norbin", "Prikaz: tamna tema nije podržana",
    "U tamnoj temi (data-theme=dark) telo strane ostaje belo: 84 % svetlih piksela na desktopu, 79 % na mobilnom (početna u tamnoj temi: 1 %). Zaglavlje je tamno, sadržaj svetao.",
    "components/norbin-brand/*.module.css", "Uvesti tokene tamne teme (kao na ostalim brend stranama).", "—", nacin="vizuelno (snimci 1440/390, svetla/tamna)")
add("G26", "POTVRĐENO", 1, "P2", "/brendovi/sata", "Prikaz: tamna tema nije podržana",
    "Svetla i tamna verzija strane su gotovo identične (69 % svetlih piksela u tamnoj temi); izuzetak su hero i sekcija „Šest koraka”, koje su tamne u obe teme.",
    "components/brand/sata/*.module.css", "Uvesti tokene tamne teme.", "—", nacin="vizuelno")
add("G26", "PREPORUKA", 1, "P3", "/brendovi/befar", "Prikaz: svetli blokovi u tamnoj temi",
    "Befar (31 %) i Cosmos Lac (25 %) imaju veće svetle sekcije i u tamnoj temi; deluje kao namerni dizajn brenda, ali odudara od ostatka sajta.",
    "components/brand/befar/* · components/brand/cosmos/*", "Proveriti sa dizajnom da li su svetli blokovi namerni.", "—", nacin="vizuelno")
add("G26", "PREPORUKA", 1, "P3", "/prodavnice", "Informacija: telefon prodavnice vidljiv tek posle izbora",
    "Spisak prikazuje naziv i adresu; telefon i ruta pojavljuju se tek kad se prodavnica izabere (dugme „Pozovite”). Radno vreme ne postoji ni za jednu lokaciju.",
    "components/stores/StoreLocator.tsx", "Prikazati telefon kao tekst u svakoj kartici.", "data/store-locations.json (telefoni već postoje)", nacin="pregledač")
add("G12", "POTVRĐENO", 3, "P1", "https://carsystemirm.com/", "Stranica: javni sajt nije dostupan",
    "Production: https://carsystemirm.com/ vraća 307 → /site-u-pripremi (režim održavanja), pa posetilac danas ne vidi nijednu od proverenih stranica. Ova provera je urađena nad lokalnim produkcionim buildom istog koda.",
    "middleware.ts · lib/site-access.ts", "Otvoriti sajt kada se zatvore P1 stavke (ili zadržati održavanje do objave).", "—", "DA",
    "Kada otvaramo javni sajt (gašenje režima održavanja) i šta mora biti zatvoreno pre toga?", "automatski (HTTP prema Production-u)", "OLD-158")

# ---------------- copy-review ----------------
tmap = {"jezik": "Tekst: jezik/pravopis", "placeholder": "Tekst: nedovršen ili interni", "informacija": "Informacija za posetioca",
        "pravna-tvrdnja": "Pravna/brend tvrdnja", "broj": "Informacija: netačan ili neusklađen broj", "slika-alt": "Slika: alt/prikaz",
        "SEO": "SEO", "generičko": "Tekst: generički", "duplikat": "Tekst: duplikat"}
for line in open(os.path.join(A, "copy-review.md")):
    if not re.match(r"\| \d+ \|", line):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) < 9:
        continue
    n, url, strana, tip = c[:4]; izvor, pouzd, predlog, zasto = c[-1], c[-2], c[-3], c[-4]; citat = " | ".join(c[4:-4])
    status = {"potvrđeno": "POTVRĐENO", "preporuka": "PREPORUKA", "proveriti": "NEPROVERENO"}[pouzd]
    legal = tip == "pravna-tvrdnja"
    if legal:
        red, prio, odl = 3, "P1", "DA"
    elif status == "NEPROVERENO":
        red, prio, odl = 2, "P2", "NE"
    elif status == "POTVRĐENO":
        red, prio, odl = 1, ("P1" if tip == "placeholder" else "P2"), "NE"
    else:
        red, prio, odl = 1, "P3", "NE"
    pit = f"Potvrđujete li tvrdnju {citat[:120]} (izvor/dozvola)?" if legal else ""
    if tip == "jezik" and status == "NEPROVERENO" and ("pisan" in (zasto + predlog).lower() or "C.A.R.FIT" in predlog):
        odl, red = "DA", 3
        pit = "Koje pisanje naziva brenda usvajamo na celom sajtu (npr. „baslac” ili „Baslac”, „C.A.R.FIT” ili „Car Fit”)?"
    first_url = url.split(",")[0].strip()
    add("G24-" + tip, status, red, prio, url, tmap.get(tip, tip), f"„{citat}” — {zasto}", izvor, predlog,
        "Zvanični izvor proizvođača / vlasnik" if legal or status == "NEPROVERENO" else "Postojeći tekst (bez novog materijala)",
        odl, pit, "automatski (SSR tekst) + urednički pregled", f"copy-review #{n}", naziv=strana, brend=brand_of(first_url))

# ---------------- izlaz ----------------
order = {"P1": 0, "P2": 1, "P3": 2}
rows.sort(key=lambda r: (r["radni_red"], order[r["prioritet"]], r["grupa"], r["url"]))
for i, r in enumerate(rows, 1):
    r["id"] = f"JS-{i:04d}"
cols = ["id", "status", "radni_red", "prioritet", "grupa", "url", "stranica_ili_proizvod", "brend", "vrsta_nedostatka", "dokaz",
        "fajl_u_kodu", "predlog_dopune", "izvor_materijala", "potrebna_odluka", "pitanje_za_vlasnika", "nacin_provere", "trag"]
with open(os.path.join(OUT, "JAVNI_SAJT_NEDOSTACI.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)

# inventar proizvoda
dl_by = {r["u"]: r for r in dlf}
aud_by = {r["slug"]: r for r in aud}
inv_rows = []
for p in sorted(inv["products"], key=lambda x: (x["brand"], x["slug"])):
    pg = P.get(p["canonical"], {})
    own = P.get("/proizvodi/" + p["slug"], {})
    d = dl_by.get(p["canonical"].split("?")[0], {})
    docs = [x for x in pg.get("docItems", []) if x.get("href")]
    dead = [h for h in (pg.get("hrefs") or []) if h in bad]
    img = p["image"] or ""
    img_state = ("placeholder" if "placeholder" in img else "pending-rights (Production: placeholder)" if "pending-rights" in img
                 else "generička ambalaža linije" if (p["brand"] == "baslac" and p["redirect"]) else "ok")
    inv_rows.append(dict(
        slug=p["slug"], brend=BRAND.get(p["brand"]), naziv=p["name"], url=p["canonical"], http_kanonski=pg.get("status"),
        http_sopstveni_slug=own.get("status"), tip="varijanta porodice" if p["redirect"] else ("porodica/kartica" if p["canonical"].startswith("/proizvodi/grupa") else "proizvod"),
        slika=img_state, slika_putanja=img, alt=p["imageAlt"], image_audit_klasa=(aud_by.get(p["slug"], {}).get("class") or ""),
        kratak_opis_znakova=p["shortLen"], dug_opis_znakova=p["longLen"], namena_znakova=p["purposeLen"],
        specifikacija_u_podacima=p["specs"], tehnickih_redova_prikazano=sum(len(x) for x in []),
        pakovanje=" / ".join(p["packages"]) or (p["volume"] or ""),
        dokumenata_sa_linkom=len(docs), dokumenti_404=len(dead),
        dupli_tehnicki=len(d.get("dups", [])), engleske_vrednosti=len(d.get("ens", [])), decimalna_tacka=len(d.get("dps", [])),
        seo_title=pg.get("title"), seo_title_duzina=len(pg.get("title") or ""), meta_opis_duzina=len(pg.get("desc") or ""),
        h1=(pg.get("h1") or [""])[0] if pg else "", jsonld=",".join(pg.get("ldjson", [])) if pg else ""))
icol = list(inv_rows[0].keys()); icol.remove("tehnickih_redova_prikazano")
with open(os.path.join(OUT, "JAVNI_SAJT_INVENTAR_PROIZVODA.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=icol, extrasaction="ignore"); w.writeheader(); w.writerows(inv_rows)

# zbir
summ = {"rows": len(rows)}
summ["by_status"] = collections.Counter(r["status"] for r in rows)
summ["by_red"] = collections.Counter(r["radni_red"] for r in rows)
summ["by_prio"] = collections.Counter(r["prioritet"] for r in rows)
bv = collections.defaultdict(collections.Counter)
for r in rows:
    bv[r["brend"]][r["vrsta_nedostatka"]] += 1
summ["brand_x_type"] = {b: dict(c) for b, c in bv.items()}
summ["by_group"] = collections.Counter(r["grupa"] for r in rows)
summ["decisions"] = sum(1 for r in rows if r["potrebna_odluka"] == "DA")
json.dump(summ, open(os.path.join(A, "summary.json"), "w"), ensure_ascii=False, indent=1, default=dict)
print(json.dumps({k: v for k, v in summ.items() if k != "brand_x_type"}, ensure_ascii=False, indent=1, default=dict))
