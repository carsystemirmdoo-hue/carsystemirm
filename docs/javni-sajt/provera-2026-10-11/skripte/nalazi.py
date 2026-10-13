"""Nalazi pretrage fotografija 2026-10-11 po slugu (ulaz za xlsx.py)."""
import json, os, hashlib
P=os.path.expanduser('~/Carsystem/radno/slike-za-pronalazenje/preuzeto')
def sha(f):
    return hashlib.sha256(open(f,'rb').read()).hexdigest() if f and os.path.exists(f) else ''
F={}
# SATA
for m in json.load(open(f'{P}/sata/_manifest.json')):
    s=m['slug']
    if m['status']=='preuzeto':
        own=m['filenameMatches']=='yes'
        F[s]=dict(found='Da — preuzeto',url=m['url'],page=m['page'],file=f"preuzeto/sata/{m['file']}",sha=m['sha256'],
          match=('Potvrđeno — sopstvena glavna slika artikla '+m['article']+' sa njegove stranice na sata.com') if own else ('Proizvod/porodica da, artikal NE — '+m['note'].replace('no image for main article','nema slike za glavni artikal').replace('image only for sibling article(s)','slika samo za srodne artikle')[:160]),
          rights='NE — SATA zadržava prava (potrebna pisana saglasnost)',
          need='Potvrda prava: pisana saglasnost SATA' if own else 'Potvrda prava SATA + odluka da li prihvatate sliku srodnog artikla')
    else:
        F[s]=dict(found='Ne — SATA ne objavljuje sliku ovog artikla',url='',page=m['page'],file='',sha='',
          match='—',rights='—',need=None)
# Cosmos
BK='preuzeto/cosmos-lac/brand-kit/'; SJ='preuzeto/cosmos-lac/sajt/'
BKR='NIJE DOKUMENTOVANO — zvanični Cosmos Brand Kit (isti izvor kao 742 objavljene slike), ali pisana dozvola za web upotrebu ne postoji u dokumentaciji, a izvorni ZIP-ovi više nisu u Downloads; potrebna potvrda Cosmos Lac-a'
COS={
 'cosmos-lac-acrylic-varnish-376-gloss':('acrylic-varnish-376-gloss.png','acrylic-varnish-376-gloss.png','Proizvod da (Acrylic Varnish 400 ml); završnica NE — proizvođač koristi istu sliku za 376/377/378 (bajt-identično i na sajtu)'),
 'cosmos-lac-acrylic-varnish-377-matt':('acrylic-varnish-377-matt.png','acrylic-varnish-377-matt.png','Proizvod da; završnica NE — ista slika kao 376/378'),
 'cosmos-lac-acrylic-varnish-378-satin':('acrylic-varnish-378-satin.png','acrylic-varnish-378-satin.png','Proizvod da; završnica NE — ista slika kao 376/377'),
 'cosmos-lac-chrome-effect-450-container':('chrome-effect-450-container.png','chrome-effect-450-container-v2.png','Proizvod da (dekorativna boja u kontejneru); nijansa NE (ista slika kao Gold 451); PAKOVANJE NE SLAŽE SE: slika sa sajta piše 185 ML, katalog 175 ml'),
 'cosmos-lac-gold-effect-451-container':('gold-effect-451-container.png','gold-effect-451-container-v2.png','Proizvod da; nijansa NE (ista slika kao Chrome 450); pakovanje: slika sa sajta 185 ML, katalog 175 ml'),
 'cosmos-lac-high-heat-350-silver-container':('high-heat-350-silver-container.png','high-heat-350-silver-container-175ml-v2.png','Proizvod da (High Heat kontejner 175 ml); boja NE — ista slika za 350/351/353'),
 'cosmos-lac-high-heat-351-black-container':('high-heat-351-black-container.png','high-heat-351-black-container-175ml-v2.png','Proizvod da; boja NE — ista slika za 350/351/353'),
 'cosmos-lac-high-heat-353-maroon-container':('high-heat-353-maroon-container.png','high-heat-353-maroon-container-175ml-v2.png','Proizvod da; boja NE — ista slika za 350/351/353'),
 'cosmos-lac-ral-9003-matt-signal-white':('ral-9003-matt-signal-white-v2.png','ral-9003-matt-signal-white-v2.png','Potvrđeno — natpis „MATT RAL 9003 SIGNAL WHITE”, 400 ml'),
 'cosmos-lac-flame-orange-fo-314-piglet-pink-dark':('flame™-orange-fo-314-piglet-pink-dark.png','flame-orange-fo-314-piglet-pink-dark.png','ČEKA POTVRDU — etiketa ne prikazuje šifru ni nijansu; stranica FO-314 na cosmoslac.com koristi ovaj fajl, ali Brand Kit isti fajl nosi i kao „fo-313-Piglet-Pink-Dark” (zvanični FO-313 je Cherry Dark, drugi fajl); poklopac je crven, bliži FO-312/313 nego „pink” nijansama 308–310 — podudaranje nije dokazano'),
}
for s,(bk,sj,match) in COS.items():
    F[s]=dict(found='Da — lokalno u Brand Kit-u + preuzeto sa cosmoslac.com',url='https://cosmoslac.com/wp-content/uploads/'+sj,page='',file=BK+bk,sha=sha(os.path.join(P,'cosmos-lac/brand-kit',bk)),
      match=match,rights=BKR+(' — za ovu sliku potvrdite i nijansu/pakovanje' if 'NE' in match else ''),
      need=('Potvrda Cosmos Lac-a: koja je slika FO-314 Piglet Pink Dark' if match.startswith('ČEKA') else ('Odluka: prihvatate li zajedničku sliku porodice (ne prikazuje varijantu) + potvrda prava Brand Kit-a' if 'NE' in match else 'Potvrda prava Brand Kit-a (Cosmos Lac)')))
F['cosmos-lac-easy-max-glitter-912-multi']=dict(found='Da — preuzeto sa cosmoslac.com (nema je u Brand Kit-u)',url='https://cosmoslac.com/wp-content/uploads/easy-max-glitter-912-multi-1.png',page='',file=SJ+'easy-max-glitter-912-multi-1.png',sha=sha(os.path.join(P,'cosmos-lac/sajt/easy-max-glitter-912-multi-1.png')),
  match='Potvrđeno — natpis „EASY MAX GLITTER MULTI”, 400 ml',rights='NE — uslovi cosmoslac.com traže pisanu dozvolu',need='Potvrda prava: pisana dozvola Cosmos Lac (ili dopuna Brand Kit-a)')
# R-M
F['rm-h-2p80-filler-harden-r-plus']=dict(found='Da — preuzeto sa rmpaint.com',url='https://www.rmpaint.com/data/sites/rm/files/2025-11/H2P80_web_2.png',page='https://www.rmpaint.com/en-int/products/h-2p80-esense-fill-r-hardener',file='preuzeto/rm/rm__rm-h-2p80-filler-harden-r-plus__H2P80_web_2.png',sha=sha(os.path.join(P,'rm/rm__rm-h-2p80-filler-harden-r-plus__H2P80_web_2.png')),
  match='Potvrđeno — natpis „FILLER HARDEN-R PLUS · eSense Fill-R hardener · H 2P80”; zapremina na slici se ne vidi',rights='NE — rmpaint.com (nije Surventis portal); potrebna potvrda BASF/Surventis ili isti fajl sa portala',need='Potvrda prava ili preuzimanje istog fajla sa Surventis portala')
json.dump(F,open('nalazi.json','w'),ensure_ascii=False,indent=1)
print(len(F))
