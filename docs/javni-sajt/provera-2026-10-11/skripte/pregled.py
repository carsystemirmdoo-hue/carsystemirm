import json, html, os
from PIL import Image, ImageDraw, ImageFont
R='/Users/miledulic/Carsystem/radno/slike-za-pronalazenje/'
N=json.load(open('nalazi.json')); S=json.load(open('slike.json')); nm={x['slug']:x for x in S}
m={x['slug']:x for x in json.load(open(R+'preuzeto/sata/_manifest.json'))}
cos8=['cosmos-lac-acrylic-varnish-376-gloss','cosmos-lac-acrylic-varnish-377-matt','cosmos-lac-acrylic-varnish-378-satin','cosmos-lac-chrome-effect-450-container','cosmos-lac-gold-effect-451-container','cosmos-lac-high-heat-350-silver-container','cosmos-lac-high-heat-351-black-container','cosmos-lac-high-heat-353-maroon-container']
sata7=[s for s,x in m.items() if x.get('siblingArticleShown')]
fo=['cosmos-lac-flame-orange-fo-314-piglet-pink-dark']
SITE='https://carsystemirm.com'
def pack(x): return ', '.join([p for p in x['packages'] if p!='Na upit']) or (x['volume'] or '—')
def code(x):
    if x['brand']=='sata': return 'art. '+m[x['slug']]['article']
    for s in x['specs']:
        if 'šifra' in s.lower(): return s.split(': ',1)[1]
    return x['manufacturerCode'] or '—'
def imgs(s):
    x=nm[s]; out=[]
    if x['brand']=='sata': out.append(('sata.com — slika artikla '+m[s]['siblingArticleShown']+' (srodni)', 'preuzeto/sata/'+m[s]['file']))
    else:
        f=N[s]['file']; out.append(('Brand Kit', f))
        site=N[s]['url'].rsplit('/',1)[-1]
        if os.path.exists(R+'preuzeto/cosmos-lac/sajt/'+site): out.append(('cosmoslac.com', 'preuzeto/cosmos-lac/sajt/'+site))
    return out
def warn(s):
    if s in ('cosmos-lac-chrome-effect-450-container','cosmos-lac-gold-effect-451-container'):
        return 'NESLAGANJE PAKOVANJA: slika sa cosmoslac.com nosi natpis „185 ML”, naš katalog navodi 175 ml. Podatak kataloga NIJE menjan — potrebna potvrda.'
    return ''
groups=[('8 Cosmos Lac proizvoda — zajednička slika za više varijanti',cos8),('7 SATA artikala — dostupna samo slika srodnog artikla',sata7),('FO-314 — podudaranje nije dokazano',fo)]
H=['<!doctype html><html lang="sr-Latn"><head><meta charset="utf-8"><title>Pregled spornih slika</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#111;background:#fafafa}h1{font-size:22px}h2{margin-top:36px;font-size:18px;border-bottom:2px solid #ddd;padding-bottom:6px}.c{display:flex;gap:16px;background:#fff;border:1px solid #ddd;border-radius:6px;padding:12px;margin:10px 0}.i{text-align:center;font-size:12px;color:#555}.i img{width:220px;height:220px;object-fit:contain;background:#eee;display:block;margin-bottom:4px}.t{flex:1;font-size:14px;line-height:1.45}.w{background:#fde7e7;border-left:4px solid #c00;padding:6px 8px;margin-top:6px;font-weight:600}.k{color:#666}</style></head><body>',
   '<h1>Pregled spornih slika — 2026-10-11</h1><p>Lokalni pregled za odluku. Slike čekaju potvrdu prava i NISU objavljene. Podaci kataloga nisu menjani.</p>']
for title,lst in groups:
    H.append(f'<h2>{html.escape(title)}</h2>')
    for s in lst:
        x=nm[s]; f=N[s]
        H.append('<div class="c">')
        for lab,p in imgs(s): H.append(f'<div class="i"><img src="{html.escape(p)}" alt="{html.escape(x["name"])}">{html.escape(lab)}</div>')
        H.append(f'<div class="t"><b>{html.escape(x["name"])}</b><br><span class="k">Šifra:</span> {html.escape(code(x))} · <span class="k">Pakovanje u katalogu:</span> {html.escape(pack(x))}<br><span class="k">Podudaranje:</span> {html.escape(f["match"])}<br><span class="k">Pravo:</span> {html.escape(f["rights"])}<br><span class="k">Izvor:</span> <a href="{html.escape(f["url"])}">{html.escape(f["url"])}</a> · <a href="{SITE+x["href"]}">naša stranica</a>')
        if warn(s): H.append(f'<div class="w">{html.escape(warn(s))}</div>')
        H.append('</div></div>')
H.append('</body></html>')
open(R+'PREGLED_SPORNIH_SLIKA.html','w').write('\n'.join(H))
# zbirni JPG
cards=[(s,t) for t,l in groups for s in l]
W=4; cw,ch=480,330
img=Image.new('RGB',(W*cw,((len(cards)+W-1)//W)*ch),'white'); d=ImageDraw.Draw(img)
try: F=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',14); FB=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',14)
except: F=FB=None
for i,(s,t) in enumerate(cards):
    x0=(i%W)*cw; y0=(i//W)*ch; ims=imgs(s)
    for j,(lab,p) in enumerate(ims[:2]):
        im=Image.open(R+p).convert('RGBA'); im.thumbnail((220,220)); bg=Image.new('RGBA',(220,220),(235,235,235,255)); bg.alpha_composite(im,((220-im.width)//2,(220-im.height)//2)); img.paste(bg.convert('RGB'),(x0+10+j*230,y0+10)); d.text((x0+12+j*230,y0+232),lab[:34],fill=(90,90,90),font=F)
    x=nm[s]; d.text((x0+10,y0+252),x['name'][:52],fill=(0,0,0),font=FB); d.text((x0+10,y0+272),f"Šifra: {code(x)} · Pak.: {pack(x)}"[:60],fill=(0,0,0),font=F)
    if warn(s): d.text((x0+10,y0+292),'175 ml u katalogu ≠ 185 ML na slici sa sajta',fill=(200,0,0),font=FB)
    elif s in fo: d.text((x0+10,y0+292),'Podudaranje nije dokazano — čeka potvrdu',fill=(200,0,0),font=FB)
    d.rectangle((x0,y0,x0+cw-1,y0+ch-1),outline=(210,210,210))
img.save(R+'PREGLED_SPORNIH_SLIKA.jpg',quality=82); print(len(cards))
