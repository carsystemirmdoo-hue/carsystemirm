#!/usr/bin/env python3
"""Pojačava specifičnost pravila u *.desktop/*.mobile.module.css za jedan stepen (2026-10-22).

Next deli CSS u delove čiji redosled ne prati uvek redosled importa, pa raspored ne sme da
zavisi od toga da li je učitan posle zajedničkog fajla. Prva klasa svakog selektora se
udvostručuje (`.grid` → `.grid.grid`): pravilo rasporeda pobeđuje zajedničko pravilo istog
nivoa, a jača zajednička pravila (npr. tamna tema) ostaju jača, kao i ranije.

    python3 scripts/css/bump-responsive.py components/catalog/CatalogPage.mobile.module.css …
"""
import re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from importlib.machinery import SourceFileLoader
split = SourceFileLoader("split", __file__.rsplit("/", 1)[0] + "/split-responsive.py").load_module()

def bump_selector(sel: str) -> str:
    if "/*bumped*/" in sel: return sel
    m = re.search(r"\.([A-Za-z_][\w-]*)", sel)
    if not m: return sel
    return sel[: m.end()] + "." + m.group(1) + sel[m.end():]

def bump_block(css: str) -> str:
    out = []
    for lead, prelude, body in split.parse(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            out.append(f"{lead}{prelude} {{{bump_block(body)}\n}}")
        elif prelude.startswith("@"):
            out.append(f"{lead}{prelude} {{{body}}}")
        else:
            sels = ",".join(bump_selector(s) for s in prelude.split(","))
            out.append(f"{lead}{sels} {{{body}}}")
    return "".join(out)

for path in sys.argv[1:]:
    text = open(path).read()
    if "specifičnost +1" in text:
        print("već pojačano:", path); continue
    head_end = text.index("*/") + 2 if text.lstrip().startswith("/*") else 0
    head, rest = text[:head_end], text[head_end:]
    head = head.replace(" */", " *\n * Prva klasa svakog selektora je udvostručena (specifičnost +1): raspored ne zavisi od\n * redosleda učitavanja CSS delova (scripts/css/bump-responsive.py).\n */", 1) if head else head
    open(path, "w").write(head + bump_block(rest) + "\n")
    print("pojačano:", path)
