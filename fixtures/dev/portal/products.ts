import type { Manufacturer, Product, ProductGroup } from "@/types/portal";

export const manufacturers: Manufacturer[] = [
  { id: "m-rm", name: "R-M", code: "RM" },
  { id: "m-cs", name: "Carsystem", code: "CS" },
  { id: "m-baslac", name: "baslac", code: "BAS" },
  { id: "m-cosmos", name: "Cosmos Lac", code: "COS" },
  { id: "m-sata", name: "SATA", code: "SAT" },
  { id: "m-sia", name: "SIA", code: "SIA" },
  { id: "m-norbin", name: "Norbin", code: "NOR" },
  { id: "m-carfit", name: "Carfit", code: "CF" },
];

export const productGroups: ProductGroup[] = [
  { id: "g-clear", name: "Bezbojni lakovi" },
  { id: "g-hardener", name: "Učvršćivači" },
  { id: "g-primer", name: "Prajmeri i fileri" },
  { id: "g-abrasive", name: "Brusni materijal" },
  { id: "g-putty", name: "Gitovi" },
  { id: "g-spray", name: "Sprejevi" },
  { id: "g-polish", name: "Poliranje" },
  { id: "g-equipment", name: "Oprema" },
];

const rawProducts = [
  ["C-2P45 Speed Finish-R", "R-M", "Bezbojni lakovi", "Brzi lak", "1 l", 6290, "/products/rm/rm-diamont-bazna-boja.jpg"],
  ["H-2P15 Clear Hardener-R", "R-M", "Učvršćivači", "Standardni", "0,5 l", 3890],
  ["P-2E23 Primer Filler Grey", "R-M", "Prajmeri i fileri", "2K filer", "1 l", 4820],
  ["R-2P20 Under Thinn-R Medium", "R-M", "Učvršćivači", "Razređivači", "1 l", 2950],
  ["C-2P62 Bright Finish-R", "R-M", "Bezbojni lakovi", "Premium lak", "1 l", 7180],
  ["Diamont BC 100 bela", "R-M", "Prajmeri i fileri", "Bazne boje", "1 l", 5740],
  ["Multi Green Git", "Carsystem", "Gitovi", "Univerzalni git", "1 kg", 1690, "/products/carsystem/carsystem-git-multi-green.jpg"],
  ["Elastic Weiss Git", "Carsystem", "Gitovi", "Fini git", "1 kg", 1820, "/products/carsystem/carsystem-git-elastic-weiss.png"],
  ["F19 Brusni disk P150", "Carsystem", "Brusni materijal", "Diskovi", "100 kom", 4250, "/products/carsystem/carsystem-f19-brusni-diskovi.png"],
  ["F23 Brusni disk P320", "Carsystem", "Brusni materijal", "Diskovi", "100 kom", 4490, "/products/carsystem/carsystem-f23-brusni-diskovi.png"],
  ["P19 Brusni disk P600", "Carsystem", "Brusni materijal", "Diskovi", "100 kom", 4720, "/products/carsystem/carsystem-p19-brusni-diskovi.png"],
  ["Finish polir pasta", "Carsystem", "Poliranje", "Paste", "1 kg", 3580, "/products/carsystem/carsystem-finish-serija.png"],
  ["35-M214 Fina pasta", "baslac", "Prajmeri i fileri", "Bazne boje", "1 l", 4350, "/products/baslac/baslac-35-m214.jpg"],
  ["35-M331 Toner", "baslac", "Prajmeri i fileri", "Bazne boje", "1 l", 4690, "/products/baslac/baslac-35-m331-pasta.webp"],
  ["60-20 Razređivač", "baslac", "Učvršćivači", "Razređivači", "1 l", 2480, "/products/baslac/baslac-60-20-razredjivac.jpg"],
  ["30-S510 S Serija", "baslac", "Bezbojni lakovi", "Standardni lak", "1 l", 5280, "/products/baslac/baslac-30-s510-s-serija.webp"],
  ["Cosmos sprej crni mat", "Cosmos Lac", "Sprejevi", "Akrilni sprej", "400 ml", 690, "/products/cosmos-spray/cosmos-spray-335-crni.png"],
  ["Cosmos sprej sivi prajmer", "Cosmos Lac", "Sprejevi", "Prajmer sprej", "400 ml", 740, "/products/cosmos-spray/cosmos-spray-300.png"],
  ["Cosmos cink sprej", "Cosmos Lac", "Sprejevi", "Zaštitni sprej", "400 ml", 890],
  ["SATAjet X 5500 RP", "SATA", "Oprema", "Pištolji", "kom", 89800],
  ["SATA filter 484", "SATA", "Oprema", "Filteri", "kom", 12800],
  ["SIA 1950 siaspeed P150", "SIA", "Brusni materijal", "Diskovi", "100 kom", 5680],
  ["SIA 1948 siaflex P320", "SIA", "Brusni materijal", "Diskovi", "100 kom", 4950],
  ["SIA 7940 sianet P180", "SIA", "Brusni materijal", "Mrežasti diskovi", "50 kom", 6140],
  ["Norbin N15-020 Razređivač", "Norbin", "Učvršćivači", "Razređivači", "1 l", 2190, "/products/norbin/norbin-n15-020-1l.jpg"],
  ["Carfit maskirna folija 4x5m", "Carfit", "Oprema", "Maskiranje", "kom", 570, "/products/carfit/carfit-maskirna-folija-4x5m.jpg"],
  ["Carsystem zaštitno odelo", "Carsystem", "Oprema", "Lična zaštita", "kom", 3890, "/products/carsystem/carsystem-zastitno-odelo.png"],
  ["R-M Pasta 190", "R-M", "Poliranje", "Paste", "1 l", 5350, "/products/rm/rm-pasta-190-1l.jpg"],
  ["R-M Body Filler White", "R-M", "Gitovi", "Fini git", "2 kg", 3990, "/products/rm/rm-body-filler-white-b-2e11.jpg"],
  ["Carsystem Multi Strain Git", "Carsystem", "Gitovi", "Crni git", "1 kg", 1950],
] as const;

export const products: Product[] = rawProducts.map((row, index) => {
  const [name, manufacturer, group, subgroup, packaging, basePrice, image] = row;
  const sku = `${manufacturer.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}-${String(index + 101).padStart(4, "0")}`;
  const availability: Product["availability"] = index % 11 === 0 ? "nema na stanju" : index % 5 === 0 ? "nisko stanje" : "na stanju";
  const mappingStatus: Product["mappingStatus"] = index % 13 === 0 ? "greška" : index % 7 === 0 ? "čeka mapiranje" : "mapiran";
  const purchasePrice = Math.round(basePrice * (0.58 + (index % 4) * 0.025));
  const minimumPrice = Math.round(purchasePrice / 0.82);
  return {
    id: `prd-${index + 1}`,
    sku,
    catalogNumber: `KAT-${String(7200 + index * 17)}`,
    bizniSoftCode: mappingStatus === "mapiran" ? `BS-${String(41000 + index)}` : undefined,
    name,
    manufacturer,
    group,
    subgroup,
    packaging,
    status: index === 28 ? "najava" : "aktivan",
    availability,
    mappingStatus,
    basePrice,
    purchasePrice,
    minimumPrice,
    averageSalePrice: Math.round(basePrice * (0.88 + (index % 3) * 0.02)),
    averageMargin: 19 + (index % 8),
    customerCount: 4 + ((index * 7) % 38),
    lastSaleAt: `2026-08-${String(1 + (index % 3)).padStart(2, "0")}T${String(8 + (index % 9)).padStart(2, "0")}:20:00`,
    image,
    variants: [{ id: `var-${index + 1}`, label: packaging, packaging, sku, price: basePrice, available: availability === "nema na stanju" ? 0 : 8 + index * 2 }],
    aliases: [],
    relatedProductIds: [`prd-${((index + 1) % rawProducts.length) + 1}`],
  };
});

const aliasSeed = [
  ["crni git 1kg", "prd-30", 96],
  ["cosmos sprej crni", "prd-17", 98],
  ["ona sia 150", "prd-22", 91],
  ["RM učvršćivač", "prd-2", 88],
] as const;

for (const [value, productId, confidence] of aliasSeed) {
  const product = products.find((item) => item.id === productId);
  product?.aliases.push({ id: `alias-${productId}`, value, productId, confidence });
}
