import csv,collections,sys
rows=list(csv.DictReader(open(sys.argv[1])))
def cat(v):
    if v.startswith("Slika"): return "Slike"
    if v.startswith("SEO"): return "SEO/alt"
    if v.startswith("Dokument") or v.startswith("Link") or v.startswith("Pretraga") or v.startswith("Stranica") or v.startswith("Navigacija") or v.startswith("Prikaz"): return "Stranice, linkovi, dokumenti, pretraga"
    if v.startswith("Informacija") or v.startswith("Taksonomija") or v.startswith("Identitet"): return "Informacije za posetioca"
    if v.startswith("Pravna") or v.startswith("Odluka"): return "Tvrdnje i odluke"
    return "Tekst"
cats=["Slike","Tekst","Informacije za posetioca","Stranice, linkovi, dokumenti, pretraga","SEO/alt","Tvrdnje i odluke"]
order=["R-M","Carsystem","baslac","Norbin","Cosmos Lac","Befar","C.A.R.FIT","SATA","RUPES","—","više"]
t=collections.defaultdict(collections.Counter)
for r in rows: t[r["brend"]][cat(r["vrsta_nedostatka"])]+=1
print("| Brend | "+" | ".join(cats)+" | Ukupno | od toga potvrđeno |"); print("|"+"---|"*(len(cats)+3))
tot=collections.Counter()
for b in order+[b for b in t if b not in order]:
    if b not in t: continue
    c=t[b]; pot=sum(1 for r in rows if r["brend"]==b and r["status"]=="POTVRĐENO")
    tot.update(c); tot["_p"]+=pot
    print(f"| {b if b!='—' else 'Zajedničko (ceo sajt)'} | "+" | ".join(str(c[x]) for x in cats)+f" | {sum(c.values())} | {pot} |")
print("| **Ukupno** | "+" | ".join(f"**{tot[x]}**" for x in cats)+f" | **{sum(tot[x] for x in cats)}** | **{tot['_p']}** |")
print()
v=collections.Counter((r["vrsta_nedostatka"],r["status"]) for r in rows)
kinds=sorted({r["vrsta_nedostatka"] for r in rows},key=lambda k:-sum(n for (a,s),n in v.items() if a==k))
print("| Vrsta nedostatka | Potvrđeno | Preporuka | Neprovereno | Ukupno |"); print("|---|---:|---:|---:|---:|")
for k in kinds:
    a,b_,c=v[(k,"POTVRĐENO")],v[(k,"PREPORUKA")],v[(k,"NEPROVERENO")]; print(f"| {k} | {a} | {b_} | {c} | {a+b_+c} |")
print()
s=collections.Counter((r["radni_red"],r["status"]) for r in rows)
print("| Radni red | Potvrđeno | Preporuka | Neprovereno | Ukupno | P1 |"); print("|---|---:|---:|---:|---:|---:|")
for rr in "123":
    n=[s[(rr,x)] for x in ("POTVRĐENO","PREPORUKA","NEPROVERENO")]; p1=sum(1 for r in rows if r["radni_red"]==rr and r["prioritet"]=="P1")
    print(f"| {rr} | "+" | ".join(map(str,n))+f" | {sum(n)} | {p1} |")
