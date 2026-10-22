#!/usr/bin/env python3
"""Traži zajednička pravila koja su ranije pobeđivala pravilo rasporeda za tačno jedan
stepen specifičnosti, a posle udvostručenja klase (bump-responsive) su izjednačena (2026-10-22).

    python3 scripts/css/flip-check.py <zajednički.module.css> <raspored.module.css> …
"""
import re, sys
from importlib.machinery import SourceFileLoader
split = SourceFileLoader("split", __file__.rsplit("/", 1)[0] + "/split-responsive.py").load_module()

def spec(sel: str):
    s = re.sub(r":global\(([^)]*)\)", r"\1", sel)
    s = re.sub(r"::?[a-z-]+\(", "(", s)  # funkcionalne pseudo-klase tretiraj kao 1
    ids = len(re.findall(r"#[\w-]+", s))
    cls = len(re.findall(r"\.[\w-]+|\[[^\]]*\]|:(?!:)[a-z-]+", s))
    els = len(re.findall(r"(?:^|[\s>+~(])([a-z][a-z0-9]*)", s))
    return (ids, cls, els)

def rules(css, media=""):
    for _, prelude, body in split.parse(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            yield from rules(body, prelude)
        elif not prelude.startswith("@"):
            props = {d.split(":", 1)[0].strip() for d in body.split(";") if ":" in d}
            for sel in prelude.split(","):
                yield sel.strip(), props, media

def target(sel):
    plain = re.sub(r":global\(([^)]*)\)", r"\1", sel.strip())
    last = re.split(r"[\s>+~]+", plain)[-1]
    classes = re.findall(r"\.([\w-]+)", plain)
    # Isti element: ista poslednja klasa u selektoru i isti tip poslednjeg dela.
    return (classes[-1] if classes else None, re.sub(r"[.\[:].*$", "", last))

fix = "--fix" in sys.argv
args = [a for a in sys.argv[1:] if a != "--fix"]
base_path = args[0]
base = list(rules(open(base_path).read()))
flagged = set()
for path in args[1:]:
    for sel, props, media in rules(open(path).read()):
        orig = re.sub(r"\.([\w-]+)\.\1", r".\1", sel, count=1)
        o = spec(orig)
        for bsel, bprops, bmedia in base:
            if target(bsel) != target(orig) or not (props & bprops): continue
            b = spec(bsel)
            if b == (o[0], o[1] + 1, o[2]) or (b[0] == o[0] and b[1] == o[1] + 1 and b[2] >= o[2] and b <= spec(sel)):
                print(f"{path.rsplit('/',1)[-1]} {media} {orig!r} {o} vs zajednički {bmedia or ''} {bsel!r} {b}: {', '.join(sorted(props & bprops))}")
                flagged.add(bsel)

if fix and flagged:
    # Zajedničko pravilo koje je bilo jače ostaje jače: i njemu se udvostručuje prva klasa.
    css = open(base_path).read()
    def bump_one(sel):
        m = re.search(r"\.([A-Za-z_][\w-]*)", re.sub(r":global\([^)]*\)", lambda g: " " * len(g.group(0)), sel))
        return sel[: m.end()] + "." + m.group(1) + sel[m.end():] if m else sel
    for sel in sorted(flagged, key=len, reverse=True):
        pattern = re.compile(r"(^|[,{}]\s*|\*/\s*)" + re.escape(sel) + r"(?=\s*[,{])", re.M)
        css, n = pattern.subn(lambda mm: mm.group(1) + bump_one(sel), css)
        print(f"pojačano u zajedničkom ({n}×): {sel}")
    open(base_path, "w").write(css)
