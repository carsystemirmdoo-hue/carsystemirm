# Izvlači tekst lokalnih tehničkih listova (public/documents/products/**.pdf) u tmp/saveti/pdftext
# radi brze provere citata pri pisanju. Izlaz je u tmp/ (nije u git-u). Pokretanje: python3 scripts/saveti/izvuci-tekst-pdf.py
import sys, pathlib, io
from pypdf import PdfReader
root = pathlib.Path("public/documents/products")
out = pathlib.Path("tmp/saveti/pdftext")
n=0
for p in sorted(root.rglob("*.pdf")):
    rel = p.relative_to(root)
    o = out / rel.with_suffix(".txt")
    if o.exists(): continue
    o.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = PdfReader(io.BytesIO(p.read_bytes()))
        txt = "\n".join(f"--- strana {i+1} ---\n" + (pg.extract_text() or "") for i, pg in enumerate(r.pages))
        o.write_text(f"IZVOR: /documents/products/{rel}\n" + txt)
        n+=1
    except Exception as e:
        print("ERR", rel, e)
print("done", n)
