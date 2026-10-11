import json, csv, re, sys, os
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter
REPO="/Users/miledulic/Carsystem/radno/javni-sajt-ispravke"
OUT=sys.argv[1]
rows=json.load(open('slike.json'))
unres={}
for r in csv.DictReader(open(f"{REPO}/docs/catalog/image-gaps-2026-10/UNRESOLVED_IMAGES.csv")):
    slug=r['image_id'].split('__',1)[-1] if r['image_id'] else ''
    unres[slug]=r
sata={r['slug']:r for r in csv.DictReader(open(f"{REPO}/docs/catalog/image-gaps-2026-10/sata-current-official-urls.csv"))}
BR={"rm":"R-M","baslac":"baslac","norbin":"Norbin","cosmos-lac":"Cosmos Lac","sata":"SATA","rupes":"RUPES"}
ORDER={"rm":0,"baslac":1,"norbin":2,"cosmos-lac":3,"sata":4,"rupes":5}
SITE="https://carsystemirm.com"
INTERNAL=re.compile(r'^(RM-|NORBIN-|CL-|SATA-)')
def code_of(x):
    code,note=_code_of(x)
    if code and not re.search(r'\d', code):
        return "", "sistem bez šifre proizvođača"
    if code and x['brand']=='rupes' and re.fullmatch(r'\d{3}\.\d{3}', code):
        return "", f"Carsystem broj artikla {code}; RUPES šifra nije potvrđena"
    return code,note
def _code_of(x):
    if x['brand']=='sata' and x['slug'] in sata and sata[x['slug']]['main_article']:
        return sata[x['slug']]['main_article'], "SATA broj artikla (sa sata.com)"
    if x['manufacturerCode']: return x['manufacturerCode'], ""
    for s in x['specs']:
        lab,val=s.split(': ',1)
        if val and not INTERNAL.match(val): return val, ""
    if x['publicCode'] and not INTERNAL.match(x['publicCode']): return x['publicCode'], ""
    if x['externalSku'] and not INTERNAL.match(x['externalSku']): return x['externalSku'], ""
    return "", "šifra proizvođača nije potvrđena"
def pack_of(x):
    parts=[]
    if x['variantOptions']: parts+= [v for v in x['variantOptions'].values() if v and not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)+', v)]
    p=[l for l in x['packages'] if l and l!='Na upit']
    parts+=[l for l in p if l not in parts]
    if x['volume'] and x['volume'] not in parts: parts.append(x['volume'])
    return ", ".join(parts)
def strip_brand(name,b):
    return re.sub(r'^(R-M|baslac|Baslac|Norbin|Cosmos Lac|SATA|RUPES)\s+','',name)
def query_of(x,code):
    b=BR[x['brand']]; n=strip_brand(x['name'],b)
    if x['brand']=='sata': return f'SATA {code} {n}'.strip()
    q=f'{b} {code} {n}' if code and code not in n else f'{b} {n}'
    return re.sub(r'\s+',' ',q).strip()+' packshot'
def source_of(x):
    if x['brand']=='sata' and x['slug'] in sata:
        s=sata[x['slug']]; return f"Stranica artikla: {s['product_page_url']} · zvanična slika: {s['current_image_url']}"
    u=unres.get(x['slug'])
    return (u['checked_sources'] if u else '')
def note_of(x):
    u=unres.get(x['slug'])
    base=u['reason'] if u else ''
    if x['brand']=='sata':
        if u and 'PLACEHOLDER_ACCEPTED' in (u['state']+u['reason']+u.get('group','')): base='Placeholder ranije prihvaćen (pribor). '+base
        pass
    if x['brand']=='cosmos-lac':
        if x['slug']!='cosmos-lac-easy-max-glitter-912-multi':
            base='ISPRAVKA 2026-10-11: ranija napomena „nema je u Brand Kit-u” nije tačna — fajl postoji u lokalnom Brand Kit-u (tmp/cosmos-lac-assets, grupa „uncertain” jer je isti fajl za više varijanti). Raniji tekst: '+base
        elif 'cosmoslac' not in base:
            base='Slika postoji samo na cosmoslac.com (nije u Brand Kit-u); upotreba traži pisanu dozvolu. '+base
    return re.sub(r'\s+',' ',base).strip() or 'Nema fotografije proizvoda na sajtu (prikazuje se „Vizuel u pripremi”).'

def local_of(x):
    if x['slug']=='baslac-30-s510-s-serija':
        return "public/products/baslac/baslac-30-s510-s-serija.webp postoji, ali prikazuje drugi proizvod (35-M1020) — ne koristi se"
    return "Nema (pretraženi public/, review-assets/, assets/, tmp/, _incoming/)"
def need_of(x):
    if x['brand']=='sata':
        reason=(unres.get(x['slug']) or {}).get('reason','')
        if reason.startswith('Vlasnik je ranije prihvatio placeholder'):
            return "Ništa obavezno — placeholder je ranije prihvaćen; slika samo uz saglasnost SATA"
        if reason.startswith('Ranije utvrđeno: SATA ne objavljuje sliku'):
            return "Vaša fotografija (SATA ne objavljuje sliku ovog artikla)"
        return "Potvrda prava: pisana saglasnost SATA (slika postoji na sata.com)"
    if x['brand']=='cosmos-lac': return "Potvrda prava: pisana dozvola Cosmos Lac ili dopuna Brand Kit-a"
    if x['slug']=='baslac-30-s510-s-serija': return "Potvrda identiteta (Line 30 Topcoat ili 30 CV), pa Vaša fotografija ambalaže"
    if x['slug']=='rm-diamont-bezbojni-lak': return "Potvrda koji je to DIAMONT lak (šifra), pa Vaša fotografija ambalaže"
    return "Vaša fotografija ambalaže (proizvođač ne objavljuje sliku ove šifre)"
missing=[x for x in rows if 'placeholder' in (x['image'] or '') and not (x['brand']=='baslac' and x['redirect'])]
pending=[x for x in rows if 'pending-rights' in (x['image'] or '') or (x['brand']=='rupes' and 'placeholder' not in (x['image'] or ''))]
missing.sort(key=lambda x:(ORDER[x['brand']],x['name'].lower()))
pending.sort(key=lambda x:(ORDER[x['brand']],x['name'].lower()))
assert len(missing)==189, len(missing)
assert not set(x['slug'] for x in missing)&set(x['slug'] for x in pending), "preklapanje"

wb=Workbook()
HDR=Font(bold=True,color="FFFFFF"); FILL=PatternFill("solid",fgColor="1F2937"); EMPTY=PatternFill("solid",fgColor="FFF7D6")
def sheet(ws, headers, data, widths, empty_cols):
    ws.append(headers)
    for c in ws[1]: c.font=HDR; c.fill=FILL; c.alignment=Alignment(wrap_text=True,vertical="top")
    for row in data: ws.append(row)
    for i,w in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width=w
    link_col=headers.index("Link naše stranice")+1
    for r in range(2, ws.max_row+1):
        for c in range(1,len(headers)+1):
            cell=ws.cell(r,c); cell.alignment=Alignment(wrap_text=True,vertical="top")
            if headers[c-1] in empty_cols: cell.fill=EMPTY
        lc=ws.cell(r,link_col)
        if lc.value: lc.hyperlink=lc.value; lc.font=Font(color="0563C1",underline="single")
    ws.freeze_panes="C2"; ws.auto_filter.ref=ws.dimensions
EMPTYC=["Pronađeni link","Naziv preuzetog fajla","Status"]
NAL=json.load(open('nalazi.json'))
NF={'rm':'Ne — pretraženo: Surventis Brand Portal R-M hub 51 (2026-10-06), info.rmpaint.com, rmpaint.com (sitemap, 303 stranice proizvoda, 2026-10-11)',
    'baslac':'Ne — pretraženo: Surventis Brand Portal baslac hub 54 (441 asset, 2026-10-06), baslac.com (stranica dodataka navodi šifru bez slike, 2026-10-11)',
    'norbin':'Ne — norbin-paint.com ne objavljuje slike; distributer Väritikka: N95-060 samo logo, ostale šifre ne postoje (2026-10-11)'}
def row_status(x):
    f=NAL.get(x['slug'])
    if f: return f
    found=NF.get(x['brand'],'Ne')
    if x['slug']=='rm-ra-040-agilis-mix': found+='; rmpaint.com „AGILIS MIX” prikazuje RA 050, ne RA 040 — odbačeno'
    if x['slug'] in ('rm-diamont-bezbojni-lak','baslac-30-s510-s-serija'):
        return dict(found=found,url='',page='',file='',sha='',match='ČEKA POTVRDU IDENTITETA',rights='—',need=need_of(x))
    return dict(found=found,url='',page='',file='',sha='',match='—',rights='—',need=None)
def final_need(x,f):
    if f.get('need'): return f['need']
    return need_of(x)
def status_of(x,f):
    if f['match'].startswith('ČEKA'): return 'čeka potvrdu identiteta'
    if not f['file']:
        n=final_need(x,f)
        return 'nije pronađeno — '+('placeholder prihvaćen' if n.startswith('Ništa') else 'potrebna Vaša fotografija')
    if f['rights'].startswith('NE'): return 'pronađeno — čeka pravo'+('' if f['match'].startswith('Potvrđeno') else ' i potvrdu varijante')
    if f['match'].startswith('Potvrđeno'): return 'pronađeno — spremno za uvoz (pravo: Brand Kit)'
    return 'pronađeno — čeka Vašu odluku o zajedničkoj slici'
ws=wb.active; ws.title="Nedostaje fotografija"
H=["#","Brend","Tačan naziv","Šifra proizvođača","Varijanta / pakovanje","Link naše stranice","1. Fotografija pronađena i preuzeta","2. Podudaranje proizvod / varijanta / pakovanje","3. Pravo objavljivanja","Izvorni URL slike","Stranica izvora","Lokalni fajl (za pregled, NIJE objavljen)","SHA-256","Potrebno od Vas","Predloženi upit za pretragu","Napomena iz izveštaja"]+EMPTYC
data=[]
for i,x in enumerate(missing,1):
    code,cnote=code_of(x)
    note=note_of(x)+(f" ({cnote})" if cnote else "")
    f=row_status(x)
    st=status_of(x,f)
    data.append([i,BR[x['brand']],x['name'],code,pack_of(x),SITE+x['href'],f['found'],f['match'],f['rights'],f['url'],f['page'],
                 ('~/Carsystem/radno/slike-za-pronalazenje/'+f['file']) if f['file'] else '',f['sha'][:16],final_need(x,f),query_of(x,code),note,
                 f['url'] or '', os.path.basename(f['file']) if f['file'] else '', st])
sheet(ws,H,data,[5,10,40,16,18,38,40,48,40,40,34,46,18,36,34,50,34,30,30],EMPTYC)
STATUS=[r[-1] for r in data]

ws2=wb.create_sheet("Čeka potvrdu prava")
H2=["#","Brend","Tačan naziv","Šifra proizvođača","Varijanta / pakovanje","Link naše stranice","Slika koju već imamo (fajl u repou)","Poreklo slike","Šta treba potvrditi","Gde se danas prikazuje"]+["Odluka (da/ne)","Status"]
data2=[]
for i,x in enumerate(pending,1):
    code,cnote=code_of(x)
    if x['brand']=='norbin':
        f="review-assets/pending-rights/norbin/"+x['image'].rsplit('/',1)[-1]
        src="Render proizvođača sa sajta distributera Väritikka"
        what="Pravo da render objavimo na sajtu (rightsBasis OWNER_CONFIRMATION_REQUIRED)"
        where="Lokalno i na Preview-u da; na Production-u NE (prikazuje se „Vizuel u pripremi”)"
    else:
        f="public"+x['image']; src="carsystem.org (Carsystem katalog), proizvod pod RUPES brendom"
        what="Pravo prikaza RUPES proizvoda slikom sa carsystem.org (RUPES_IMAGE_RIGHTS_REVIEW)"
        where="Prikazuje se svuda (i na Production-u)"
    data2.append([i,BR[x['brand']],x['name'],code,pack_of(x),SITE+x['href'],f,src+(f" — {cnote}" if cnote else ""),what,where,"",""])
sheet(ws2,H2,data2,[5,10,42,18,22,40,48,40,48,36,14,14],["Odluka (da/ne)","Status"])

# --- ambalaža po zapremini (baslac sistemske strane) ---
ws4=wb.create_sheet("baslac ambalaža po zapremini")
H4=["#","Sistem","Pakovanje","Baza (varijanti)","Šta nedostaje","Postojeći materijal","1. Pronađeno","2. Podudaranje","3. Pravo","Potrebno od Vas","Status"]
slots=[("Line 30","1 L",17,"Ima: 30-S110 (1 L) — sopstveni packshot te baze na Surventis portalu (asset 12114); generička 1 L limenka sistema ne postoji"),
       ("Line 35","1 L",17,"Portal nema generičku 1 L limenku"),("Line 35","0,5 L",32,"Portal nema generičku 0,5 L limenku"),
       ("Line 45","5 L",2,"Portal nema generičku 5 L limenku"),("Line 45","1 L",7,"Primer limenke linije 1 L (prikazuje se uz napomenu)"),
       ("Line 45","0,5 L",49,"Portal nema generičku 0,5 L limenku"),("Line 45","0,1 L",12,"Portal nema generičku 0,1 L limenku")]
d4=[]
for i,(sy,pk,n,mat) in enumerate(slots,1):
    d4.append([i,sy,pk,n,f"Fotografija PRAZNE/generičke limenke {sy} {pk} — ne fotografija pojedinačne baze (baze se razlikuju šifrom i nijansom, ne limenkom)",mat,"Ne","—","—",f"Jedna Vaša fotografija limenke {sy} {pk} pokriva svih {n} baza","nije pronađeno — potrebna Vaša fotografija (1 snimak)"])
ws4.append(H4)
for c in ws4[1]: c.font=HDR; c.fill=FILL; c.alignment=Alignment(wrap_text=True,vertical="top")
for r in d4: ws4.append(r)
for i,w in enumerate([5,10,10,14,60,50,10,10,10,40,36],1): ws4.column_dimensions[get_column_letter(i)].width=w
for row in ws4.iter_rows(min_row=2):
    for c in row: c.alignment=Alignment(wrap_text=True,vertical="top")
ws4.freeze_panes="B2"

# --- pregled ---
import collections
ws3=wb.create_sheet("Pregled",0)
cnt=collections.Counter(STATUS)
byb=collections.defaultdict(collections.Counter)
for x,st in zip(missing,STATUS): byb[BR[x['brand']]][st]+=1
lines=[["Pregled pretrage fotografija — 2026-10-11"],[""],
 ["Glavni spisak","189 proizvoda bez fotografije (list „Nedostaje fotografija”) + 7 slotova ambalaže baslac sistema (poseban list) + 31 slika koja čeka prava (list „Čeka potvrdu prava”). Ovo je JEDINI glavni spisak; zamenjuje radni fajl ~/Carsystem/radno/slike-za-pronalazenje/SLIKE_ZA_PRONALAZENJE.xlsx (255 redova) iz druge sesije."],
 ["66 baslac redova iz druge sesije","To su baze sa sistemskih strana Line 30 (17 × 1 L) i Line 35 (17 × 1 L + 32 × 0,5 L). Nisu posebni proizvodi bez slike: baze se kupcu prikazuju na sistemskoj strani, a nedostaje jedna fotografija generičke limenke po pakovanju. Isti nalaz je već evidentiran kao 3 slota ambalaže (OLD-043…045). Zato su u glavnom spisku 3 reda (plus 4 za Line 45), a ne 66 zadataka. Nisu ponovljeni nalazi među 189 — preklapanje je 0."],
 [""],["Stanje","Broj"]]+[[k,v] for k,v in sorted(cnt.items(),key=lambda t:-t[1])]+[[""],["Po brendu","Stanja"]]+[[b, "; ".join(f"{k}: {v}" for k,v in c.items())] for b,c in byb.items()]+[[""],
 ["Gde su fajlovi","~/Carsystem/radno/slike-za-pronalazenje/preuzeto/<brend>/ — van git-a, nije objavljeno. SATA _manifest.json ima URL, SHA-256 i stranicu artikla za svaki fajl."],
 ["Pravila","Podudaranje „Potvrđeno” samo kad slika nosi tačnu šifru/naziv ili je sopstvena glavna slika artikla na stranici proizvođača. Zajednička slika porodice je označena posebno. Šifre se ne izmišljaju."]]
for r in lines: ws3.append(r)
ws3.column_dimensions['A'].width=34; ws3.column_dimensions['B'].width=130
for row in ws3.iter_rows():
    for c in row: c.alignment=Alignment(wrap_text=True,vertical="top")
    row[0].font=Font(bold=True)
wb.save(OUT); print("ok",len(missing),len(pending)); print(cnt); print({b:dict(c) for b,c in byb.items()})
