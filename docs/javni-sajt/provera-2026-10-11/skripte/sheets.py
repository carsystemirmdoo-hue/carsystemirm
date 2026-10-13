from PIL import Image
import os,json,glob,math
Image.MAX_IMAGE_PIXELS=None
os.makedirs('sheets',exist_ok=True)
t=json.load(open('templates.json'))
def load(name,combo):
    for ext in ('jpg','png'):
        f=f'shots/{name}__{combo}.{ext}'
        if os.path.exists(f): return Image.open(f).convert('RGB')
def columns(im,scale,colh):
    w=int(im.width*scale);h=int(im.height*scale);im=im.resize((w,h))
    n=max(1,math.ceil(h/colh));out=Image.new('RGB',(n*(w+8),min(h,colh)),'white')
    for i in range(n):
        out.paste(im.crop((0,i*colh,w,min(h,(i+1)*colh))),(i*(w+8),0))
    return out
for name,u in t:
    for mode,scale,colh in (('desktop',0.22,1700),('mobile',0.42,1700)):
        parts=[columns(load(name,f'{mode}-{s}'),scale,colh) for s in ('light','dark') if load(name,f'{mode}-{s}')]
        W=sum(p.width for p in parts)+20*(len(parts)-1);H=max(p.height for p in parts)
        sh=Image.new('RGB',(W,H),(255,0,255));x=0
        for p in parts: sh.paste(p,(x,0));x+=p.width+20
        if W>3000: sh=sh.resize((3000,int(H*3000/W)))
        sh.save(f'sheets/{name}__{mode}.jpg',quality=70)
print(len(glob.glob('sheets/*')))
