# Cosmos Lac — revizija izvora i modela (dry run)

> Generisano: `node scripts/cosmos-lac-sync/audit.mjs`. Ništa nije uvezeno; runtime, slike i dokumenti nisu menjani.

## Brojevi

```
CURRENT_PRODUCT_FAMILIES: 29
CURRENT_OFFICIAL_PRODUCTS_BY_DOCUMENT: 108
CURRENT_OFFICIAL_ARTICLE_NUMBERS: 648
CURRENT_SHADE_PAGES_WITHOUT_ANY_OFFICIAL_CODE: 31
OFFICIAL_EAN_OR_ARTICLE_NUMBERS_PUBLISHED: 0
CURRENT_VARIANTS_SHADES: 679
CURRENT_VARIANTS_SHADES_OTHER_LOCALES_ONLY: 11
EXISTING_LOCAL_RECORDS: 742
EXISTING_VISIBLE_CARDS: 68
EXACT_MATCH: 650
HIGH_CONFIDENCE: 12
PROBABLE: 0
LEGACY_LOCAL_ONLY: 79
LEGACY_LOCAL_ONLY_MOLOTOW: 73
DUPLICATES: 0
UNKNOWN: 1
OFFICIAL_SHADE_PAGES_WITHOUT_LOCAL_RECORD: 29
OFFICIAL_PRODUCTS_WITHOUT_LOCAL_CARD: 9
EXPECTED_VISIBLE_CARDS_AFTER: 91
EXPECTED_VISIBLE_CARDS_AFTER_BY_MODEL: {"KEEP_CURRENT_GROUPING":77,"HYBRID_RECOMMENDED":91,"OFFICIAL_PRODUCT_EQUALS_CARD":110}
EXPECTED_VARIANT_ROWS: 691
EXPECTED_VARIANT_ROWS_IF_LEGACY_KEPT: 771
OFFICIAL_SOURCE_IMAGES: 678
LOCAL_LEGITIMATE_IMAGES: 742
LOCAL_IMAGES_WITH_BRAND_KIT_PROVENANCE: 742
LOCAL_PIXEL_IDENTICAL_IMAGE_GROUPS: 5
NEW_SHADES_WITH_BRAND_KIT_ASSET: 15
MISSING_IMAGES: 14
OFFICIAL_DOCUMENTS: 103
OFFICIAL_DOCUMENTS_OK: 102
OFFICIAL_DOCUMENTS_BROKEN: 1
DOCUMENT_COVERAGE_MATCHED_RECORDS: 650/651
DOCUMENT_COVERAGE_CARDS: 66/68
LOCAL_DOCUMENTS_TODAY: 1
PACK_CONFLICTS: 65
PACK_NOT_STATED_ON_OFFICIAL_PAGE: 33
```

## Zvanične linije

| linija | zvanični naziv | nijansi | zvaničnih proizvoda (dokument) | pakovanja |
| --- | --- | --- | --- | --- |
| color-lines/chalk-effect | Color Lines › CHALK EFFECT | 34 | 2 | 400ml |
| color-lines/easy-max | Color Lines › EASY MAX | 53 | 6 | 400ml |
| color-lines/fast-acrylic | Color Lines › FAST ACRYLIC | 29 | 2 | 400ml |
| color-lines/flame | Color Lines › FLAME™ | 2 | 2 | — |
| color-lines/ral | Color Lines › RAL | 61 | 2 | 400ml ; 400ml, 500ml |
| color-lines/spray-bike | Color Lines › SPRAY.BIKE LINE | 78 | 10 | 400ml |
| flame/flame-blue | Color Lines › FLAME™ | 120 | 2 | 400ml |
| flame/flame-orange | Color Lines › FLAME™ | 135 | 2 | 400ml ; 400ml, 600ml ; 400ml, 500ml, 600ml |
| other-products/acrylic-paints | Other Products › ACRYLIC PAINTS | 1 | 1 | — |
| other-products/plastic-paints | Other Products › PLASTIC PAINTS | 1 | 1 | 1kg, 5kg, 15kg |
| other-products/putties | Other Products › PUTTIES | 5 | 5 | 400gr, 800gr ; 1kg, 5kg ; 200gr, 450gr, 850gr |
| other-products/sportpens | Other Products › SPORTPENS | 10 | 1 | — |
| other-products/wood-glue | Other Products › WOOD GLUE | 3 | 1 | 175gr ; 1kg ; 750gr |
| other-products/wood-putties | Other Products › WOOD PUTTIES | 18 | 1 | 200gr |
| other-products/wood-varnish-w | Other Products › W | 8 | 2 | 400ml ; 375ml, 750ml |
| special-use/automotive | Special Use › AUTOMOTIVE | 15 | 9 | 400ml ; 200ml |
| special-use/cleaners | Special Use › CLEANERS | 5 | 5 | 400ml ; 200ml |
| special-use/effect | Special Use › EFFECT | 4 | 3 | 175ml ; 400ml |
| special-use/fluo-marking | Special Use › FLUORESCENT & MARKING | 11 | 3 | 400ml ; 500ml |
| special-use/high-heat | Special Use › HIGH HEAT | 8 | 2 | 175ml, 750ml ; 400ml |
| special-use/home | Special Use › HOME | 5 | 5 | 400ml |
| special-use/lubricants | Special Use › LUBRICANTS | 14 | 14 | 400ml ; 500ml ; 200ml, 400ml |
| special-use/master-mechanic | Special Use › MASTER MECHANIC | 26 | 13 | 500ml |
| special-use/metallic | Special Use › METALLIC | 4 | 1 | 400ml |
| special-use/primer | Special Use › PRIMER | 9 | 4 | 400ml |
| special-use/sealer | Special Use › SEALER | 4 | 1 | 500ml |
| special-use/varnish | Special Use › VARNISH | 10 | 4 | 400ml |
| special-use/wheel-rim | Special Use › WHEEL RIM | 4 | 2 | 500ml ; 400ml |
| special-use/zinc | Special Use › ZINC | 2 | 2 | 400ml |

## Postojeće kartice ↔ zvanični proizvodi

| kartica | zapisa | klasifikacija | zvanični proizvodi |
| --- | --- | --- | --- |
| automotive-antichip | 3 | HIGH_CONFIDENCE 2, EXACT_MATCH 1 | antichip |
| automotive-backlight-paint | 2 | EXACT_MATCH 1, LEGACY_LOCAL_ONLY 1 | backlight |
| automotive-brake-caliper-engine-paint | 3 | EXACT_MATCH 3 | brake-caliper |
| automotive-bumper-paint | 5 | EXACT_MATCH 5 | bumper-paint |
| automotive-prefilled-spray | 1 | EXACT_MATCH 1 | prefilled |
| automotive-quick-start | 1 | EXACT_MATCH 1 | quick-start |
| automotive-vinyl-fabric | 1 | EXACT_MATCH 1 | vinyl-fabric |
| chalk-effect-chalk-effect | 34 | EXACT_MATCH 34 | chalk-effect, chalk-effect-varnish |
| cleaners-air-duster | 1 | EXACT_MATCH 1 | air-duster |
| cleaners-brake-cleaner | 1 | EXACT_MATCH 1 | brake-cleaner |
| cleaners-carburetor-cleaner | 1 | EXACT_MATCH 1 | carburetor-cleaner |
| cleaners-contact-cleaner | 1 | EXACT_MATCH 1 | contact-cleaner |
| cleaners-paint-remover | 1 | EXACT_MATCH 1 | paint-remover |
| cleaners-sticker-glue-remover | 1 | EXACT_MATCH 1 | sticker-glue-remover |
| cleaners-textile-cleaner | 1 | EXACT_MATCH 1 | textile-cleaner |
| easy-max-easy-max | 52 | EXACT_MATCH 52 | easy-max, easy-max-metallics, easy-max-glitter, easy-max-marble-effect, easy-max-granite-effect, easy-max-sand-effect |
| effect-chrome-effect | 1 | EXACT_MATCH 1 | effect |
| effect-gold-effect | 1 | EXACT_MATCH 1 | effect |
| fast-acrylic-fast-acrylic | 29 | EXACT_MATCH 29 | fast-acrylic, fast-acrylic-metallics |
| flame-blue-flame-blue | 120 | EXACT_MATCH 120 | flame-blue, flame-blue-metallics |
| flame-booster-flame-booster | 2 | EXACT_MATCH 2 | flame-booster, flame-booster-metallic |
| flame-orange-flame-orange | 134 | EXACT_MATCH 134 | flame-orange, flame-orange-metallics |
| fluorescent-marking-fluorescent-paint | 4 | EXACT_MATCH 4 | fluorescent |
| fluorescent-marking-forest-trail-marking | 5 | EXACT_MATCH 3, LEGACY_LOCAL_ONLY 2 | forest-marking |
| fluorescent-marking-road-construction-marking | 4 | EXACT_MATCH 4 | road-marking |
| high-heat-700-c-high-heat-700-c | 5 | EXACT_MATCH 5 | high-heat |
| home-paint-for-aluminiums | 1 | EXACT_MATCH 1 | paint-aluminums |
| home-porcelain-paint | 1 | EXACT_MATCH 1 | porcelain-paint |
| home-power-glue | 1 | EXACT_MATCH 1 | power-glue |
| home-radiator-lacquer | 2 | EXACT_MATCH 1, LEGACY_LOCAL_ONLY 1 | radiator-lacquer |
| home-white-smalto | 1 | EXACT_MATCH 1 | white-smalto |
| lubricants-anti-spatter | 1 | EXACT_MATCH 1 | anti-spatter |
| lubricants-grease | 4 | EXACT_MATCH 4 | lithium-grease, chain-grease, lithium-grease-ptfe, copper-grease |
| lubricants-leak-detector | 1 | EXACT_MATCH 1 | leak-detector |
| lubricants-lubricants | 1 | EXACT_MATCH 1 | vaseline-spray |
| lubricants-multimax-1000 | 1 | EXACT_MATCH 1 | multimax |
| lubricants-oil | 6 | EXACT_MATCH 6 | silicone-oil, penetrating-oil, penetrating-ptfe, dry-ptfe, cut-drill-oil, rust-shock-freeze-penetrating-oil |
| master-mechanic-antigravel-paintable | 3 | EXACT_MATCH 3 | master-mechanic-13-antigravel-paintable |
| master-mechanic-brake-caliper-paint | 3 | EXACT_MATCH 3 | master-mechanic-15-brake-caliper-paint |
| master-mechanic-bumper-paint | 2 | EXACT_MATCH 2 | master-mechanic-bumber-paint-11 |
| master-mechanic-clear-coat | 1 | EXACT_MATCH 1 | master-mechanic-20-clear-coat |
| master-mechanic-control-guide | 1 | EXACT_MATCH 1 | master-mechanic-control-guide-06 |
| master-mechanic-epoxy-primer | 1 | EXACT_MATCH 1 | master-mechanic-epoxy-primer |
| master-mechanic-filler | 2 | EXACT_MATCH 2 | master-mechanic-filler-02 |
| master-mechanic-heat-resistant-paint | 2 | EXACT_MATCH 2 | master-mechanic-heat-resistant-paint-12 |
| master-mechanic-plastic-primer | 1 | EXACT_MATCH 1 | master-mechanic-plastic-primer |
| master-mechanic-primer | 2 | EXACT_MATCH 2 | master-mechanic-primer-01 |
| master-mechanic-ral | 5 | EXACT_MATCH 5 | master-mechanic-ral-paint |
| master-mechanic-wash-primer | 1 | EXACT_MATCH 1 | master-mechanic-wash-primer |
| master-mechanic-wheel-paint | 2 | EXACT_MATCH 2 | master-mechanic-14-wheel-paint |
| metallic-metallic-effect | 5 | EXACT_MATCH 4, LEGACY_LOCAL_ONLY 1 | metallic |
| molotow-burner-molotow-burner | 7 | LEGACY_LOCAL_ONLY 7 | — |
| molotow-premium-molotow-premium | 66 | LEGACY_LOCAL_ONLY 66 | — |
| primers-acrylic-primer-filler | 2 | EXACT_MATCH 2 | acrylic-primer |
| primers-metal-primer | 4 | EXACT_MATCH 4 | metal-primer |
| primers-plastic-primer | 1 | EXACT_MATCH 1 | plastic-primer |
| primers-special-metal-primer | 2 | EXACT_MATCH 2 | special-metal-primer |
| putties-fiberglass | 2 | EXACT_MATCH 1, HIGH_CONFIDENCE 1 | fiberglass |
| putties-filler | 3 | EXACT_MATCH 3 | metal-polyester-putty, marble-filler, fiber-glass-putty |
| putties-putty | 1 | EXACT_MATCH 1 | acrylic-putty |
| ral-ral | 60 | EXACT_MATCH 59, UNKNOWN 1 | ral-metallics, ral |
| sealer-sealer | 4 | EXACT_MATCH 4 | sealer |
| spray-bike-spray-bike | 88 | EXACT_MATCH 78, HIGH_CONFIDENCE 9, LEGACY_LOCAL_ONLY 1 | spray-bike, spray-bike-frame-builder-s-400-transparent-finish-gloss, spray-bike-frame-builder-s-401-transparent-finish-matte, spray-bike-frame-builder-s-410-frame-builder’s-putty, spray-bike-frame-builder-s-420-carbon-primer, spray-bike-frame-builder-s-430-metal-primer, spray-bike-frame-builder-s-440-cold-zinc, spray-bike-frame-builder-s-450-top-wax, spray-bike-frame-builder-s-metal-plating, spray-bike-keirin |
| varnishes-varnish | 5 | EXACT_MATCH 5 | metal-varnish, tinted-wood-varnish |
| w-wood-care-varnish | 8 | EXACT_MATCH 8 | w-container, w-varnish |
| wheel-rim-wheel-rim | 4 | EXACT_MATCH 4 | wheel-rim-deluxe, wheel-rim |
| wood-putties-water-based-wood-putty | 18 | EXACT_MATCH 18 | wood-putties |
| zinc-zinc | 2 | EXACT_MATCH 2 | zinc-maximum, alu-zinc |

## Zvanični proizvodi bez lokalne kartice

- `name:acryl-fresh` — 1 stranica (acrylic-paints)
- `name:plastic-paint-fresh` — 1 stranica (plastic-paints)
- `name:sportpens-standard` — 10 stranica (sportpens)
- `name:wood-glue-crystalise` — 3 stranica (wood-glue)
- `name:chrome-effect` — 1 stranica (effect)
- `effect-container` — 1 stranica (effect)
- `high-heat-container` — 3 stranica (high-heat)
- `acrylic-varnish` — 3 stranica (varnish)
- `wood-varnish` — 2 stranica (varnish)
