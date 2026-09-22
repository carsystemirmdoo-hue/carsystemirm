"""READ ONLY: detektuje 1 px poluprovidan okvir uz ivicu platna (nalaz iz istorijskog Carsystem audita). Piše samo u .cache/."""
import json, os, sys
from PIL import Image
root = "public/products/carsystem/catalog"
out = {}
for name in sorted(os.listdir(root)):
    if not name.endswith(".webp"): continue
    im = Image.open(os.path.join(root, name)).convert("RGBA")
    w, h = im.size
    a = im.getchannel("A").load()
    ring = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(1, h - 1) for x in (0, w - 1)]
    inner = [(x, y) for x in range(3, w - 3) for y in (3, h - 4)] + [(x, y) for y in range(4, h - 4) for x in (3, w - 4)]
    semi = lambda pts: sum(1 for (x, y) in pts if 0 < a[x, y] < 255) / max(1, len(pts))
    r, i = semi(ring), semi(inner)
    if r >= 0.6 and i < 0.2:
        out["/products/carsystem/catalog/" + name] = {"edgeSemiTransparentShare": round(r, 3), "innerShare": round(i, 3)}
json.dump(out, open(".cache/final-image-audit/edge-frame.generated.json", "w"), indent=1, sort_keys=True)
print(len(out), "assets with a 1 px semi-transparent canvas frame")
for k in out: print("  ", k)
