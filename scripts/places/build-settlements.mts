/**
 * Spisak naselja Srbije za pretragu najbližih lokacija (2026-11-03).
 *
 *   npx tsx scripts/places/build-settlements.mts --preuzmi   # Overpass → .cache/naselja-osm
 *   npx tsx scripts/places/build-settlements.mts             # .cache/naselja-osm → podaci
 *
 * Izvor: OpenStreetMap, granice naselja (boundary=administrative, admin_level=9)
 * sa RZS matičnim brojem (`ref:RS:naselje`) i brojem stanovnika iz popisa 2022.
 * Reprezentativna tačka je centar naselja (`admin_centre`, inače `label`), a
 * opština je opština/gradska opština (admin_level 8), inače grad (7), u kojoj
 * ta tačka leži. Licenca: ODbL 1.0 — vidi docs/NASELJA_SRBIJE.md.
 *
 * Izlaz:
 *   public/podaci/naselja-srbije.json — kompaktan skup koji pregledač učitava tek
 *     kada korisnik otvori pretragu mesta;
 *   data/places/naselja-srbije.pokrivenost.json — brojevi i poreklo za proveru.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cyrillicToLatin, settlementLabel, type SettlementDataset, type SettlementRow } from "../../lib/places/serbian-places";

const ROOT = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const sourceDir = path.resolve(
  ROOT,
  args.includes("--izvor") ? args[args.indexOf("--izvor") + 1] : ".cache/naselja-osm",
);
const OVERPASS = "https://overpass-api.de/api/interpreter";
const AREA = 'area["ISO3166-1"="RS"][admin_level=2]->.rs;';

export const QUERIES = {
  "naselja.json": `[out:json][timeout:300];${AREA}rel["boundary"="administrative"]["admin_level"="9"](area.rs)->.n;.n out body center;node(r.n:"admin_centre");out;node(r.n:"label");out;`,
  "opstine-clanstvo.json": `[out:json][timeout:900];${AREA}rel["boundary"="administrative"]["admin_level"="9"](area.rs)->.n;(node(r.n:"admin_centre");node(r.n:"label");)->.c;rel["boundary"="administrative"]["admin_level"~"^(6|7|8)$"](area.rs)->.m;foreach.m->.x(.x out ids tags;.x map_to_area->.a;node.c(area.a);out ids;);`,
};

type OsmTags = Record<string, string>;
type OsmElement = {
  type: "node" | "relation" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
  members?: { type: string; ref: number; role: string }[];
};
type OverpassResponse = { osm3s: { timestamp_osm_base: string }; elements: OsmElement[] };

async function download() {
  await mkdir(sourceDir, { recursive: true });
  for (const [file, query] of Object.entries(QUERIES)) {
    const response = await fetch(OVERPASS, {
      method: "POST",
      headers: { "user-agent": "carsystem-naselja-build/1.0", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    });
    if (!response.ok) throw new Error(`Overpass ${file}: HTTP ${response.status}`);
    await writeFile(path.join(sourceDir, file), await response.text());
    console.log(`preuzeto ${file}`);
  }
}

function latinName(tags: OsmTags) {
  return (tags["name:sr-Latn"] ?? cyrillicToLatin(tags["name:sr"] ?? tags.name ?? "")).trim();
}

function municipalityName(tags: OsmTags) {
  return latinName(tags).replace(/^(Gradska opština|Opština|Grad)\s+/u, "");
}

const round = (value: number) => Math.round(value * 1e5) / 1e5;

async function build() {
  const settlementsRaw = JSON.parse(await readFile(path.join(sourceDir, "naselja.json"), "utf8")) as OverpassResponse;
  const membershipRaw = JSON.parse(
    await readFile(path.join(sourceDir, "opstine-clanstvo.json"), "utf8"),
  ) as OverpassResponse;

  // Članstvo: tačka naselja → opština (8) i grad (7) u kojima leži.
  const containers = new Map<number, { level: string; name: string }[]>();
  let current: OsmElement | null = null;
  for (const element of membershipRaw.elements) {
    if (element.type === "relation") {
      current = element;
      continue;
    }
    if (!current?.tags) continue;
    const list = containers.get(element.id) ?? [];
    list.push({ level: current.tags.admin_level, name: municipalityName(current.tags) });
    containers.set(element.id, list);
  }

  const nodes = new Map(
    settlementsRaw.elements.filter((element) => element.type === "node").map((node) => [node.id, node]),
  );
  const relations = settlementsRaw.elements.filter((element) => element.type === "relation");
  const skipped: string[] = [];
  const pointSource = { admin_centre: 0, label: 0, center: 0 };
  const latinMismatches: string[] = [];

  type Draft = { ref: string; name: string; municipality: string | null; lat: number; lng: number; population: number | null };
  const drafts: Draft[] = [];
  for (const relation of relations) {
    const tags = relation.tags ?? {};
    const ref = tags["ref:RS:naselje"];
    if (!ref) {
      skipped.push(`${relation.id} ${tags.name ?? "?"} (bez RZS matičnog broja)`);
      continue;
    }
    const memberNode = (role: string) => relation.members?.find((member) => member.type === "node" && member.role === role)?.ref;
    const role = memberNode("admin_centre") ? "admin_centre" : memberNode("label") ? "label" : "center";
    const nodeId = role === "center" ? undefined : memberNode(role);
    const node = nodeId ? nodes.get(nodeId) : undefined;
    const lat = node?.lat ?? relation.center?.lat;
    const lng = node?.lon ?? relation.center?.lon;
    if (lat === undefined || lng === undefined) {
      skipped.push(`${ref} ${tags.name} (bez tačke)`);
      continue;
    }
    pointSource[node ? (role as "admin_centre" | "label") : "center"] += 1;
    const levels = nodeId ? (containers.get(nodeId) ?? []) : [];
    const municipality =
      levels.find((item) => item.level === "8")?.name ?? levels.find((item) => item.level === "7")?.name ?? null;
    if (tags["name:sr-Latn"] && tags["name:sr-Latn"] !== cyrillicToLatin(tags["name:sr"] ?? tags.name ?? "")) {
      latinMismatches.push(`${tags.name} → ${tags["name:sr-Latn"]}`);
    }
    const populationTag = tags["population:census:2022"];
    drafts.push({
      ref,
      name: latinName(tags),
      municipality,
      lat: round(lat),
      lng: round(lng),
      population: populationTag && /^\d+$/.test(populationTag) ? Number(populationTag) : null,
    });
  }

  // Naselja čija tačka nije unutar granice opštine u OSM-u (npr. centar je na
  // samoj granici): opština najbližeg naselja koje je ima.
  const assignedByNeighbour: string[] = [];
  for (const draft of drafts) {
    if (draft.municipality) continue;
    const neighbour = drafts
      .filter((other) => other.municipality)
      .sort(
        (left, right) =>
          (left.lat - draft.lat) ** 2 + (left.lng - draft.lng) ** 2 - ((right.lat - draft.lat) ** 2 + (right.lng - draft.lng) ** 2),
      )[0];
    draft.municipality = neighbour?.municipality ?? "";
    assignedByNeighbour.push(`${draft.ref} ${draft.name} → ${draft.municipality}`);
  }

  drafts.sort((left, right) => left.name.localeCompare(right.name, "sr-Latn") || left.ref.localeCompare(right.ref));
  const municipalities = [...new Set(drafts.map((draft) => draft.municipality ?? ""))].sort((left, right) =>
    left.localeCompare(right, "sr-Latn"),
  );
  const municipalityIndex = new Map(municipalities.map((name, index) => [name, index]));
  const rows: SettlementRow[] = drafts.map((draft) => [
    draft.ref,
    draft.name,
    municipalityIndex.get(draft.municipality ?? "") ?? 0,
    draft.lat,
    draft.lng,
    draft.population,
  ]);

  const labels = new Map<string, number>();
  for (const draft of drafts) {
    const label = settlementLabel({ name: draft.name, municipality: draft.municipality ?? "" });
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  const duplicateLabels = [...labels].filter(([, count]) => count > 1).map(([label]) => label);
  if (duplicateLabels.length > 0) throw new Error(`Oznake mesta nisu jedinstvene: ${duplicateLabels.join(", ")}`);

  const retrievedAt = settlementsRaw.osm3s.timestamp_osm_base.slice(0, 10);
  const dataset: SettlementDataset = {
    schema: 1,
    source: {
      name: "OpenStreetMap — granice naselja Srbije (admin_level=9, ref:RS:naselje)",
      license: "ODbL-1.0",
      attribution: "© OpenStreetMap contributors",
      retrievedAt,
      osmTimestamp: settlementsRaw.osm3s.timestamp_osm_base,
    },
    municipalities,
    places: rows,
  };

  await mkdir(path.join(ROOT, "public/podaci"), { recursive: true });
  await writeFile(path.join(ROOT, "public/podaci/naselja-srbije.json"), `${JSON.stringify(dataset)}\n`);

  const names = new Map<string, number>();
  for (const draft of drafts) names.set(draft.name, (names.get(draft.name) ?? 0) + 1);
  const coverage = {
    generatedBy: "scripts/places/build-settlements.mts",
    source: dataset.source,
    queries: QUERIES,
    settlementCount: rows.length,
    municipalityCount: municipalities.length,
    withPopulation2022: drafts.filter((draft) => draft.population !== null).length,
    uninhabited2022: drafts.filter((draft) => draft.population === 0).length,
    repeatedNames: [...names.values()].filter((count) => count > 1).length,
    pointSource,
    assignedMunicipalityByNeighbour: assignedByNeighbour,
    skipped,
    latinNameDiffersFromTransliteration: latinMismatches.length,
  };
  await mkdir(path.join(ROOT, "data/places"), { recursive: true });
  await writeFile(
    path.join(ROOT, "data/places/naselja-srbije.pokrivenost.json"),
    `${JSON.stringify(coverage, null, 2)}\n`,
  );
  console.log(JSON.stringify({ ...coverage, queries: undefined }, null, 2));
  if (latinMismatches.length) console.log("primeri razlike latinice:", latinMismatches.slice(0, 15));
}

if (args.includes("--preuzmi")) await download();
await build();
