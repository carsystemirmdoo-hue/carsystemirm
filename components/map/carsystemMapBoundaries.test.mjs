import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

let applySerbianCorporateBoundaries;
let outDir;

/**
 * Modul je TypeScript ali bez runtime importa, pa se prevodi u izolaciji i
 * testira stvarna funkcija — a ne regex nad izvorom.
 */
before(async () => {
  outDir = await mkdtemp(path.join(tmpdir(), "carsystem-map-style-"));
  await run(
    "npx",
    [
      "tsc",
      "components/map/carsystem-map-style.ts",
      "--outDir",
      outDir,
      "--module",
      "esnext",
      "--target",
      "es2022",
      "--moduleResolution",
      "bundler",
      "--skipLibCheck",
    ],
    { cwd: repoRoot },
  );
  ({ applySerbianCorporateBoundaries } = await import(
    path.join(outDir, "carsystem-map-style.js")
  ));
});

after(async () => {
  if (outDir) await rm(outDir, { recursive: true, force: true });
});

/** Minimalni evaluator za podskup MapLibre izraza koji ovi filteri koriste. */
function evaluate(expression, properties) {
  if (!Array.isArray(expression)) return expression;
  const [op, ...args] = expression;

  switch (op) {
    case "get":
      return properties[evaluate(args[0], properties)];
    case "has":
      return evaluate(args[0], properties) in properties;
    case "literal":
      return args[0];
    case "all":
      return args.every((arg) => evaluate(arg, properties) === true);
    case "any":
      return args.some((arg) => evaluate(arg, properties) === true);
    case "!":
      return evaluate(args[0], properties) !== true;
    case "==":
      return evaluate(args[0], properties) === evaluate(args[1], properties);
    case "!=":
      return evaluate(args[0], properties) !== evaluate(args[1], properties);
    case ">=":
      return evaluate(args[0], properties) >= evaluate(args[1], properties);
    case "<=":
      return evaluate(args[0], properties) <= evaluate(args[1], properties);
    case "match": {
      const input = evaluate(args[0], properties);
      const fallback = args.at(-1);
      for (let i = 1; i < args.length - 1; i += 2) {
        const label = args[i];
        const matched = Array.isArray(label)
          ? label.includes(input)
          : label === input;
        if (matched) return evaluate(args[i + 1], properties);
      }
      return evaluate(fallback, properties);
    }
    default:
      throw new Error(`nepodržan izraz: ${op}`);
  }
}

/** Stvarni filteri iz OpenFreeMap "positron" stila (provereno 2026-08). */
function baseStyle() {
  return {
    layers: [
      {
        id: "boundary_2",
        type: "line",
        "source-layer": "boundary",
        filter: [
          "all",
          ["==", ["get", "admin_level"], 2],
          ["!=", ["get", "maritime"], 1],
          ["!=", ["get", "disputed"], 1],
          ["!", ["has", "claimed_by"]],
        ],
      },
      {
        id: "boundary_disputed",
        type: "line",
        "source-layer": "boundary",
        filter: [
          "all",
          ["!=", ["get", "maritime"], 1],
          ["==", ["get", "disputed"], 1],
        ],
      },
      {
        id: "label_country_3",
        type: "symbol",
        "source-layer": "place",
        filter: [
          "all",
          ["==", ["get", "class"], "country"],
          [">=", ["get", "rank"], 3],
        ],
      },
    ],
  };
}

function layerById(style, id) {
  return style.layers.find((layer) => layer.id === id);
}

/** Osobine su prepisane iz stvarno dekodiranih vektorskih tile-ova. */
const boundary = (adm0_l, adm0_r) => ({
  adm0_l,
  adm0_r,
  admin_level: 2,
  disputed: 0,
  maritime: 0,
});

test("unutrašnja linija Srbija–Kosovo se ne iscrtava", () => {
  const style = applySerbianCorporateBoundaries(baseStyle());
  const filter = layerById(style, "boundary_2").filter;

  assert.equal(evaluate(filter, boundary("XKK", "SRB")), false);
  assert.equal(evaluate(filter, boundary("SRB", "XKK")), false);
});

test("spoljne granice ostaju iscrtane, uključujući granice Kosova ka susedima", () => {
  const style = applySerbianCorporateBoundaries(baseStyle());
  const filter = layerById(style, "boundary_2").filter;

  // Ove tri u ovom prikazu postaju spoljna granica Srbije — moraju ostati,
  // inače u konturi države ostaje rupa.
  assert.equal(evaluate(filter, boundary("XKK", "ALB")), true);
  assert.equal(evaluate(filter, boundary("MKD", "XKK")), true);
  assert.equal(evaluate(filter, boundary("XKK", "MNE")), true);

  // Nepovezane granice se ne smeju dirati.
  assert.equal(evaluate(filter, boundary("SRB", "MNE")), true);
  assert.equal(evaluate(filter, boundary("BGR", "SRB")), true);
  assert.equal(evaluate(filter, boundary("MKD", "SRB")), true);
  assert.equal(evaluate(filter, boundary("ALB", "MNE")), true);
  assert.equal(evaluate(filter, boundary("GRC", "MKD")), true);
});

test("originalni uslovi sloja ostaju na snazi", () => {
  const style = applySerbianCorporateBoundaries(baseStyle());
  const filter = layerById(style, "boundary_2").filter;

  assert.equal(
    evaluate(filter, { ...boundary("SRB", "HUN"), maritime: 1 }),
    false,
  );
  assert.equal(
    evaluate(filter, { ...boundary("SRB", "HUN"), admin_level: 4 }),
    false,
  );
});

test("Kosovo se ne obeležava kao zasebna država", () => {
  const style = applySerbianCorporateBoundaries(baseStyle());
  const filter = layerById(style, "label_country_3").filter;

  assert.equal(
    evaluate(filter, { class: "country", rank: 3, iso_a2: "XK" }),
    false,
  );
  assert.equal(
    evaluate(filter, { class: "country", rank: 3, iso_a2: "RS" }),
    true,
  );
  // Naselja unutar teritorije ostaju vidljiva.
  assert.equal(
    evaluate(filter, { class: "city", rank: 3, name: "Priština" }),
    false,
    "gradovi ne prolaze kroz country sloj",
  );
});

test("filter se primenjuje i na disputed boundary sloj", () => {
  const style = applySerbianCorporateBoundaries(baseStyle());
  const filter = layerById(style, "boundary_disputed").filter;

  assert.equal(
    evaluate(filter, { ...boundary("XKK", "SRB"), disputed: 1 }),
    false,
  );
});
