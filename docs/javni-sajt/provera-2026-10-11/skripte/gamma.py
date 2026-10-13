import sys, json
sys.path.append("/Users/miledulic/Library/Python/3.9/lib/python/site-packages")
import numpy as np
from PIL import Image
REPO = "/Users/miledulic/Carsystem/radno/javni-sajt-ispravke"
for it in json.load(open(sys.argv[1])):
    r = np.asarray(Image.open(REPO + "/public" + it["runtime"]).convert("RGBA")).astype(np.float64)
    a = np.asarray(Image.open(f"out/{it['slug']}.webp").convert("RGBA")).astype(np.float64)
    m = (r[..., 3] >= 250) & (a[..., 3] >= 250)
    x = a[..., :3][m] / 255.0; y = r[..., :3][m] / 255.0
    ok = (x > 0.08) & (x < 0.95) & (y > 0.01)
    k = float(np.median(np.log(y[ok]) / np.log(x[ok]))) if ok.any() else float("nan")
    fmt = Image.open(it["originalFile"]).format
    print(f'{it["id"]} {fmt:4} eksponent sada≈original^{k:.2f}')
