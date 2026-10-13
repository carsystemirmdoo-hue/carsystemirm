#!/usr/bin/env python3
"""Ažurira stanje nalaza u JAVNI_SAJT_NEDOSTACI.csv posle ispravki (grana fix/javni-sajt-2026-10-11)."""
import csv, json, re, sys, collections

CSV = sys.argv[1]
POST = sys.argv[2]  # scratchpad/audit-post
rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
dl = {r["u"]: r for r in json.load(open(f"{POST}/dl-findings.json"))}
links = json.load(open(f"{POST}/links.json"))
ext_bad = {r["u"] for r in links["external"] if not str(r["st"]).startswith("200")}
pages = {p["url"]: p for p in json.load(open(f"{POST}/pages.json"))}

B = "izolovani build fix/javni-sajt-2026-10-11, localhost:3520"
RES, PART, OPEN, NOT = "REŠENO", "DELIMIČNO", "OTVORENO", "NIJE NEDOSTATAK"

def page_text(url):
    p = pages.get(url)
    return " | ".join(p.get("segsMain") or []) if p else ""

# copy-review # → (stanje, rešenje)
CR = {}
def cr(nums, state, note):
    for n in nums:
        CR[n] = (state, note)
cr([2], RES, "Množina „varijanta/varijante/varijanti” (lib/sr-plural.ts) na karticama, pretrazi, SEO opisu porodice i Cosmos traci.")
cr([3], RES, "Alt R-M uvezenih slika bez „, dostavljeni prikaz proizvoda” (lib/rm-imported-products.ts).")
cr([12, 13, 14, 17], RES, "Interni tekst baslac strane zamenjen javnim tekstom (BaslacBrandPage.tsx, BaslacProcessNavigator.tsx, baslacBrandData.ts).")
cr([22], RES, "„potvrdićemo” umesto „potvrđujemo”.")
cr([28], RES, "„industriji nameštaja”.")
cr([38], RES, "„zahteva podlošku”.")
cr([39], RES, "Uvod Befar liste bez razvojnog tona.")
cr([45], RES, "ID-jevi slotova (carfit-task-…) više se ne prikazuju (CarfitMedia.tsx, hero stageCode).")
cr([47], NOT, "Ponovo provereno: naslov glasi „Car Fit proizvodi dostupni kod nas” (naziv brenda je u istom H2); broj nije potreban.")
cr([53], RES, "„bezbojni lakovi” umesto „klar lakovi” (Car Fit strana i lib/documents.ts).")
cr([57, 61, 62], RES, "Interni izrazi na Carsystem strani zamenjeni („Carsystem proizvoda u katalogu”, „Katalog”, „Ne vidite artikal…”).")
cr([58], RES, "Brojač broji JAVNE programe (5), a „četiri” se odnosi na sisteme; više nema 07 naspram 4.")
cr([63], RES, "Nazivi programa sa dijakriticima umesto sluga (components/carsystem-brand/programLabel.ts).")
cr([64, 65], RES, "„Opremam radionicu”, „grubo i fino poliranje”.")
cr([70], RES, "„Bezbednosni listovi”.")
cr([76, 77], RES, "Hero: „669 nijansi i varijanti u 25 COSMOS linija” (sve linije), traka: „+124 varijante u 16 linija” — zbir se slaže.")
cr([78], RES, "„GRAFITI I STREET ART”.")
cr([79], RES, "„prajmeri” u opisu Cosmos kataloga.")
cr([80], RES, "„RAL RAL” uklonjen iz prikaza naziva, alt-a i SEO-a (5 zapisa; slug nepromenjen).")
cr([87], PART, "Tekst „Fotografija u pripremi” uklonjen (prazno dekorativno polje); sama fotografija i dalje nedostaje — vidi JS-0914.")
cr([88], RES, "Brojač „0 bez sistema boje” uklonjen.")
cr([90, 101], RES, "„učvršćivač”, „pokriva”.")
cr([94], RES, "Prikazuje se zvanična oznaka N15-020 (publicCode iz Norbin synca) i na brend strani i na PDP-u porodice.")
cr([95, 96], RES, "Jedna rečenica bez „EMEA” i bez „sa strane sajta”.")
cr([97], RES, "„Podaci iz tehničkih listova proizvođača.”")
cr([98], RES, "„Završni lak u boji (sistem boje)”, „Toneri i baze za mešanje”.")
cr([103], RES, "Faza bez R-M proizvoda više ne prikazuje „0 proizvoda” ni link na prazan filter; nudi upit.")
cr([105, 106, 108], RES, "Interne napomene R-M strane zamenjene; DIAMONT opis: „Solventni sistem baznih boja R-M.”")
cr([119, 120], RES, "RUPES uvod i tekst šablona bez internog izvora („iz naše ponude”, „Brend u ponudi Carsystem i R-M”).")
cr([123], PART, "Opis trake ostalih brendova prepravljen; duplirana oznaka „RUPES RUPES” nije menjana.")
cr([129, 137], RES, "SATA napomena o programu preformulisana bez promene značenja; „predložićemo”.")
cr([139], RES, "„Prikazano: N.” na kategorijama; rečenica o sledećim stranama samo na /katalog.")
cr([140], PART, "„Potvrđeni R-M proizvodi” → „R-M proizvodi u kategoriji”; kategorije i dalje obuhvataju samo R-M (odluka o obuhvatu otvorena).")
cr([145], NOT, "Ponovo prebrojano: 21 kartica i „Prikazano: 21”.")
cr([149], RES, "Uvod kategorije bez „potvrđenom … lokalnom”.")
cr([154, 155, 156, 157], RES, "Šablonski tekstovi programa zamenjeni (ProgramHero, ProgramPage, ProgramBrands, ProgramProducts).")
cr([161], RES, "Opis 12 R-M artikala bez napomene „dokumentovan kroz dostavljeni zvanični R-M materijal”.")
cr([173], RES, "Brojevi programa = broj kartica u katalogu: 307 / 223 / 217 / 111 / 309; filter „Potrošni materijal” sada uključuje aerosole kao i program.")

out = []
for r in rows:
    g, url, state, note = r["grupa"], r["url"], OPEN, ""
    if g == "G26" and r["id"] in ("JS-0026", "JS-0210", "JS-0211"):
        state = RES
        note = {
            "JS-0026": "CarfitReveal prag 0; kartice #0/#40/#110 opacity 1 na 1440 i 390 px.",
            "JS-0210": "Tokeni tamne teme; svetlih blokova u tamnoj temi 0 % (1440 i 390), bilo 48 %/87 %.",
            "JS-0211": "Tokeni tamne teme; svetlih blokova u tamnoj temi 0 % (1440 i 390), bilo 35 %/54 %.",
        }[r["id"]]
    elif g == "G12" and r["id"] == "JS-0001":
        state, note = RES, "Spisak dokumenata se renderuje na serveru (DocumentLibrarySections); u statičkom HTML-u 50 PDF linkova (bilo 0)."
    elif g == "G13":
        state, note = RES, "Brojevi iz stvarnog kataloga (countCatalogCardsForProgramSlugs): 307/223/217/111/309; katalog „5 programa”."
    elif g == "G04":
        dead = [h for h in (pages.get(url, {}).get("hrefs") or []) if h in ext_bad]
        state = RES if not dead else OPEN
        note = "Zamenjeni zvaničnim linkom istog fajla sa stranice istog artikla na sata.com (65 jedinstvenih zamena, svaki proveren kao PDF); svih 670 spoljnih linkova sada 200." if not dead else f"Još neispravno: {dead}"
    elif g in ("G05",):
        d = dl.get(url, {})
        state = RES
        note = "Sirovi red istog podatka se ne prikazuje (lib/technical-facts-display.mjs, i u JSON-LD)." + (" Preostali redovi iste oznake nose različite vrednosti: " + " ; ".join(d.get("dups", [])[:2]) if d.get("dups") else "")
    elif g == "G06":
        d = dl.get(url, {})
        if r["status"] == "PREPORUKA":
            state, note = OPEN, "Zvanični engleski naziv (SATA/Carsystem) — namerno nije prevođen."
        else:
            state = RES if not d.get("ens") else OPEN
            note = "Srpske jedinice i „na 20°C” (formatTechnicalValueSr)." if state == RES else f"Još: {d.get('ens')}"
    elif g == "G07":
        d = dl.get(url, {})
        state = RES if not d.get("dps") else OPEN
        note = "Decimalni zarez i crta opsega (formatTechnicalValueSr)." if state == RES else f"Još: {d.get('dps')[:2]}"
    elif g == "G08":
        state, note = RES, "Parser-correction prema zvaničnom TDS-u (str. 2, Drying) + ispravljen dryingText; 40-450 ima DRUGE vrednosti od 40-440 (6/10/16 h, 20/30/40 min)."
    elif g == "G09":
        state, note = RES, "Red „Tehnički list — U pripremi” se ne prikazuje kada proizvođač TDS ne objavljuje."
    elif g == "G10":
        t = page_text(url)
        state = RES if "U pripremi za javni katalog" not in t else OPEN
        note = "Placeholder stavke „Uputstvo za upotrebu” (i dve slične) uklonjene iz lib/carsystem-data.ts."
    elif g == "G19" and r["status"] == "POTVRĐENO":
        state, note = RES, "Napomena o poreklu uklonjena pri čitanju (lib/rm-imported-products.ts)."
    elif g == "G20" and "dostavljeni prikaz" in r["dokaz"]:
        state, note = RES, "„, dostavljeni prikaz proizvoda” uklonjen iz alt-a (59 zapisa)."
    elif g == "G21" and r["id"] == "JS-0531":
        state, note = RES, "„Ranija šifra istog artikla iz kataloga proizvođača.” umesto naziva PDF-a i strane."
    elif g.startswith("G24"):
        m = re.search(r"copy-review #(\d+)", r["trag"])
        if m and int(m.group(1)) in CR:
            state, note = CR[int(m.group(1))]
    elif g == "G05-PROVERA":
        d = dl.get(url, {})
        state = NOT if d.get("dups") else RES
        note = "Ponovo provereno: redovi iste oznake nose različite vrednosti (lista)." if d.get("dups") else "Duplikat istog podatka uklonjen pravilom prikaza."
    r["stanje"] = state
    r["resenje_i_provera"] = (note + f" Provera: {B}.") if state in (RES, PART, NOT) and note else note
    out.append(r)

cols = list(rows[0].keys())
with open(CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader(); w.writerows(out)
c = collections.Counter(r["stanje"] for r in out)
print(c)
print(collections.Counter((r["grupa"], r["stanje"]) for r in out if r["stanje"] != OPEN))
