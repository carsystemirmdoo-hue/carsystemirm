#!/usr/bin/env python3
"""Upoređuje „ko pobeđuje“ pre i posle podele CSS-a (2026-10-22).

Za svaki par (pravilo rasporeda, zajedničko pravilo) na istom elementu i svojstvu računa
pobednika u ORIGINALNOM fajlu (specifičnost, pa redosled) i POSLE podele (specifičnost; kod
jednakosti redosled delova nije garantovan → „nesigurno“). Prijavljuje svaki par gde se
pobednik promenio ili je postao nesiguran.

    python3 scripts/css/winner-check.py <original.css> <zajednički.module.css> <raspored.module.css> …
"""
import re, sys
from importlib.machinery import SourceFileLoader
split = SourceFileLoader("split", __file__.rsplit("/", 1)[0] + "/split-responsive.py").load_module()
fc_src = open(__file__.rsplit("/", 1)[0] + "/flip-check.py").read().split('fix = "--fix"')[0]
ns = {"__file__": __file__.rsplit("/", 1)[0] + "/flip-check.py"}; exec(fc_src, ns)
spec, target = ns["spec"], ns["target"]

def flat(css, media=""):
    out = []
    for _, prelude, body in split.parse(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            out += flat(body, prelude)
        elif not prelude.startswith("@"):
            props = {d.split(":", 1)[0].strip() for d in body.split(";") if ":" in d}
            for sel in prelude.split(","): out.append((sel.strip(), props, media))
    return out

norm = lambda s: re.sub(r"\.([\w-]+)(?:\.\1)+", r".\1", re.sub(r"\s+", " ", s))
FIX = "--fix" in sys.argv
sys.argv = [a for a in sys.argv if a != "--fix"]
orig = flat(open(sys.argv[1]).read())
pos = {}
for i, (s, p, m) in enumerate(orig): pos.setdefault((norm(s), m), i)
media_pos = {}
for i, (s, p, m) in enumerate(orig):
    if m: media_pos.setdefault(norm(s), []).append((m, i))
def media_key(m):
    return re.sub(r"\s+", "", m)
def bump(sel):
    m = re.search(r"\.([A-Za-z_][\w-]*)", re.sub(r":global\([^)]*\)", lambda g: " " * len(g.group(0)), sel))
    return sel[: m.end()] + "." + m.group(1) + sel[m.end():] if m else sel

def apply(path, sel):
    css = open(path).read()
    pattern = re.compile(r"(^|[,{}]\s*|\*/\s*)" + re.escape(sel) + r"(?=\s*[,{])", re.M)
    css, n = pattern.subn(lambda mm: mm.group(1) + bump(sel), css)
    open(path, "w").write(css)
    return n

base = [(s, p, m) for s, p, m in flat(open(sys.argv[2]).read())]
issues = 0
to_fix = []
for path in sys.argv[3:]:
    for s, props, media in flat(open(path).read()):
        cands = media_pos.get(norm(s), [])
        exact = [i for m, i in cands if media_key(m) == media_key(media)]
        pm = exact[0] if exact else (cands[0][1] if cands else None)
        if pm is None: continue
        o_m = spec(norm(s)); n_m = spec(s)
        for bs, bp, bmed in base:
            common = props & bp
            if not common or target(norm(bs)) != target(norm(s)) or bmed: continue
            pb = pos.get((norm(bs), ""))
            if pb is None: continue
            o_b = spec(norm(bs)); n_b = spec(bs)
            before = "raspored" if (o_m > o_b or (o_m == o_b and pm > pb)) else "zajednički"
            after = "raspored" if n_m > n_b else "zajednički" if n_b > n_m else "nesigurno"
            if before != after:
                issues += 1
                print(f"{path.rsplit('/',1)[-1]} {media}: {s!r} vs {bs!r} [{', '.join(sorted(common))}] — ranije: {before}, sada: {after}")
                to_fix.append((sys.argv[2], bs) if before == "zajednički" else (path, s))
print(f"{issues} promena")
if FIX and to_fix:
    done = set()
    for path, sel in to_fix:
        if (path, sel) in done: continue
        done.add((path, sel))
        print(f"  pojačano ({apply(path, sel)}×) u {path.rsplit('/',1)[-1]}: {sel}")
    sys.exit(3)
