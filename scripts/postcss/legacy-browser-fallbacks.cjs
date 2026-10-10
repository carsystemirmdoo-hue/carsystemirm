/**
 * Rezervne vrednosti za starije pregledače (PostCSS korak posle Tailwind-a).
 *
 * Sajt boji gotovo sve površine u `oklch()`. Chrome i Edge ga podržavaju tek
 * od verzije 111, a 109 je POSLEDNJA verzija za Windows 7 i 8.1; Safari od
 * 15.4. Pregledač koji ne zna `oklch()` odbaci deklaraciju, a promenljiva
 * (`--background`, `--dk-1`…) postane nevažeća — tamna tema tada gubi
 * pozadine i linije, a deo teksta ostaje bez kontrasta. Isto važi za
 * `mask-image` bez `-webkit-` prefiksa (Chrome < 120).
 *
 * Korak samo DODAJE rezervu i ne dira ništa drugo u fajlu:
 *   - statička vrednost: `color: #hex` se umeće ispred originala;
 *   - promenljiva (`--x`), vrednost sa `var()` i `border*`: u pravilu ostaje
 *     rezerva, a original se vraća u `@supports` kopiji istog selektora
 *     odmah iza pravila (vidi `movesToSupports`);
 *   - `mask`, `mask-image`: dodaje se `-webkit-` par ako ga nema.
 * Moderni pregledač i dalje koristi originalnu boju.
 *
 * Vrednost rezerve računa Lightning CSS (već u projektu kao zavisnost
 * Tailwind-a), ali samo za pojedinačnu deklaraciju. Ceo fajl mu se namerno ne
 * predaje: CSS module (`:global(…)`) ne razume, pa je selektore praznio ili
 * spajao u `:is()`.
 *
 * `color-mix()` (Chrome 111, Safari 16.2) sa `var()` ne može se izračunati
 * unapred. Rezerva je tada DOMINANTNA boja mešavine: `color-mix(in oklab,
 * var(--accent), black 8%)` → `var(--accent)`. Kad preovlađuje `transparent`
 * (providna nijansa, tanka linija), rezerva je `transparent` — bez toga bi
 * stari pregledač odbacio deklaraciju, a ivica bi pala na `currentColor`.
 */
// CommonJS namerno: Next učitava PostCSS dodatke kroz require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { transform } = require("lightningcss");

/** Najstarije verzije koje sajt namerno podržava (major << 16 | minor << 8). */
const LEGACY_TARGETS = Object.freeze({
  chrome: 109 << 16,
  edge: 109 << 16,
  firefox: 115 << 16,
  safari: (15 << 16) | (4 << 8),
  ios_saf: (15 << 16) | (4 << 8),
});

const PLUGIN = "carsystem-legacy-browser-fallbacks";
const MODERN_COLOR = /\b(?:oklch|oklab|lab|lch)\(|color\(display-p3/i;
const COLOR_MIX = /\bcolor-mix\(/i;
const PREFIXED_MASK = new Set(["mask", "mask-image"]);
const SUPPORTS_MODERN = "(color: oklch(0% 0 0)) and (color: color-mix(in srgb, red, red))";

const cache = new Map();

/**
 * Rezervna vrednost jedne deklaracije, ili `null` kad je nema (npr. boja
 * zavisi od `var()` pa se ne može izračunati unapred).
 */
function legacyValue(prop, value) {
  const key = `${prop}\u0000${value}`;
  if (cache.has(key)) return cache.get(key);

  let fallback = null;
  try {
    const { code } = transform({
      filename: "declaration.css",
      code: Buffer.from(`a{${prop}:${value}}`),
      targets: LEGACY_TARGETS,
      minify: true,
    });
    // Izlaz je `a{rezerva;original}` ili, za promenljive, `a{rezerva}@supports…`.
    const output = code.toString();
    const body = output.slice(output.indexOf("{") + 1, output.indexOf("}"));
    // Prva deklaracija iz prvog bloka je rezerva.
    const first = splitDeclarations(body)[0];
    const separator = first ? first.indexOf(":") : -1;
    if (separator > 0) {
      const candidate = first.slice(separator + 1).trim();
      if (candidate && !MODERN_COLOR.test(candidate)) fallback = candidate;
    }
  } catch {
    fallback = null;
  }

  cache.set(key, fallback);
  return fallback;
}

/** Deli `a:b;c:d(e;f)` na deklaracije, poštujući zagrade i navodnike. */
function splitDeclarations(body) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === quote && body[index - 1] !== "\\") quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === ";" && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.filter((part) => part.trim());
}

/** Indeks zagrade koja zatvara onu otvorenu na `open`. */
function closingParen(value, open) {
  let depth = 0;
  for (let index = open; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    else if (value[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Deli argumente funkcije po zarezima na nultoj dubini. */
function splitArguments(inner) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(inner.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(inner.slice(start).trim());
  return parts;
}

/** `var(--a) 42%` → { color: "var(--a)", percent: 42 } */
function colorStop(argument) {
  const match = argument.match(/^(.*\S)\s+(\d+(?:\.\d+)?)%$/s);
  return match
    ? { color: match[1].trim(), percent: Number(match[2]) }
    : { color: argument.trim(), percent: null };
}

/**
 * Svaki `color-mix(...)` u vrednosti zamenjuje dominantnom bojom. Vraća
 * `null` ako mešavina nije u očekivanom obliku.
 */
function replaceColorMix(value) {
  let output = "";
  let cursor = 0;
  const pattern = /color-mix\(/gi;
  let match;
  while ((match = pattern.exec(value))) {
    const open = match.index + match[0].length - 1;
    const close = closingParen(value, open);
    if (close < 0) return null;
    const args = splitArguments(value.slice(open + 1, close));
    if (args.length !== 3 || !/^in\s/i.test(args[0])) return null;
    const first = colorStop(args[1]);
    const second = colorStop(args[2]);
    let firstShare = 50;
    if (first.percent !== null && second.percent !== null) {
      firstShare = (first.percent / (first.percent + second.percent || 1)) * 100;
    } else if (first.percent !== null) {
      firstShare = first.percent;
    } else if (second.percent !== null) {
      firstShare = 100 - second.percent;
    }
    let dominant = firstShare >= 50 ? first.color : second.color;
    if (COLOR_MIX.test(dominant)) {
      dominant = replaceColorMix(dominant);
      if (dominant === null) return null;
    }
    output += value.slice(cursor, match.index) + dominant;
    cursor = close + 1;
    pattern.lastIndex = cursor;
  }
  return output + value.slice(cursor);
}

/** Rezerva za vrednost: prvo `color-mix()`, pa statičke moderne boje. */
function fallbackFor(prop, value) {
  let candidate = value;
  if (COLOR_MIX.test(candidate)) {
    candidate = replaceColorMix(candidate);
    if (candidate === null) return null;
  }
  if (MODERN_COLOR.test(candidate)) {
    candidate = legacyValue(prop, candidate);
  }
  if (!candidate || candidate === value) return null;
  if (MODERN_COLOR.test(candidate) || COLOR_MIX.test(candidate)) return null;
  return candidate;
}

/**
 * Da li original ide u `@supports` kopiju umesto da rezerva stoji ispred njega.
 *
 *  - Vrednost sa `var()` pregledač uvek prihvata pri parsiranju, pa bi
 *    kasnija moderna deklaracija pregazila rezervu i tek onda postala
 *    nevažeća — ishod je `unset` (npr. providna pozadina dugmeta).
 *  - Minifikator CSS-a u Next-u spaja `border*`/`outline*` deklaracije i
 *    briše raniju „dupliranu“ vrednost, a sa njom i rezervu.
 */
function movesToSupports(decl) {
  return decl.value.includes("var(") || /^(?:border|outline|scrollbar)/.test(decl.prop);
}

/** `background-color` → `background`, `-webkit-mask` → `mask` */
function propertyFamily(prop) {
  return prop.replace(/^-[a-z]+-/, "").split("-")[0];
}

/**
 * Kasnije deklaracije iste porodice u istom pravilu. Kopiraju se u
 * `@supports` zajedno sa originalom, da kopija ne bi pregazila npr.
 * `border-top-color` koji u izvoru dolazi posle `border`.
 */
function laterSameFamily(decl) {
  const family = propertyFamily(decl.prop);
  const later = [];
  for (let next = decl.next(); next; next = next.next()) {
    if (next.type === "decl" && propertyFamily(next.prop) === family) later.push(next);
  }
  return later;
}

function hasSibling(decl, prop) {
  return decl.parent.some((node) => node.type === "decl" && node.prop === prop);
}

function insideModernSupports(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      parent.type === "atrule" &&
      parent.name === "supports" &&
      (MODERN_COLOR.test(parent.params) || COLOR_MIX.test(parent.params))
    ) {
      return true;
    }
  }
  return false;
}

function legacyBrowserFallbacks() {
  return {
    postcssPlugin: PLUGIN,
    OnceExit(root, { AtRule }) {
      /**
       * pravilo → (deklaracija → kopija sa originalnom vrednošću ili `null`
       * kad se kopira kakva jeste) za `@supports` blok iza pravila
       */
      const supportsCopies = new Map();
      /** deklaracije koje posle obilaska ostaju samo u @supports kopiji */
      const removed = new Set();

      root.walkDecls((decl) => {
        if (decl.parent?.type !== "rule") return;
        if (decl.parent.parent?.type === "atrule" && /keyframes$/i.test(decl.parent.parent.name)) return;

        if (PREFIXED_MASK.has(decl.prop) && !hasSibling(decl, `-webkit-${decl.prop}`)) {
          decl.cloneBefore({ prop: `-webkit-${decl.prop}` });
        }

        if (!MODERN_COLOR.test(decl.value) && !COLOR_MIX.test(decl.value)) return;
        if (insideModernSupports(decl)) return;

        const previous = decl.prev();
        if (
          previous?.type === "decl" &&
          previous.prop === decl.prop &&
          !MODERN_COLOR.test(previous.value) &&
          !COLOR_MIX.test(previous.value) &&
          !decl.value.includes("var(")
        ) {
          // Autor je već napisao rezervu. Za border*/outline* minifikator ipak
          // spaja dve iste osobine i briše raniju (rezervu), pa original i
          // ovde ide u @supports kopiju, a u pravilu ostaje autorova rezerva.
          if (/^(?:border|outline)/.test(decl.prop)) {
            const rule = decl.parent;
            if (!supportsCopies.has(rule)) supportsCopies.set(rule, new Map());
            const copies = supportsCopies.get(rule);
            copies.set(decl, decl.clone());
            for (const later of laterSameFamily(decl)) {
              if (!copies.has(later)) copies.set(later, null);
            }
            removed.add(decl);
          }
          return;
        }

        const fallback = fallbackFor(decl.prop, decl.value);
        if (!fallback) return;

        if (!decl.prop.startsWith("--") && !movesToSupports(decl)) {
          decl.cloneBefore({ value: fallback });
          return;
        }

        const rule = decl.parent;
        if (!supportsCopies.has(rule)) supportsCopies.set(rule, new Map());
        const copies = supportsCopies.get(rule);
        copies.set(decl, decl.clone());
        if (!decl.prop.startsWith("--")) {
          for (const later of laterSameFamily(decl)) {
            if (!copies.has(later)) copies.set(later, null);
          }
        }
        decl.value = fallback;
      });

      for (const [rule, copies] of supportsCopies) {
        const declarations = rule.nodes
          .filter((node) => copies.has(node))
          .map((node) => copies.get(node) ?? node.clone());
        for (const node of removed) if (node.parent === rule) node.remove();
        const supports = new AtRule({ name: "supports", params: SUPPORTS_MODERN });
        const copy = rule.clone({ nodes: [] });
        copy.append(declarations);
        supports.append(copy);
        rule.after(supports);
      }
    },
  };
}

legacyBrowserFallbacks.postcss = true;
legacyBrowserFallbacks.LEGACY_TARGETS = LEGACY_TARGETS;

module.exports = legacyBrowserFallbacks;
