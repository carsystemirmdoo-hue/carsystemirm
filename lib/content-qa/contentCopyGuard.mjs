/**
 * Čuvar korisničkog teksta: placeholder kontakti, neformalno obraćanje i
 * razvojni žargon ne smeju ponovo da stignu do korisnika.
 *
 * Čita samo tekst koji može biti prikazan — string literale, delove template
 * stringova i JSX tekst — kroz TypeScript AST. Komentari, identifikatori,
 * importi, `className`, ključevi objekata i poređenja (`x === "..."`) se ne
 * čitaju, pa slug `primer-filler` ili `case "demo":` ne prave lažnu uzbunu.
 *
 * Pravila su namerno uska: svako hvata konkretnu grešku koja je već bila u
 * produkcionom kodu (vidi docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md).
 * Izuzetak ide u ALLOWLIST samo sa razlogom; nerešen slučaj se ne skriva ovde.
 *
 *   npm run content:check        # ceo repo
 *   npm run test:content-copy    # pravila + dokaz da čuvar pada
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

/** Izvori koji ulaze u build i mogu da proizvedu tekst za korisnika. */
export const RUNTIME_ROOTS = ["app", "components", "features", "lib"];
const SOURCE_EXT = /\.(tsx?|mts|mjs|js)$/;
const SKIP_PATH = /(^|\/)(node_modules|\.next[^/]*)\/|\.(test|spec)\.|\/__tests__\/|\/integration\//;

/**
 * Putanje (prefiks) koje se ne proveravaju, sa razlogom. Svaka stavka mora
 * da pokazuje na otvoreno pitanje vlasniku ili na nesporan tehnički razlog.
 */
export const ALLOWLIST = [
  {
    prefix: "app/interaction-demo/",
    reason: "Interne demo strane (noindex); da li ostaju dostupne je odluka vlasnika — GAP-008.",
  },
  {
    prefix: "components/interaction-demo/",
    reason: "Komponente internih demo strana — GAP-008.",
  },
  {
    prefix: "app/social-exports/",
    reason: "Interne strane za izvoz društvenih vizuala (noindex) — GAP-008.",
  },
  {
    prefix: "components/social-exports/",
    reason: "Komponente internih strana za izvoz vizuala — GAP-008.",
  },
  {
    prefix: "lib/content-qa/",
    reason: "Definicije pravila samog čuvara (spisak zabranjenih oblika).",
  },
  {
    prefix: "lib/putty-material-trace.ts",
    reason: "Interni zapis provere vizuelnog traga (status/razlog po proizvodu); komponenta čita samo boju i geometriju, tekst se ne renderuje.",
  },
  {
    prefix: "lib/content-assets/content-asset-slots.mjs",
    reason: "Interni registar vizuala; čitaju ga samo skripte (scripts/*content-asset*), nikad stranica.",
  },
];

/** Konteksti u kojima string ne može biti tekst za korisnika. */
const NON_COPY_ATTRS = new Set([
  "className", "id", "href", "src", "key", "type", "name", "htmlFor", "role", "rel",
  "target", "method", "action", "autoComplete", "inputMode", "pattern", "viewBox", "d",
  "fill", "stroke", "sizes", "as", "lang", "accept", "loading", "decoding", "fetchPriority",
  "crossOrigin", "dir", "xmlns", "transform", "points", "aria-controls",
  "aria-describedby", "aria-labelledby", "aria-current", "aria-hidden", "aria-live",
  "headers", "scope", "variant", "size", "tone", "icon", "layout",
]);

/**
 * Polja podataka koja nose internu belešku o poreklu ili proveri i nikad se
 * ne renderuju (provereno nad prerenderovanim HTML-om, 2026-10-01).
 */
const NON_COPY_PROPS = new Set(["internalReason", "reviewerNote", "evidence", "dataNote", "internalNote"]);

const LETTERS = "\\p{L}";
const notGlued = (word) => new RegExp(`(?<![${LETTERS}])(?:${word})(?![${LETTERS}])`, "u");

/**
 * Glagoli koji su se u kodu pojavljivali kao neformalan imperativ. Hvata se
 * samo oblik na početku rečenice (veliko slovo), jer je to oblik dugmeta,
 * oznake i naslova; „sistem traži razlog" (3. lice) se tako ne hvata.
 */
const INFORMAL_IMPERATIVES = [
  "Pogledaj", "Izaberi", "Odaberi", "Unesi", "Klikni", "Pronađi", "Pošalji", "Pozovi",
  "Otvori", "Nastavi", "Sačuvaj", "Dodaj", "Ukloni", "Obriši", "Potvrdi", "Proveri",
  "Preuzmi", "Vrati", "Prijavi se", "Odjavi se", "Istraži", "Saznaj", "Zatraži",
  "Kontaktiraj", "Naruči", "Pretraži", "Filtriraj", "Resetuj", "Pokušaj ponovo", "Promeni",
  "Izmeni", "Pročitaj", "Idi na", "Aktiviraj", "Postavi", "Odustani", "Zatvori", "Prikaži",
  "Sakrij", "Označi", "Kopiraj", "Uvezi", "Izvezi", "Pokreni", "Zaustavi", "Primeni",
  "Poništi", "Očisti", "Isprazni", "Uključi", "Isključi", "Vidi", "Odobri", "Odbij",
  "Opozovi", "Evidentiraj", "Predloži", "Izdaj", "Razreši", "Poveži", "Dodeli", "Oduzmi",
  "Registruj", "Skeniraj", "Preračunaj", "Povuci", "Proširi", "Skupi", "Uvećaj",
  "Otključaj", "Preciziraj", "Prevuci", "Pregledaj", "Pauziraj", "Popuni", "Brusi",
  "Nanesi", "Oblikuj", "Zaštiti", "Pripremi", "Koristi moju",
];
const IMPERATIVE_RE = new RegExp(
  `(?:^|[.!?:;—–→•·(„"]\\s*|\\$\\{…\\}\\s*)(?:${INFORMAL_IMPERATIVES.join("|")})(?![${LETTERS}])`,
  "u",
);

/** Lična zamenica i zamenički pridev drugog lica jednine. */
const TI_RE = notGlued("tvoj|tvoja|tvoje|tvog|tvoga|tvom|tvoju|tvojim|tvojih|tebi|tebe|tobom");

/** Obraćanje jednom korisniku piše se velikim slovom (Vi, Vam, Vas, Vaš…). */
const LOWER_VI_RE = notGlued("vi|vas|vam|vama|vaš|vaša|vaše|vaši|vašeg|vašega|vašem|vašemu|vašu|vašim|vašoj|vaših|vašima|vašom");

/** Placeholder i šablonski kontakt podaci. */
const PLACEHOLDER_RULES = [
  {
    id: "template-phone",
    re: /\+?381[\s/-]?\d{2}[\s/-]?000[\s/-]?000(?![\d-])|(?<![\d-])0\d{1,2}[\s/-]?000[\s/-]?000(?![\d-])|tel:\+?\d*0{6}(?!\d)/u,
  },
  { id: "example-email", re: /@(example|test|demo)\.(com|org|net|rs)\b|\b(test|demo|foo|ime\.prezime)@/iu },
  { id: "lorem", re: /lorem ipsum|dolor sit amet/iu },
  { id: "instruction-placeholder", re: /\b(TBD|FIXME|TODO)\b|ovde ide|Vaš tekst ovde|\[(upiši|upisati|dopuniti|tekst)[^\]]*\]/u },
];

/**
 * Kontakti koje firma NIJE potvrdila (2026-10-01 potvrđeni su telefon
 * kancelarije 022 558 501 i carsystemirmdoo@gmail.com — lib/company-contact.ts).
 * Bili su u kodu ili u javnim izvorima i ne smeju se vratiti kao kontakt.
 */
export const RETIRED_CONTACTS = [
  { id: "office@carsystemirm.com", re: /office@carsystemirm\.com/iu },
  { id: "info@carsystem-rm.rs", re: /info@carsystem-rm\.rs/iu },
  { id: "eurospektar@blic.net", re: /eurospektar@blic\.net/iu },
  { id: "022 367 139", re: /(?:\+?381[\s/-]?|\b0)22[\s/-]?367[\s/-]?139(?!\d)/u },
  { id: "062 8810895", re: /(?:\+?381[\s/-]?|\b0)62[\s/-]?881[\s/-]?0?895(?!\d)/u },
];

/** `tel:` mora biti međunarodni mašinski oblik bez razmaka: tel:+381XXXXXXXX(X). */
const TEL_FORMAT_RE = /^tel:\+381\d{8,9}$/;

/** Razvojni žargon koji je već stizao do korisnika. */
const JARGON_RULES = [
  { id: "backend", re: notGlued("backend") },
  { id: "crawlable", re: /crawlable/iu },
  { id: "preview-internal", re: /internom preview|interni preview|public lokator|demo adres/iu },
  { id: "product-zapis", re: /product (zapis|stranic)/iu },
  { id: "asset", re: notGlued("asset|asseti|asseta|assetima") },
  { id: "env-var", re: /env varijabl|\b[A-Z][A-Z0-9]*_(PASSWORD|SECRET|TOKEN|KEY|URL)\b/u },
  // Interni izvor (folder/ZIP isporuke) u rečenici; samo reč sa razmakom oko nje.
  { id: "folder-zip", re: /\s\S*folder\w*\b|\bZIP\b(?!\S*\.)/u },
  // Poreklo teksta (sync/import provenance) se čuva u podacima, ne prikazuje kupcu.
  // Samo u rečenicama: ID-jevi i enum vrednosti (`…-product-information`,
  // `needs_confirmation`) nisu tekst za korisnika.
  {
    id: "provenance",
    re: /Sažetak (je izveden|se zasniva)|Dokumentovana uloga|Lokalna dokumentacija|povezani su direktno|Stranica ne pretpostavlja|lokalno sačuvan|\bproduct-information (materijal|PDF)|needs confirmation/iu,
  },
  // Interni brojevi faza projekta ne idu u UI zaposlenih (GAP-012).
  { id: "project-phase", re: /\bfaz[aeiu]\s?\d|\bfaze\s\d|Planirano: faza/iu },
];

/**
 * Odluke vlasnika 2026-10-01: uloga „gazda" se korisnicima prikazuje kao
 * „Vlasnik" (GAP-013); naziv firme ima samo dva oblika — „Carsystem i R-M"
 * i „CAR SYSTEM I R-M d.o.o. Inđija" (GAP-005).
 */
const IDENTITY_RULES = [
  { id: "role-label-gazda", test: (text) => /Gazd\p{L}*|„gazda“/u.test(text) || (/gazd/iu.test(text) && /\s/.test(text)) },
  { id: "mixed-company-name", test: (text) => /Carsystem i R-M DOO|Carsystem i R-M Inđija d\.o\.o\./u.test(text) },
];

/** Kontekst iz kog dolazi string; `null` znači da nije tekst za korisnika. */
function copyContext(node, sf) {
  let parent = node.parent;
  // `polje: uslov ? "a" : "b"` — tekst pripada polju, pa se proverava njegov ključ.
  let holder = parent;
  while (holder && (ts.isConditionalExpression(holder) || ts.isParenthesizedExpression(holder))) holder = holder.parent;
  if (holder && holder !== parent && ts.isPropertyAssignment(holder) && NON_COPY_PROPS.has(holder.name.getText(sf))) {
    return null;
  }
  if (!parent) return null;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return null;
  if (ts.isExternalModuleReference(parent) || ts.isLiteralTypeNode(parent)) return null;
  if (ts.isCaseClause(parent) || ts.isElementAccessExpression(parent)) return null;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return null;
  if (ts.isBinaryExpression(parent) && /^(===|!==|==|!=|in)$/.test(parent.operatorToken.getText(sf))) {
    return null;
  }
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression.getText(sf);
    if (/^(require|import)$/.test(callee)) return null;
    if (/(^|\.)(Error|TypeError|RangeError)$/.test(callee)) return null;
    if (/(^|\.)(log|warn|error|debug|info|assert\w*|includes|startsWith|endsWith|get|has|set|getAll|querySelector\w*|getElementById|matchMedia|split|join|replace\w*|test|match|indexOf|getItem|setItem|removeItem|redirect|revalidatePath|revalidateTag)$/.test(callee)) {
      return null;
    }
  }
  if (ts.isNewExpression(parent) && /Error$/.test(parent.expression.getText(sf))) {
    // Greške iz servisnog sloja stižu do korisnika kroz akcije, pa se čitaju.
    return "error";
  }
  if (ts.isJsxAttribute(parent)) return `attr:${parent.name.getText(sf)}`;
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    return `attr:${parent.parent.name.getText(sf)}`;
  }
  if (ts.isPropertyAssignment(parent)) {
    const key = parent.name.getText(sf);
    return NON_COPY_PROPS.has(key) ? null : `prop:${key}`;
  }
  return "text";
}

/** Izvlači tekst iz jednog izvornog fajla: [{ line, context, text }]. */
export function extractCopy(sourceText, fileName) {
  const kind = /x$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const push = (node, value, context) => {
    const text = value.replace(/\s+/g, " ").trim();
    // Reč ili broj nalik telefonu (bez slova, npr. „+381 22 000 000").
    if (!text || !(/\p{L}{2}/u.test(text) || /\d[\d\s/+-]{5,}\d/.test(text))) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push({ line: line + 1, context, text });
  };
  const visit = (node) => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      // `href` nije tekst, ali `tel:`/`mailto:` vrednost jeste kontakt koji korisnik koristi.
      if (name === "href" && node.initializer && ts.isStringLiteral(node.initializer)) {
        if (/^(tel|mailto):/.test(node.initializer.text)) push(node.initializer, node.initializer.text, "attr:href");
        return;
      }
      if (NON_COPY_ATTRS.has(name) || /^(on[A-Z]|style$|data-)/.test(name)) return;
    }
    if (ts.isTaggedTemplateExpression(node) && /sql|css/.test(node.tag.getText(sf))) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const context = copyContext(node, sf);
      if (context) push(node, node.text, context);
    } else if (ts.isTemplateExpression(node)) {
      const context = copyContext(node, sf);
      if (context) {
        const text = [node.head.text, ...node.templateSpans.map((span) => `\${…}${span.literal.text}`)].join("");
        push(node, text, context);
      }
    } else if (ts.isJsxText(node)) {
      push(node, node.text, "jsx");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Pravila nad jednim fragmentom teksta. */
export function checkCopy(text) {
  const problems = [];
  for (const rule of PLACEHOLDER_RULES) if (rule.re.test(text)) problems.push(rule.id);
  for (const contact of RETIRED_CONTACTS) if (contact.re.test(text)) problems.push(`retired-contact:${contact.id}`);
  if (/^tel:/.test(text) && !TEL_FORMAT_RE.test(text)) problems.push("tel-format");
  for (const rule of JARGON_RULES) if (rule.re.test(text)) problems.push(`jargon:${rule.id}`);
  for (const rule of IDENTITY_RULES) if (rule.test(text)) problems.push(rule.id);
  if (IMPERATIVE_RE.test(text)) problems.push("informal-imperative");
  if (TI_RE.test(text)) problems.push("informal-pronoun");
  if (LOWER_VI_RE.test(text)) problems.push("lowercase-vi");
  return problems;
}

/**
 * Pojedinačni izuzeci po pravilu i tekstu, svaki sa razlogom. Ključ je
 * `putanja|pravilo|početak teksta`.
 */
export const RULE_EXCEPTIONS = [
  {
    file: "app/portal/admin/page.tsx",
    rule: "jargon:folder-zip",
    startsWith: "Putanja i pristup folderu sa BiznisSoft izvozom",
    reason: "Uputstvo za Vlasnika pri podešavanju konektora: folder sa BiznisSoft izvozom je stvaran operativni pojam.",
  },
  {
    file: "app/portal/page.tsx",
    rule: "jargon:folder-zip",
    startsWith: "Instaliran lokalni konektor na računaru gde se nalazi folder sa izvozom",
    reason: "Preduslov u portalu za zaposlene: konektor čita folder sa BiznisSoft izvozom na računaru kancelarije.",
  },
  {
    file: "lib/customers/consent.mjs",
    rule: "mixed-company-name",
    startsWith: "Pristajem da mi Carsystem i R-M Inđija d.o.o. šalje",
    reason: "Istorijski tekst saglasnosti 2026-08-v1: evidentirane saglasnosti se ne menjaju (GAP-006); nove odluke koriste 2026-10-v2.",
  },
  {
    file: "lib/company-contact.ts",
    rule: "tel-format",
    startsWith: "tel:${…}",
    reason: "toTelHref gradi link samo kad prođe /^\\+381\\d{8,9}$/; pokriveno testom companyContact.test.mts.",
  },
  {
    file: "lib/seasonal/seasonalCampaigns.config.mjs",
    rule: "lowercase-vi",
    startsWith: "Hvala radionicama i partnerima",
    reason: "Čestitka se obraća radionicama i partnerima zajedno (množina), ne jednom čitaocu.",
  },
  {
    file: "lib/seasonal/seasonalCampaigns.config.mjs",
    rule: "lowercase-vi",
    startsWith: "Želimo vam mirne praznike",
    reason: "Čestitka se obraća radionicama i partnerima zajedno (množina), ne jednom čitaocu.",
  },
];

function isException(file, rule, text) {
  return RULE_EXCEPTIONS.some(
    (entry) => entry.file === file && entry.rule === rule && text.startsWith(entry.startsWith),
  );
}

export function isAllowlisted(relPath) {
  return ALLOWLIST.some((entry) => relPath.startsWith(entry.prefix));
}

/** Proverava jedan fajl; vraća nalaze sa putanjom, linijom i vrednošću. */
export function scanSource(relPath, sourceText) {
  const findings = [];
  for (const fragment of extractCopy(sourceText, relPath)) {
    for (const rule of checkCopy(fragment.text)) {
      if (isException(relPath, rule, fragment.text)) continue;
      findings.push({ file: relPath, line: fragment.line, rule, context: fragment.context, text: fragment.text });
    }
  }
  return findings;
}

function walk(root, dir, files) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (SKIP_PATH.test(`${rel}${entry.isDirectory() ? "/" : ""}`)) continue;
    if (entry.isDirectory()) walk(root, rel, files);
    else if (SOURCE_EXT.test(entry.name)) files.push(rel);
  }
}

/** Ceo repo (ili zadat koren): nalazi + broj pregledanih fajlova. */
export function scanRepository(root, roots = RUNTIME_ROOTS) {
  const files = [];
  for (const dir of roots) if (fs.existsSync(path.join(root, dir))) walk(root, dir, files);
  const findings = [];
  let scanned = 0;
  for (const rel of files.sort()) {
    if (isAllowlisted(rel)) continue;
    scanned += 1;
    findings.push(...scanSource(rel, fs.readFileSync(path.join(root, rel), "utf8")));
  }
  return { scanned, findings };
}

export function formatFinding(finding) {
  return `${finding.file}:${finding.line}  [${finding.rule}]  ${finding.text.slice(0, 160)}`;
}

/**
 * Renderovan HTML (npr. `.next/server/app`): nijedan povučen ili šablonski
 * kontakt i nijedan `tel:` van međunarodnog oblika ne sme da stigne do strane.
 * Vraća { pages, findings: [{ page, rule, value }] }.
 */
export function scanRenderedHtml(appDir) {
  const files = [];
  const walkHtml = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkHtml(full);
      else if (entry.name.endsWith(".html")) files.push(full);
    }
  };
  walkHtml(appDir);
  const findings = [];
  for (const file of files.sort()) {
    const page = `/${path.relative(appDir, file).replace(/\.html$/, "").replace(/(^|\/)index$/, "")}`;
    const html = fs.readFileSync(file, "utf8");
    for (const contact of RETIRED_CONTACTS) {
      const match = html.match(contact.re);
      if (match) findings.push({ page, rule: `retired-contact:${contact.id}`, value: match[0] });
    }
    const template = html.match(PLACEHOLDER_RULES[0].re);
    if (template) findings.push({ page, rule: "template-phone", value: template[0] });
    for (const match of html.matchAll(/href="(tel:[^"]*)"/g)) {
      if (!TEL_FORMAT_RE.test(match[1])) findings.push({ page, rule: "tel-format", value: match[1] });
    }
  }
  return { pages: files.length, findings };
}
