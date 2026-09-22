#!/usr/bin/env python3
"""
Owner supply pack — izveden iz ODOBRENOG `USER_IMAGE_SUPPLY_QUEUE.csv` (115 redova), koji se samo ČITA.
image_id, suggested_filename i target_path se prenose bajt-za-bajt. Piše samo:
  - USER_IMAGE_SUPPLY_QUEUE_FINAL.csv
  - USER_IMAGE_SUPPLY_GUIDE.md
Ništa se ne izmišlja: pakovanje „Na upit” ostaje „Na upit”; fotografija ne definiše pakovanje, šifru ni varijantu.
"""
import csv, json, os, sys

HERE = os.environ.get("IMAGE_AUDIT_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".cache", "image-audit")
HERE = os.path.abspath(HERE)
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
read = lambda name: list(csv.DictReader(open(os.path.join(HERE, name), newline="", encoding="utf-8")))
queue = read("USER_IMAGE_SUPPLY_QUEUE.csv")
inventory = {row["image_id"]: row for row in read("IMAGE_IDENTITY_INVENTORY.csv")}
rights = {row["image_id"] for row in read("IMAGE_RIGHTS_REVIEW.csv")}

NAME = {"baslac": "baslac", "rm": "R-M", "norbin": "Norbin", "befar": "BEFAR", "sata": "SATA", "carsystem": "Carsystem", "carfit": "C.A.R.FIT"}
ORDER = ["baslac", "rm", "norbin", "befar", "sata", "carsystem", "carfit"]
NO_PACKAGE = {"", "Na upit", "Granulacije na upit"}

errors = []
by_brand = {}
for row in queue:
    by_brand[row["brand"]] = by_brand.get(row["brand"], 0) + 1
# Broj redova se MERI iz manifesta; proveravaju se odnosi koji moraju da važe, ne očekivana vrednost.
if not queue:
    errors.append("supply queue je prazan")
for row in queue:
    if row["image_id"] in rights:
        errors.append(f"identitet je i u rights review: {row['image_id']}")
    if row["image_id"] not in inventory:
        errors.append(f"nema ga u inventaru: {row['image_id']}")
if errors:
    print(json.dumps({"errors": errors}, ensure_ascii=False, indent=1)); sys.exit(1)

def need(row, inv):
    scope, members, package = inv["image_scope"], int(row["members_sharing_identity"] or 1), row["package"]
    known = package not in NO_PACKAGE and not package.startswith("Art.")
    if scope == "SHARED_IMAGE_GROUP":
        return ("REPREZENTATIVNA SLIKA GRUPE", f"Jedna fotografija ambalaže, spreda, etiketa čitljiva. Pokriva {members} zapisa koji dele isti naziv proizvoda i razlikuju se samo oznakom ({row['article_number']}). Fotografiše se JEDNA ambalaža; ne traži se snimak svake oznake.")
    if scope == "FAMILY":
        return ("SLIKA SERIJE", f"Jedna reprezentativna limenka linije, spreda, etiketa čitljiva. Ta jedna fotografija je slika CELE serije i pokriva {members} zapisa — sve oznake tonera i sve zapremine te linije. NE fotografisati svaki toner ni svako pakovanje posebno.")
    if scope == "ARTICLE":
        return ("SLIKA REDA (boja/dimenzija)", f"Baš ovaj artikal: {row['variant']} (šifra {row['article_number']}). Ostali redovi iste kartice već imaju svoju sliku, pa je ovde potrebna fotografija TAČNO ove boje/dimenzije.")
    if scope == "VARIANT":
        return ("PACKSHOT PAKOVANJA/VARIJANTE", f"Baš ovo pakovanje/varijanta: {package}. Druga varijanta iste kartice već ima sliku; fotografija drugog pakovanja se NE sme koristiti umesto ove.")
    if members > 1:
        return ("PACKSHOT KARTICE", f"Jedna fotografija proizvoda pokriva svih {members} brojeva artikala ove kartice ({row['article_number']}) — nije potrebna slika po broju artikla.")
    if known:
        return ("PACKSHOT PROIZVODA", f"Proizvod u pakovanju {package}, spreda, etiketa čitljiva.")
    return ("PACKSHOT PROIZVODA", "Proizvod u pakovanju koje firma stvarno prodaje, spreda, etiketa čitljiva. Katalog pakovanje vodi kao „na upit”: fotografija NE menja taj podatak — pakovanje se upisuje samo iz izvora proizvođača.")

WHY = {
    "proizvođač ne objavljuje sliku": "Proizvođač za ovaj proizvod ne objavljuje zvaničnu sliku (provereno u sync-u brenda), pa je jedini legitiman izvor sopstvena fotografija.",
    "nedostaje slika pakovanja/varijante; ostatak kartice ima sliku": "Kartica ima sliku, ali ovo pakovanje/varijanta/red nema svoju; sajt ne pozajmljuje sliku drugog pakovanja.",
    "ručni zapis bez slike i bez zvaničnog izvora": "Ručno unet proizvod iz programa firme, bez slike i bez zvaničnog izvora slike.",
}

COLUMNS = ["priority", "brand", "product_name", "public_code", "manufacturer_code", "article_number", "package", "variant", "image_scope", "members_sharing_identity", "what_image_is_needed", "why_image_is_needed", "suggested_filename", "target_path", "image_id", "slug", "notes"]
final = []
for row in queue:
    inv = inventory[row["image_id"]]
    kind, text = need(row, inv)
    why = next((value for key, value in WHY.items() if row["why_user_supply"].startswith(key)), row["why_user_supply"])
    final.append({"priority": row["priority"], "brand": row["brand"], "product_name": row["product_name"], "public_code": inv["public_code"], "manufacturer_code": inv["manufacturer_code"],
                  "article_number": row["article_number"], "package": row["package"], "variant": row["variant"], "image_scope": inv["image_scope"], "members_sharing_identity": row["members_sharing_identity"], "what_image_is_needed": f"{kind}: {text}", "why_image_is_needed": why,
                  "suggested_filename": row["suggested_filename"], "target_path": row["target_path"], "image_id": row["image_id"], "slug": row["slug"], "notes": row["notes"], "_kind": kind, "_members": int(row["members_sharing_identity"] or 1)})

# Redosled: kao u odobrenom queue-u (isti redovi, isti ključevi).
for source, out in zip(queue, final):
    assert (source["image_id"], source["suggested_filename"], source["target_path"]) == (out["image_id"], out["suggested_filename"], out["target_path"])
assert len({row["suggested_filename"] for row in final}) == len(final) and len({row["image_id"] for row in final}) == len(final)

with open(os.path.join(HERE, "USER_IMAGE_SUPPLY_QUEUE_FINAL.csv"), "w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator="\n", extrasaction="ignore")
    writer.writeheader(); writer.writerows(final)

# ── Vodič ────────────────────────────────────────────────────────────────────────────────
BRAND_INTRO = {
    "baslac": "Većina proizvoda nema zvaničnu sliku na baslac.com. Linije tonera (Basecoat 45, Basecoat 35, Topcoat 30, Topcoat 30 CV) imaju JEDNU sliku serije: limenke te linije izgledaju isto, razlikuje ih samo oznaka tonera na nalepnici, a zapremina se bira u kartici — ne traži se fotografija po toneru ni po pakovanju. Ostali zapisi su zasebni proizvodi sa svojom šifrom.",
    "rm": "R-M (rmpaint.com) za ove proizvode ne objavljuje packshot. Svaka kartica je poseban proizvod sa svojom oznakom (npr. „A 2010”) → jedna fotografija po kartici. Izuzetak su dve grupe istog naziva (GHD THINNER i GHD HARDENER) gde se razlikuje samo oznaka brzine: za njih je dovoljna jedna reprezentativna slika grupe. Katalog pakovanje vodi kao „na upit”; fotografisati pakovanje koje je stvarno na lageru.",
    "norbin": "Norbin izvor nema slike ni stranice proizvoda. Jedna fotografija po proizvodu; pakovanje je navedeno u tabeli. `N15-020 5 L` je poseban identitet jer 1 L već ima sliku.",
    "befar": "Kartice već imaju packshot; nedostaje samo {n} redova određene boje/dimenzije. Ovo je najniži prioritet (P3): PDP do tada prikazuje sliku kartice.",
    "sata": "Samo porodice za koje SATA sliku uopšte NE objavljuje. SATA proizvodi za koje zvanična slika postoji NISU u ovom spisku — oni čekaju odluku o pravima (rights review) i ne treba ih fotografisati sada.",
    "carsystem": "Dva ručno uneta proizvoda bez slike i bez zvaničnog izvora. (Kvalitet postojećih Carsystem slika je odvojen projekat i NE rešava se fotografisanjem.)",
    "carfit": "Jedan ručno unet proizvod bez slike.",
}
md = ["# Vodič za pripremu slika — owner supply pack (115)", "",
      "Odobreni manifest: `data/catalog/image-supply/USER_IMAGE_SUPPLY_QUEUE.csv` (115 identiteta; zaključan u `manifest-lock.json`). Prvi probni krug: `data/catalog/image-supply/OWNER_SUPPLY_BATCH_01_CANDIDATES.csv`. Ovaj vodič ne uvozi slike i ne menja katalog.", "",
      "## Šta NIJE u ovom spisku", "",
      "- **SATA / RUPES / Cosmos Lac slike pod rights review** (198 identiteta) — za njih se čeka odluka o pravima, ne fotografija.",
      "- **Kvalitet postojećih Carsystem/RUPES slika** — odvojen projekat (`IMAGE_QUALITY_QUEUE.csv`).",
      "- Pribor SATA faze 2 bez zvanične slike — placeholder je prihvaćen.", "",
      "## Opšta pravila", "",
      "1. **Izvor slike — dozvoljena su dva izvora:**",
      "   - **A) sopstvena fotografija** stvarnog proizvoda;",
      "   - **B) originalni fajl koji je firma dobila direktno od proizvođača ili dobavljača.** Za svaki takav fajl obavezno evidentirati: **od koga** je dobijen, **originalni naziv fajla** (ako postoji) i **da li je firma potvrdila da se asset sme koristiti customer-facing**.",
      "   - Samo posedovanje fajla NIJE dokaz prava objave. Ako pravo nije potvrđeno, identitet ide na **RIGHTS_REVIEW pre objave** — fajl se može primiti i pripremiti, ali se ne objavljuje.",
      "   - Bez slika sa interneta, distributerskih sajtova, marketplace-a ili Google Images; bez AI-generisanih packshotova.",
      "2. Fotografija NE menja podatke kataloga: pakovanje „na upit”, šifra i varijanta ostaju kakvi jesu dok ih ne potvrdi izvor proizvođača.",
      "3. Ako proizvod nije na lageru ili više nije u programu — NE tražiti zamensku sliku; javiti, pa identitet ostaje na placeholderu.", "",
      "## Kako mi dostaviti sliku", "",
      "Ne treba ništa konvertovati u WebP — konverziju, cut-out i canonical target fajl pravi kasniji importer.", "",
      "- Dostaviti **najbolji originalni fajl koji postoji**: PNG, JPG/JPEG ili WebP, u **punoj rezoluciji** (ne uvećavati manji original).",
      "- **Bez WhatsApp / Viber / Instagram kompresije** — slati kao fajl/dokument (mejl, cloud folder, USB), ne kao „sliku” u četu.",
      "- **Ceo proizvod u kadru**, sa praznim prostorom oko njega; **bez ručnog izrezivanja** ako postoji i najmanji rizik da se odseče deo proizvoda.",
      "- Etiketa čitljiva koliko izvor dozvoljava.",
      "- **Ne menjati boju, oblik ni etiketu**; bez filtera i retuša; **bez AI elemenata** (generisana pozadina, dorada, „upscale”).",
      "- Ako je u pitanju fotografija: neutralna čista pozadina (bela/svetlosiva), ravnomerno meko svetlo, proizvod spreda, bez ruku, polica i drugih proizvoda u kadru.", "",
      "### Naziv fajla (pravilo uparivanja)", "",
      "`suggested_filename` iz manifesta je **FINALNI TARGET** naziv (uvek `.webp`). Izvorni fajl koji dostavljate mora imati **isti osnovni naziv (basename)**, a ekstenzija sme biti bilo koji dozvoljeni format:", "",
      "| Manifest (`suggested_filename`) | Dozvoljeni izvorni fajl |", "|---|---|",
      "| `carsystem__carsystem-soft-plus-git.webp` | `carsystem__carsystem-soft-plus-git.png` |",
      "| | `carsystem__carsystem-soft-plus-git.jpg` / `.jpeg` |",
      "| | `carsystem__carsystem-soft-plus-git.webp` |", "",
      "Determinističko pravilo (isto je zapisano u `data/catalog/image-supply/manifest-lock.json`):", "",
      "1. basename izvornog fajla (sve pre poslednje tačke) mora biti **znak-po-znak jednak** basename-u iz `suggested_filename` — mala slova, bez razmaka, bez dodataka tipa `-final`, `(1)`, `kopija`;",
      "2. ekstenzija izvora ∈ `.png`, `.jpg`, `.jpeg`, `.webp` (velika/mala slova u ekstenziji se ne razlikuju);",
      "3. za jedan basename sme postojati **tačno jedan** izvorni fajl — dva fajla istog basename-a (npr. `.png` i `.jpg`) importer odbija dok se ne ostavi jedan;",
      "4. fajl čiji basename ne postoji u manifestu se ne uvozi.", "",
      "Importer još NIJE implementiran; ovaj paket ništa ne uvozi.", "",
      "## Kada jedna fotografija pokriva više artikala", "",
      "| Tip | Pravilo |", "|---|---|",
      "| `SLIKA SERIJE` | 1 fotografija = CELA linija tonera: sve oznake i sve zapremine (baslac). |",
      "| `REPREZENTATIVNA SLIKA GRUPE` | 1 fotografija = više zapisa istog naziva koji se razlikuju samo oznakom (R-M). Slika ne tvrdi da etiketa odgovara svakoj oznaci. |",
      "| `PACKSHOT KARTICE` | 1 fotografija = svi brojevi artikala te kartice (SATA). |",
      "| `PACKSHOT PROIZVODA` | 1 fotografija = 1 proizvod. |",
      "| `PACKSHOT PAKOVANJA/VARIJANTE` | Potrebna je slika BAŠ tog pakovanja; slika drugog pakovanja iste kartice se ne koristi. |",
      "| `SLIKA REDA (boja/dimenzija)` | Potrebna je slika BAŠ te boje/dimenzije (BEFAR). |", ""]
for brand in ORDER:
    items = [row for row in final if row["brand"] == brand]
    if not items:
        continue
    intro = BRAND_INTRO[brand].format(n=len(items))
    md += [f"## {NAME[brand]} — {len(items)} {'fotografija' if len(items) != 1 else 'fotografija'}", "", intro, ""]
    groups = {}
    for row in items:
        groups.setdefault(row["_kind"], []).append(row)
    for kind in ["SLIKA SERIJE", "REPREZENTATIVNA SLIKA GRUPE", "PACKSHOT PAKOVANJA/VARIJANTE", "SLIKA REDA (boja/dimenzija)", "PACKSHOT KARTICE", "PACKSHOT PROIZVODA"]:
        if kind not in groups:
            continue
        md += [f"### {kind} ({len(groups[kind])})", "", "| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |", "|---|---|---|---|---|---|"]
        for row in groups[kind]:
            code = row["manufacturer_code"] or row["article_number"] or row["public_code"] or "—"
            detail = " · ".join(part for part in [row["package"], row["variant"]] if part) or "—"
            md.append(f"| {row['priority']} | {row['product_name']} | {code} | {detail} | {row['_members']} | `{row['suggested_filename']}` |")
        md.append("")
md += ["## Predaja", "", "Sve fajlove staviti u jedan folder, bez podfoldera, sa nazivima po pravilu uparivanja iz sekcije „Kako mi dostaviti sliku”. Uvoz u repo (`target_path`) radi se tek posle posebnog odobrenja — ovaj paket ništa ne uvozi.", "",
       "## Owner Batch 01", "", "`OWNER_SUPPLY_BATCH_01_CANDIDATES.csv` je mali probni krug (15–20 identiteta) za prvi end-to-end test. Ništa se ne pretpostavlja o lageru: u koloni `owner_has_product` upisati `YES`, `NO` ili `NEED_TO_CHECK`; ostale kolone se ne menjaju.", ""]
open(os.path.join(HERE, "USER_IMAGE_SUPPLY_GUIDE.md"), "w", encoding="utf-8").write("\n".join(md))

kinds = {}
for row in final:
    kinds[row["_kind"]] = kinds.get(row["_kind"], 0) + 1
print(json.dumps({"rows": len(final), "byBrand": by_brand, "byKind": kinds, "recordsCovered": sum(row["_members"] for row in final)}, ensure_ascii=False, indent=1))
