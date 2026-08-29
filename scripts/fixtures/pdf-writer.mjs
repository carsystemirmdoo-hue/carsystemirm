/**
 * Minimalan PDF pisač — samo pozicioniran tekst.
 *
 * Postoji da bi test fixtures bili SINTETIČKI i da nijedan stvarni dokument ne
 * mora u repozitorijum. Namerno bez zavisnosti: alat koji pravi ulaz za test ne
 * sme uvoditi rizik u lanac isporuke, a ovo je jedini oblik PDF-a koji nam
 * treba — Helvetica i `Td`/`Tj`.
 *
 * NIJE opšti PDF generator i ne treba da postane.
 */

/**
 * Latinica bez dijakritika.
 *
 * Helvetica u WinAnsi kodiranju nema č/ć/đ, pa se u fixtures pišu presavijeni
 * oblici. To NIJE gubitak pokrivenosti: parser i sam presavija dijakritike pre
 * poređenja oznaka (`foldDiacritics`), jer se u stvarnim PDF-ovima dijakritik
 * ume izgubiti pri ekstrakciji. Test `foldDiacritics` dokazuje da se stvarni
 * oblik „Šifra" i presavijeni „Sifra" svode na isti ključ.
 *
 * @param {string} s
 */
export function foldForPdf(s) {
  return s
    .replace(/[čćĉ]/g, "c").replace(/[ČĆĈ]/g, "C")
    .replace(/[šŝ]/g, "s").replace(/[ŠŜ]/g, "S")
    .replace(/[žź]/g, "z").replace(/[ŽŹ]/g, "Z")
    .replace(/đ/g, "dj").replace(/Đ/g, "Dj");
}

function escapePdf(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * @typedef {{ x: number, y: number, text: string, size?: number }} Cell
 * @param {Cell[][]} pages  jedna stavka niza = jedna strana
 * @returns {Uint8Array}
 */
export function writePdf(pages) {
  const objects = [];
  const push = (body) => objects.push(body) && objects.length;

  const fontId = 0; // popunjava se posle
  const contentIds = [];
  for (const cells of pages) {
    const parts = ["BT"];
    let size = null;
    for (const c of cells) {
      const s = c.size ?? 9;
      if (s !== size) { parts.push(`/F1 ${s} Tf`); size = s; }
      parts.push(`1 0 0 1 ${c.x} ${c.y} Tm (${escapePdf(foldForPdf(c.text))}) Tj`);
    }
    parts.push("ET");
    const stream = parts.join("\n");
    contentIds.push(push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
  }

  const fId = push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const pageIds = [];
  const pagesIdPlaceholder = objects.length + pages.length + 1;
  for (let i = 0; i < pages.length; i += 1) {
    pageIds.push(push(
      `<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`,
    ));
  }
  const pagesId = push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );
  const catalogId = push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let out = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  void fontId;
  void pagesIdPlaceholder;
  return new TextEncoder().encode(out);
}
