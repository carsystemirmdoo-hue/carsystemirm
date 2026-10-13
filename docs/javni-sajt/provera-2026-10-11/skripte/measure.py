import sys, json, hashlib
sys.path.append("/Users/miledulic/Library/Python/3.9/lib/python/site-packages")
import numpy as np
from PIL import Image
REPO = "/Users/miledulic/Carsystem/radno/javni-sajt-ispravke"
items = json.load(open(sys.argv[1]))
man = {m["processedUrl"]: m["sha256"] for m in json.load(open(REPO + "/data/carsystem-sync/image-manifest.generated.json"))["images"]}

def stats(path):
    im = Image.open(path); im.load()
    rgba = np.asarray(im.convert("RGBA")).astype(np.float32)
    a = rgba[..., 3]; rgb = rgba[..., :3]
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    solid = a >= 250
    semi = (a > 8) & (a < 250)
    obj = a > 8
    return {
        "size": im.size, "mode": im.mode,
        "alpha": bool((a < 255).any()),
        "semiShare": round(float(semi.sum()) / max(1, float(obj.sum())), 3),
        "black0": round(float(((lum <= 3) & solid).sum()) / max(1, float(solid.sum())), 3),
        "white255": round(float(((lum >= 252) & solid).sum()) / max(1, float(solid.sum())), 3),
        "objShare": round(float(obj.mean()), 3),
    }

out = []
for it in items:
    r = {"id": it["id"], "slug": it["slug"]}
    r["runtime"] = stats(REPO + "/public" + it["runtime"])
    r["processed"] = stats(it["processedFile"])
    r["original"] = stats(it["originalFile"])
    r["processedUnchanged"] = man.get(it["processedUrl"]) == hashlib.sha256(open(it["processedFile"], "rb").read()).hexdigest()
    out.append(r)
    print(f'{it["id"]} {it["slug"][10:42]:32} rt{r["runtime"]["size"]} semi{r["runtime"]["semiShare"]} blk{r["runtime"]["black0"]} wht{r["runtime"]["white255"]} | orig{r["original"]["size"]} {r["original"]["mode"]} semi{r["original"]["semiShare"]} blk{r["original"]["black0"]} wht{r["original"]["white255"]} | srcSame={r["processedUnchanged"]}')
json.dump(out, open(sys.argv[2], "w"), indent=1)
