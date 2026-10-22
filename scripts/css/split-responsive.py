#!/usr/bin/env python3
"""Deli CSS modul na zajednički, desktop i mobilni fajl (2026-10-22).

    python3 scripts/css/split-responsive.py components/catalog/CatalogPage.module.css --breakpoint 900

- Pravila bez media upita ostaju u zajedničkom fajlu (izgled koji dele obe zone).
- `max-width` upiti ≤ breakpoint → <ime>.mobile.module.css; `min-width` upiti > breakpoint →
  <ime>.desktop.module.css. Upit koji pokriva obe zone deli se na dva dela (mobilni do
  breakpoint-a, desktop iznad), sa istim pravilima. Ostali upiti (hover, reduced motion,
  print, orijentacija) ostaju zajednički.
- Redosled pravila u svakom fajlu prati original. `--check` prijavljuje zajednička pravila
  koja u originalu dolaze POSLE media pravila sa istim selektorom i svojstvom (posle podele
  bi media pravilo dobilo prednost) — takva mesta se rešavaju ručno pre podele.
- Komponente koriste `<ime>.styles.ts`, koji spaja klase sva tri fajla pod istim imenom.
- Posle podele OBAVEZNO: `scripts/css/bump-responsive.py` nad .desktop/.mobile fajlovima
  (Next ne garantuje redosled CSS delova; raspored mora da pobedi bez obzira na redosled),
  pa `scripts/css/winner-check.py <original> <zajednički> <mobilni> <desktop> --fix` do 0 promena.
"""
from __future__ import annotations
import argparse, re, sys
from pathlib import Path

def parse(css: str):
    out, i, n = [], 0, len(css)
    def skip(i):
        while i < n:
            if css.startswith("/*", i): i = css.index("*/", i) + 2
            elif css[i].isspace(): i += 1
            else: break
        return i
    def block_end(j):
        depth = 0
        while j < n:
            if css.startswith("/*", j): j = css.index("*/", j) + 2; continue
            if css[j] == "{": depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0: return j + 1
            j += 1
        raise ValueError("neuravnotežene zagrade")
    while True:
        i0 = i; i = skip(i)
        if i >= n: break
        j = css.index("{", i); k = block_end(j)
        out.append((css[i0:i], css[i:j].strip(), css[j + 1:k - 1]))
        i = k
    return out

def px(v: str) -> float:
    m = re.match(r"([\d.]+)(px|rem|em)", v.strip())
    if not m: raise ValueError(v)
    return float(m.group(1)) * (16 if m.group(2) in ("rem", "em") else 1)

def classify(prelude: str, bp: float):
    """→ (mobilni_upit|None, desktop_upit|None) ili None kada upit nije po širini."""
    q = prelude[len("@media"):].strip()
    if re.search(r"hover|pointer|motion|print|orientation|color-scheme|prefers", q) or "," in q:
        return None
    mins = [px(v) for v in re.findall(r"min-width:\s*([\d.]+(?:px|rem|em))", q)]
    maxs = [px(v) for v in re.findall(r"max-width:\s*([\d.]+(?:px|rem|em))", q)]
    if not mins and not maxs: return None
    lo = max(mins) if mins else 0.0
    hi = min(maxs) if maxs else float("inf")
    mob = dsk = None
    if lo <= bp:  # deo upita pada u mobilnu zonu
        mob = q if hi <= bp else f"({'min-width: %gpx) and (' % lo if mins else ''}max-width: {bp:g}px)"
    if hi > bp:   # deo upita pada u desktop zonu
        dsk = q if lo > bp else f"(min-width: {bp + 1:g}px){' and (max-width: %gpx)' % hi if maxs else ''}"
    return mob, dsk

def decls(body: str):
    return {d.split(":", 1)[0].strip() for d in body.split(";") if ":" in d and not d.strip().startswith("/*")}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file"); ap.add_argument("--breakpoint", type=float, required=True)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    path = Path(a.file); css = path.read_text()
    bp = a.breakpoint
    base, mobile, desktop = [], [], []
    seen_media = []  # (selektor, svojstva) media pravila do sada
    conflicts = []
    for lead, prelude, body in parse(css):
        if prelude.startswith("@media"):
            c = classify(prelude, bp)
            if c is None:
                base.append(f"{lead}{prelude} {{{body}}}"); continue
            mob, dsk = c
            for sel, b2 in [(p, b) for _, p, b in parse(body)]:
                seen_media.append((sel, decls(b2)))
            if mob: mobile.append(f"@media {mob} {{{body}}}")
            if dsk: desktop.append(f"@media {dsk} {{{body}}}")
        else:
            if not prelude.startswith("@"):
                props = decls(body)
                for sel, mprops in seen_media:
                    if sel == prelude and props & mprops:
                        conflicts.append((prelude, sorted(props & mprops)))
            base.append(f"{lead}{prelude} {{{body}}}")
    if conflicts:
        print("REDOSLED — zajedničko pravilo posle media pravila sa istim svojstvom:")
        for sel, props in conflicts: print(f"  {sel!r}: {', '.join(props)}")
    if a.check:
        print(f"zajedničkih blokova: {len(base)}, mobilnih: {len(mobile)}, desktop: {len(desktop)}")
        sys.exit(1 if conflicts else 0)
    if conflicts: sys.exit("Prvo reši sukobe redosleda (--check).")
    stem = path.name.replace(".module.css", "")
    head = lambda kind, rule: f"/*\n * {kind} raspored za {stem} ({rule}). Uređuje se nezavisno; zajednički izgled je u\n * {stem}.module.css, a komponente koriste {stem}.styles.ts (2026-10-22).\n */\n\n"
    path.write_text("".join(base).lstrip() + "\n")
    path.with_name(f"{stem}.mobile.module.css").write_text(head("MOBILNI", f"do {bp:g}px") + "\n\n".join(mobile) + "\n")
    path.with_name(f"{stem}.desktop.module.css").write_text(head("DESKTOP", f"od {bp + 1:g}px") + "\n\n".join(desktop) + "\n")
    path.with_name(f"{stem}.styles.ts").write_text(f'''import base from "./{stem}.module.css";
import desktop from "./{stem}.desktop.module.css";
import mobile from "./{stem}.mobile.module.css";
import {{ mergeResponsiveStyles }} from "@/lib/ui/mergeResponsiveStyles";

/** Klase {stem}: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
''')
    print(f"{path.name}: zajedničkih {len(base)}, mobilnih {len(mobile)}, desktop {len(desktop)}")

if __name__ == "__main__":
    main()
