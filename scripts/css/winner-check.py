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


def split_selectors(prelude):
    """Deli listu selektora samo po zarezima na najvišem nivou (ne unutar :is()/:where())."""
    out, depth, cur = [], 0, ""
    for ch in prelude:
        if ch in "([": depth += 1
        elif ch in ")]": depth -= 1
        if ch == "," and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    out.append(cur)
    return [s.strip() for s in out if s.strip()]

def flat(css, media=""):
    out = []
    for _, prelude, body in split.parse(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            out += flat(body, prelude)
        elif not prelude.startswith("@"):
            props = {d.split(":", 1)[0].strip() for d in body.split(";") if ":" in d}
            for sel in split_selectors(prelude): out.append((sel.strip(), props, media))
    return out

def rules_with_pos(css):
    """Pravila (media, prelude, početak tela, kraj tela) sa pozicijama; komentari se preskaču."""
    out, stack, i, start = [], [], 0, 0
    while i < len(css):
        if css.startswith("/*", i):
            i = css.index("*/", i) + 2; start = i; continue
        ch = css[i]
        if ch == "{":
            stack.append((css[start:i].strip(), i + 1)); start = i + 1
        elif ch == "}":
            prelude, body_start = stack.pop()
            if not prelude.startswith("@"):
                media = " ".join(p for p, _ in stack if p.startswith("@media") or p.startswith("@supports"))
                out.append((media, prelude, body_start, i))
            start = i + 1
        elif ch == ";" and not stack:
            start = i + 1
        i += 1
    return out

norm = lambda s: re.sub(r"\.([\w-]+)(?:\.\1)+", r".\1", re.sub(r"\s+", " ", s))
FIX = "--fix" in sys.argv
sys.argv = [a for a in sys.argv if a != "--fix"]
orig = flat(open(sys.argv[1]).read())
# Svako pojavljivanje selektora (po upitu) ima svoju poziciju: isti selektor se često ponavlja kasnije
# u fajlu (npr. tokenski blok na kraju), a to kasnije pravilo je ono koje je pobeđivalo.
# Podela samo vadi media blokove, pa k-to pojavljivanje u zajedničkom fajlu odgovara k-tom
# pojavljivanju van media u originalu.
pos = {}
for i, (s, p, m) in enumerate(orig):
    pos.setdefault((norm(s), re.sub(r"\s+", "", m)), []).append(i)
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

def granica(paths):
    """Granica podele: najmanji min-width desktop fajla − 1px (inače najveći max-width mobilnog)."""
    mins = [split.px(v) for p in paths if ".desktop." in p for v in re.findall(r"min-width:\s*([\d.]+(?:px|rem|em))", open(p).read())]
    if mins: return min(mins) - 1
    return max(split.px(v) for p in paths for v in re.findall(r"max-width:\s*([\d.]+(?:px|rem|em))", open(p).read()))
BP = granica(sys.argv[3:])

base, seen = [], {}
for s, p, m in flat(open(sys.argv[2]).read()):
    k = seen[(norm(s), m)] = seen.get((norm(s), m), -1) + 1
    occ = pos.get((norm(s), re.sub(r"\s+", "", m)), [])
    base.append((s, p, m, occ[k] if k < len(occ) else None))
issues = 0
unmatched = []
rules_of = {}
dead = {}  # (fajl, pravilo) → {svojstvo: {selektori}}
to_fix = []
for path in sys.argv[3:]:
    # Podela prepisuje upit (npr. `max-width: 70rem` → `(min-width: 1024px) and (max-width:
    # 1120px)`), ali čuva redosled media pravila. Zato se k-to pojavljivanje selektora u fajlu
    # rasporeda vezuje za k-to originalno pravilo istog selektora koje je palo u taj fajl.
    text = open(path).read()
    kind = 0 if ".mobile." in path else 1
    lane = {}
    for i, (os_, op, om) in enumerate(orig):
        if not om or not om.startswith("@media"): continue
        c = split.classify(om, BP)
        if c and c[kind]: lane.setdefault(norm(os_), []).append(i)
    seen_m = {}
    entries = []
    for rid, (media, prelude, b0, b1) in enumerate(rules_with_pos(text)):
        props = {d.split(":", 1)[0].strip() for d in text[b0:b1].split(";") if ":" in d}
        for sel in split_selectors(prelude): entries.append((rid, prelude, sel, props, media))
    rules_of[path] = rules_with_pos(text)
    for rid, prelude, s, props, media in entries:
        k = seen_m[norm(s)] = seen_m.get(norm(s), -1) + 1
        occ = lane.get(norm(s), [])
        pm = occ[k] if k < len(occ) else None
        if pm is None:
            unmatched.append(f"{path.rsplit('/',1)[-1]}: {s}")
            continue
        o_m = spec(norm(s)); n_m = spec(s)
        for bs, bp, bmed, pb in base:
            common = props & bp
            # Zajednička pravila u upitima koji nisu širina (smanjen pokret, hover, pointer)
            # važe istovremeno sa rasporedom, pa se i ona porede. Štampa se preskače.
            if not common or target(norm(bs)) != target(norm(s)) or "print" in bmed: continue
            if pb is None: continue
            # Ista lista selektora u rasporedu sadrži i baš taj zajednički selektor: element
            # dobija vrednost rasporeda preko njega, pa ovaj par ne odlučuje ishod.
            if norm(bs) != norm(s) and norm(bs) in {norm(x) for x in split_selectors(prelude)}: continue
            o_b = spec(norm(bs)); n_b = spec(bs)
            before = "raspored" if (o_m > o_b or (o_m == o_b and pm > pb)) else "zajednički"
            after = "raspored" if n_m > n_b else "zajednički" if n_b > n_m else "nesigurno"
            if before != after:
                issues += 1
                print(f"{path.rsplit('/',1)[-1]} {media}: {s!r} vs {bs!r} [{', '.join(sorted(common))}] — ranije: {before}, sada: {after}")
                if before == "raspored":
                    to_fix.append(("bump", path, s, None))
                elif bmed or norm(bs) != norm(s):
                    # Zajedničko pravilo pod uslovom (upit pokreta/hover-a, :first-child, roditelj)
                    # je pobeđivalo samo za deo elemenata: pojačava se baš ono, u svom upitu.
                    to_fix.append(("bump-media", sys.argv[2], bs, bmed))
                else:
                    # isti selektor bez uslova je pobeđivao: deklaracija u rasporedu je mrtva
                    for prop in common:
                        dead.setdefault((path, rid), {}).setdefault(prop, set()).add(s)
if unmatched:
    print(f"NEVEZANO sa originalom ({len(unmatched)}):", *unmatched[:20], sep="\n  ")
print(f"{issues} promena")
def remove_dead(path, items):
    """Uklanja mrtve deklaracije; pravilo sa listom selektora menja se samo ako su svi mrtvi."""
    css = open(path).read(); rules = rules_of[path]; manual = []
    for rid in sorted(items, reverse=True):  # od kraja, da pozicije ostanu tačne
        media, prelude, b0, b1 = rules[rid]
        sels = set(split_selectors(prelude))
        drop = {prop for prop, ss in items[rid].items() if ss >= sels}
        manual += [f"{prelude} [{prop}]" for prop, ss in items[rid].items() if not ss >= sels]
        if not drop: continue
        decls = re.findall(r"[^;]*;|[^;]+$", css[b0:b1])
        kept = [d for d in decls if ":" not in d or d.split(":", 1)[0].strip() not in drop]
        body = "".join(kept)
        css = css[:b0] + (body if body.strip() else "\n  ") + css[b1:]
        print(f"  uklonjeno u {path.rsplit('/',1)[-1]} {media}: {prelude} [{', '.join(sorted(drop))}]")
    open(path, "w").write(css)
    for m in manual: print(f"  RUČNO (lista selektora): {m}")

def bump_in_media(path, sel, media):
    """Pojačava selektor za dva stepena samo unutar datog upita u zajedničkom fajlu."""
    css = open(path).read()
    for med, prelude, b0, b1 in sorted(rules_with_pos(css), key=lambda r: -r[2]):
        if re.sub(r"\s+", "", med) != re.sub(r"\s+", "", media) or sel not in split_selectors(prelude): continue
        p0 = css.rfind(prelude, 0, b0)
        new_prelude = ", ".join(bump(bump(x)) if x == sel else x for x in split_selectors(prelude))
        css = css[:p0] + new_prelude + css[p0 + len(prelude):]
    open(path, "w").write(css)
    print(f"  pojačano u upitu {media}: {sel}")

if FIX and (to_fix or dead):
    done = set()
    for kind, path, sel, media in to_fix:
        if (kind, path, sel, media) in done: continue
        done.add((kind, path, sel, media))
        if kind == "bump": print(f"  pojačano ({apply(path, sel)}×) u {path.rsplit('/',1)[-1]}: {sel}")
        else: bump_in_media(path, sel, media)
    by_path = {}
    for (path, rid), props in dead.items(): by_path.setdefault(path, {})[rid] = props
    for path, items in by_path.items(): remove_dead(path, items)
    sys.exit(3)
