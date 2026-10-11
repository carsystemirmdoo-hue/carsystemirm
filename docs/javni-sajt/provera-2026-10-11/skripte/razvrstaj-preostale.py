import csv, json, html, collections, re, sys
SP = sys.argv[1]
P = "docs/javni-sajt/JAVNI_SAJT_NEDOSTACI.csv"
rows = list(csv.DictReader(open(P, encoding="utf-8")))
inv = list(csv.DictReader(open("docs/javni-sajt/JAVNI_SAJT_INVENTAR_PROIZVODA.csv", encoding="utf-8")))
titles = {u: html.unescape(v["t"] or "") for u, v in json.load(open(SP + "/titles-built.json")).items()}
sds = json.load(open(SP + "/sds-pages.json"))
B = " Provera: izolovani build fix/javni-sajt-2026-10-11, localhost:3520."

# --- stanja posle trećeg kruga
for r in rows:
    if r["id"] == "JS-0628":
        r["stanje"] = "REŠENO"
        r["resenje_i_provera"] = ("Podloga abraziva iz zvaničnog podnaslova proizvođača (Paper/Film/Net/Foam abrasive, Sanding Fleece) → "
            "pojmovi papir/film/mreža/sunđer/flis (lib/search/abrasive-backing.mjs); „brusni papir” 7 rezultata: Carsystem P.25 disk i traka, "
            "Soft-Roll, Tec Line Softflex, Topline WP S, Car Fit Gold Paper Disc i Wet Sanding Paper — bez filmskih (F.19/F.23, Car Fit Red Film), "
            "mrežastih i sunđerastih. P.19 nije u katalogu kupca (BUSINESS_OUT_OF_PROGRAMME). Test: abrasive-backing.test.mjs + validate-search-deltas." + B)
    if r["id"] == "JS-0473":
        r["stanje"] = "DELIMIČNO"
        r["resenje_i_provera"] = ("Ponavljanje brenda uklonjeno („Carsystem X – Carsystem proizvod | Carsystem i R-M” → „Carsystem X | Carsystem i R-M”); "
            "naslova >70 znakova 320 → 84, 0 duplih na 1.216 stranica. Preostalih 84 su dugi zvanični nazivi (SATA 50, porodice 15, Cosmos 12…) — "
            "vidljivi naziv se ne menja radi dužine; ostaje kao preporuka. Test: lib/seo/productTitles.test.mts." + B)

A, Bk, C, D = "A — mogu sam", "B — čeka sliku, dokument ili pravo", "C — Vaša odluka", "D — preporuka"
by_id = {
  # A — rešivo iz postojećih podataka, bez poslovne odluke
  **{i: A for i in "JS-0172 JS-0174 JS-0179 JS-0180 JS-0181 JS-0186 JS-0191 JS-0198 JS-0199 JS-0201 JS-0202 JS-0204 JS-0206 JS-0207 JS-0324 JS-0469 JS-0517 JS-0518 JS-0519 JS-0520 JS-0521 JS-0522 JS-0523 JS-0524 JS-0525 JS-0527 JS-0529 JS-0575 JS-0576 JS-0580 JS-0582 JS-0583 JS-0584 JS-0585 JS-0587 JS-0629 JS-0630 JS-0631 JS-0632 JS-0633 JS-0634 JS-0635 JS-0637 JS-0639 JS-0640 JS-0642 JS-0645 JS-0647 JS-0648 JS-0649 JS-0650 JS-0651 JS-0652 JS-0654 JS-0655 JS-0656 JS-0658 JS-0659 JS-0660 JS-0662 JS-0669".split()},
  # B — čeka materijal (slika, dokument, pravo)
  **{i: Bk for i in "JS-0010 JS-0021 JS-0024 JS-0638 JS-0657 JS-0663 JS-0664 JS-0665 JS-0666 JS-0667 JS-0668 JS-0914 JS-0940 JS-0941 JS-0942 JS-0943 JS-0970 JS-1013 JS-1014 JS-1015 JS-1016 JS-1017 JS-1018".split()},
  # C — poslovna odluka
  **{i: C for i in "JS-0014 JS-0020 JS-0167 JS-0530 JS-0532 JS-0549 JS-0641 JS-0643 JS-0644 JS-0646 JS-0661 JS-0915 JS-0918 JS-0919 JS-0944 JS-1011 JS-1012 JS-1019 JS-1020 JS-1021".split()},
  # D — preporuka
  **{i: D for i in "JS-0473 JS-0516 JS-0533 JS-0534 JS-0535 JS-0536 JS-0537 JS-0538 JS-0539 JS-0540 JS-0541 JS-0542 JS-0543 JS-0544 JS-0545 JS-0546 JS-0547 JS-0548 JS-0550 JS-0551 JS-0552 JS-0553 JS-0554 JS-0555 JS-0556 JS-0557 JS-0558 JS-0559 JS-0560 JS-0561 JS-0562 JS-0563 JS-0564 JS-0566 JS-0567 JS-0568 JS-0569 JS-0570 JS-0571 JS-0572 JS-0573 JS-0574 JS-0581 JS-0586 JS-0653".split()},
}
by_group = [("G01", Bk), ("G02", Bk), ("G03", Bk), ("G17", Bk), ("G18", Bk), ("G06", D), ("G23", C), ("G24-pravna", C), ("G09-SDS", C), ("G21", C), ("G25", Bk)]

programs = ["/program/boje-i-lakovi", "/program/priprema-i-abrazivi", "/program/pistolji-i-oprema", "/program/poliranje", "/program/potrosni-materijal"]
cats = ["/kategorije/bezbojni-lakovi", "/kategorije/prajmeri-i-punioci", "/kategorije/bazne-boje", "/kategorije/ucvrscivaci-i-razredjivaci"]
brand_of = {"befar": "befar", "carsystem": "carsystem", "sata": "sata", "carfit": "carfit", "rupes": "rupes", "baslac": "baslac", "norbin": "norbin", "rm": "rm"}

def pages(r):
    u, i, g = r["url"], r["id"], r["grupa"]
    if i == "JS-0473": return {k for k, t in titles.items() if len(t) > 70}
    if i == "JS-1019": return set(sds["baslac"])
    if i == "JS-1020": return set(sds["rm"])
    if i == "JS-0919": return {"/"}
    if i == "JS-0202": return {"/program/pistolji-i-oprema", "/program/poliranje", "/program/priprema-i-abrazivi", "/brendovi/rupes"}
    if u == "sve /program/*": return set(programs)
    if u == "sve /kategorije/*": return set(cats)
    if i == "JS-0662": return set(programs) | {"/brendovi/rupes"}
    if i == "JS-0207": return {"/brendovi/baslac", "/brendovi/norbin"}
    m = re.match(r"^/katalog\?brend=([a-z-]+)$", u)
    if m:
        b = m.group(1)
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
        if g == "G25": return {x["url"] for x in inv if norm(x["brend"]) == norm(b) and x["dokumenata_sa_linkom"] in ("0", "")}
        if g == "G20": return {x["url"] for x in inv if norm(x["brend"]) == norm(b) and "ilustrativni prikaz" in x["alt"]}
        return {"/katalog"}
    if u.startswith("/") and " " not in u and "," not in u: return {u.split("?")[0]}
    return set()  # stručni pregled bez jedne stranice, „više strana”

cnt = collections.Counter(); pg = collections.defaultdict(set); per_grp = collections.defaultdict(lambda: collections.Counter())
for r in rows:
    if r["stanje"] not in ("OTVORENO", "DELIMIČNO"):
        r["kategorija_preostalog"] = ""; r["stranice_preostalog"] = ""; continue
    k = by_id.get(r["id"]) or next((v for p, v in by_group if r["grupa"].startswith(p)), None)
    # Obrada već objavljenih zvaničnih Carsystem slika (alfa, nivoi, okvir) ne čeka materijal;
    # novi packshot sa carsystem.org i RUPES (pravo) čekaju.
    if r["grupa"] == "G17" and r["brend"] == "Carsystem" and not re.search(r"povući|tražiti", r["predlog_dopune"]):
        k = A
    if not k: raise SystemExit(f"nerazvrstan {r['id']} {r['grupa']}")
    ps = pages(r)
    r["kategorija_preostalog"] = k; r["stranice_preostalog"] = str(len(ps)) if ps else "—"
    cnt[k] += 1; pg[k] |= ps; pg["sve"] |= ps; per_grp[k][r["grupa"]] += 1

cols = list(rows[0].keys())
for c in ("kategorija_preostalog", "stranice_preostalog"):
    if c not in cols: cols.append(c)
with open(P, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
out = {k: {"nalaza": cnt[k], "stranica": len(pg[k]), "grupe": dict(per_grp[k])} for k in (A, Bk, C, D)}
out["ukupno"] = {"nalaza": sum(cnt.values()), "stranica": len(pg["sve"]), "bez_jedne_stranice": sum(1 for r in rows if r.get("stranice_preostalog") == "—")}
out["stanje"] = dict(collections.Counter(r["stanje"] for r in rows))
json.dump(out, open(SP + "/razvrstano.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))

# --- pitanja: koliko nalaza i jedinstvenih stranica otključava odgovor
open_rows = [r for r in rows if r["stanje"] in ("OTVORENO", "DELIMIČNO")]
Q = {
 "sata_slike": lambda r: r["grupa"] == "G01-SATA" or r["id"] in ("JS-0942", "JS-0665"),
 "sds_rm_baslac": lambda r: r["id"] in ("JS-1019", "JS-1020"),
 "strucni_pregled": lambda r: r["grupa"] == "G23",
 "rupes": lambda r: r["grupa"] == "G18-RUPES" or (r["grupa"] == "G17" and r["brend"] == "RUPES") or r["id"] in ("JS-0941", "JS-0664", "JS-1014"),
 "fotografije_magacin": lambda r: r["grupa"] in ("G01-RM", "G01-BASLAC", "G01-NORBIN", "G02"),
 "tvrdnje": lambda r: r["grupa"].startswith("G24-pravna"),
 "carfit_tds": lambda r: r["id"] == "JS-1013",
 "cosmos_brand_kit": lambda r: r["grupa"] == "G01-COSMOS",
 "kategorije": lambda r: r["id"] in ("JS-0641", "JS-0643", "JS-0644", "JS-0646", "JS-0167"),
 "otvaranje_privatnost": lambda r: r["id"] in ("JS-0918", "JS-0919", "JS-0944"),
 "norbin_prava": lambda r: r["grupa"] == "G01-NORBIN-PROD" or r["id"] in ("JS-0663", "JS-0010", "JS-0914"),
 "carsystem_packshot": lambda r: r["id"] == "JS-0940" or (r["grupa"] == "G17" and r["brend"] == "Carsystem" and re.search(r"povući|tražiti", r["predlog_dopune"])),
 "naziv_brenda": lambda r: r["id"] in ("JS-1011", "JS-1012"),
 "rm_sifre_crystal": lambda r: r["id"] in ("JS-0020", "JS-0014", "JS-0915"),
}
qo = {}
for k, f in Q.items():
    hit = [r for r in open_rows if f(r)]
    ps = set().union(*[pages(r) for r in hit]) if hit else set()
    qo[k] = {"nalaza": len(hit), "stranica": len(ps)}
json.dump(qo, open(SP + "/pitanja.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(qo, ensure_ascii=False))
