import sys, json, io, hashlib
sys.path.append("/Users/miledulic/Library/Python/3.9/lib/python/site-packages")
import numpy as np
from PIL import Image, ImageCms, ImageDraw
REPO = "/Users/miledulic/Carsystem/radno/javni-sajt-ispravke"
SRGB = ImageCms.createProfile("sRGB")

def to_srgb_rgba(im):
    im.load()
    rgba = im.convert("RGBA")
    icc = im.info.get("icc_profile")
    if icc:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        desc = ImageCms.getProfileDescription(src).strip()
        if "sRGB" not in desc:
            rgb = rgba.convert("RGB")
            rgb = ImageCms.profileToProfile(rgb, src, SRGB, renderingIntent=0, outputMode="RGB")
            rgba = Image.merge("RGBA", (*rgb.split(), rgba.getchannel("A")))
    return rgba

def reexport(original_path, size):
    rgba = to_srgb_rgba(Image.open(original_path))
    # premultiplied resize: bez svetlog/tamnog ruba na ivici alfe
    out = rgba.convert("RGBa").resize(size, Image.LANCZOS, reducing_gap=3.0).convert("RGBA")
    buf = io.BytesIO(); out.save(buf, "WEBP", lossless=True, method=6, exact=True)
    return buf.getvalue(), out

def lab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def metrics(before, after):
    b = np.asarray(before.convert("RGBA")).astype(np.float32); a = np.asarray(after).astype(np.float32)
    mb, ma = b[..., 3] > 128, a[..., 3] > 128
    iou = float((mb & ma).sum() / max(1, (mb | ma).sum()))
    solid = (b[..., 3] >= 250) & (a[..., 3] >= 250)
    lb, la = lab(b[..., :3]), lab(a[..., :3])
    lumb = 0.2126 * b[..., 0] + 0.7152 * b[..., 1] + 0.0722 * b[..., 2]
    unclipped = solid & (lumb > 6) & (lumb < 249)
    de = np.sqrt(((lb - la) ** 2).sum(-1))
    lum = lambda x: 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]
    semi = lambda x: float((((x[..., 3] > 8) & (x[..., 3] < 250)).sum()) / max(1, (x[..., 3] > 8).sum()))
    return {
        "iou": round(iou, 4),
        "dEmedian": round(float(np.median(de[unclipped])) if unclipped.any() else 0, 2),
        "dE95": round(float(np.percentile(de[unclipped], 95)) if unclipped.any() else 0, 2),
        "black0": [round(float(((lum(b) <= 3) & solid).sum() / max(1, solid.sum())), 3), round(float(((lum(a) <= 3) & solid).sum() / max(1, solid.sum())), 3)],
        "white": [round(float(((lum(b) >= 252) & solid).sum() / max(1, solid.sum())), 3), round(float(((lum(a) >= 252) & solid).sum() / max(1, solid.sum())), 3)],
        "semi": [round(semi(b), 3), round(semi(a), 3)],
    }

def cell(img, bg, w, h):
    t = img.copy(); t.thumbnail((w - 10, h - 10), Image.LANCZOS)
    c = Image.new("RGBA", (w, h), bg + (255,)); c.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2)); return c.convert("RGB")

def sheet(before, after, title, path):
    W, H = 300, 300
    bgs = [(12, 13, 16), (128, 128, 128), (246, 246, 247)]
    sh = Image.new("RGB", (W * 4 + 30, H * 2 + 40), (40, 40, 40))
    for row, im in enumerate((before.convert("RGBA"), after)):
        for col, bg in enumerate(bgs):
            sh.paste(cell(im, bg, W, H), (col * (W + 6), row * (H + 6)))
        w, h = im.size  # 2x isečak iz sredine (etiketa) na tamnoj podlozi
        crop = im.crop((w // 4, h // 4, w // 4 + W // 2, h // 4 + H // 2)).resize((W, H), Image.NEAREST)
        z = Image.new("RGBA", (W, H), bgs[0] + (255,)); z.alpha_composite(crop)
        sh.paste(z.convert("RGB"), (3 * (W + 6) + 12, row * (H + 6)))
    ImageDraw.Draw(sh).text((6, H * 2 + 18), title + "   (gore: sada · dole: iz originala; tamna / siva / svetla / 2x isečak)", fill=(235, 235, 235))
    sh.save(path)

if __name__ == "__main__":
    items = json.load(open(sys.argv[1])); outdir = sys.argv[2]
    res = []
    for it in items:
        before = Image.open(REPO + "/public" + it["runtime"]); before.load()
        data, after = reexport(it["originalFile"], before.size)
        open(f"{outdir}/{it['slug']}.webp", "wb").write(data)
        m = metrics(before, after); m.update({"id": it["id"], "slug": it["slug"], "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
        res.append(m)
        sheet(before, after, f"{it['id']} {it['slug']}  IoU {m['iou']}  ΔE med {m['dEmedian']} p95 {m['dE95']}  crno {m['black0']}  belo {m['white']}  rub {m['semi']}", f"{outdir}/{it['id']}-{it['slug']}.png")
        print(it["id"], it["slug"][10:36].ljust(26), m)
    json.dump(res, open(f"{outdir}/_metrics.json", "w"), indent=1)
