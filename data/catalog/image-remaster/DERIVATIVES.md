# Derivati za prikaz — tačan spisak

GENERISANO: `node scripts/catalog/image-remaster/report.mjs`. Original se NIKAD ne menja;
PDP scena i kartice crtaju derivat iz `public/remastered/` (`lib/productImageDisplay.ts`).

Fajlova: **65**, mapiranih derivata: **65**, operacija ukupno: **70**.

| operacija | broj fajlova |
| --- | --- |
| senka za beli papir → tamna (`shadow-premultiply`) | 47 |
| svetao rub očišćen (`defringe`) | 11 |
| okvir platna uklonjen (`clear-edge-frame`) | 10 |
| stepenasta alfa izglađena (`antialias-mask`) | 2 |

Kombinacije (zbir = broj fajlova; preklapanje objašnjava zašto je zbir po operacijama veći):

| kombinacija | fajlova |
| --- | --- |
| shadow-premultiply | 44 |
| defringe | 9 |
| clear-edge-frame | 7 |
| clear-edge-frame + shadow-premultiply | 3 |
| antialias-mask + defringe | 2 |

| # | derivat | original | operacije | proizvodi (uloga) |
| --- | --- | --- | --- | --- |
| 1 | `/remastered/products/carfit/catalog/carfit-folding-paint-stand-premium.webp` | `/products/carfit/catalog/carfit-folding-paint-stand-premium.webp` | senka za beli papir → tamna | `carfit-folding-paint-stand-premium` (glavna) |
| 2 | `/remastered/products/carfit/catalog/carfit-rubber-sanding-block.webp` | `/products/carfit/catalog/carfit-rubber-sanding-block.webp` | svetao rub očišćen | `carfit-rubber-sanding-block` (glavna) |
| 3 | `/remastered/products/carfit/catalog/carfit-stirring-sticks.webp` | `/products/carfit/catalog/carfit-stirring-sticks.webp` | svetao rub očišćen | `carfit-stirring-sticks` (glavna) |
| 4 | `/remastered/products/carsystem/carsystem-git-elastic-weiss.png` | `/products/carsystem/carsystem-git-elastic-weiss.png` | senka za beli papir → tamna | `carsystem-git-elastic-weiss` (glavna) |
| 5 | `/remastered/products/carsystem/catalog/carsystem-2k-carbo-filler-transparent-1-0.webp` | `/products/carsystem/catalog/carsystem-2k-carbo-filler-transparent-1-0.webp` | svetao rub očišćen | `carsystem-2k-carbo-filler-transparent-1-0` (glavna) |
| 6 | `/remastered/products/carsystem/catalog/carsystem-2k-high-speed-klarlack.webp` | `/products/carsystem/catalog/carsystem-2k-high-speed-klarlack.webp` | senka za beli papir → tamna | `carsystem-2k-high-speed-klarlack` (glavna) |
| 7 | `/remastered/products/carsystem/catalog/carsystem-adapter-for-cps-paint-cup-systems.webp` | `/products/carsystem/catalog/carsystem-adapter-for-cps-paint-cup-systems.webp` | senka za beli papir → tamna | `carsystem-adapter-for-cps-paint-cup-systems` (glavna) |
| 8 | `/remastered/products/carsystem/catalog/carsystem-alu-spezial.webp` | `/products/carsystem/catalog/carsystem-alu-spezial.webp` | senka za beli papir → tamna | `carsystem-alu-spezial` (glavna) |
| 9 | `/remastered/products/carsystem/catalog/carsystem-anti-rust-putty.webp` | `/products/carsystem/catalog/carsystem-anti-rust-putty.webp` | senka za beli papir → tamna | `carsystem-anti-rust-putty` (glavna) |
| 10 | `/remastered/products/carsystem/catalog/carsystem-applicator.webp` | `/products/carsystem/catalog/carsystem-applicator.webp` | senka za beli papir → tamna | `carsystem-applicator` (glavna) |
| 11 | `/remastered/products/carsystem/catalog/carsystem-bumper-stand.webp` | `/products/carsystem/catalog/carsystem-bumper-stand.webp` | senka za beli papir → tamna | `carsystem-bumper-stand` (glavna) |
| 12 | `/remastered/products/carsystem/catalog/carsystem-c-wax-c-80.webp` | `/products/carsystem/catalog/carsystem-c-wax-c-80.webp` | svetao rub očišćen | `carsystem-c-wax-c-80` (glavna) |
| 13 | `/remastered/products/carsystem/catalog/carsystem-classic-coverall-pants.webp` | `/products/carsystem/catalog/carsystem-classic-coverall-pants.webp` | senka za beli papir → tamna | `carsystem-classic-coverall-pants` (glavna) |
| 14 | `/remastered/products/carsystem/catalog/carsystem-clear-coat-spray.webp` | `/products/carsystem/catalog/carsystem-clear-coat-spray.webp` | senka za beli papir → tamna | `carsystem-clear-coat-spray` (glavna) |
| 15 | `/remastered/products/carsystem/catalog/carsystem-coding-caps.webp` | `/products/carsystem/catalog/carsystem-coding-caps.webp` | senka za beli papir → tamna | `carsystem-coding-caps` (glavna) |
| 16 | `/remastered/products/carsystem/catalog/carsystem-control-spray.webp` | `/products/carsystem/catalog/carsystem-control-spray.webp` | svetao rub očišćen | `carsystem-control-spray` (glavna) |
| 17 | `/remastered/products/carsystem/catalog/carsystem-crash-film.webp` | `/products/carsystem/catalog/carsystem-crash-film.webp` | senka za beli papir → tamna | `carsystem-crash-film` (glavna) |
| 18 | `/remastered/products/carsystem/catalog/carsystem-ef-21-ep-filler.webp` | `/products/carsystem/catalog/carsystem-ef-21-ep-filler.webp` | svetao rub očišćen | `carsystem-ef-21-ep-filler` (glavna) |
| 19 | `/remastered/products/carsystem/catalog/carsystem-elastic-beige.webp` | `/products/carsystem/catalog/carsystem-elastic-beige.webp` | senka za beli papir → tamna | `carsystem-elastic-beige` (glavna) |
| 20 | `/remastered/products/carsystem/catalog/carsystem-elastic-green.webp` | `/products/carsystem/catalog/carsystem-elastic-green.webp` | senka za beli papir → tamna | `carsystem-elastic-green` (glavna) |
| 21 | `/remastered/products/carsystem/catalog/carsystem-faser.webp` | `/products/carsystem/catalog/carsystem-faser.webp` | senka za beli papir → tamna | `carsystem-faser` (glavna) |
| 22 | `/remastered/products/carsystem/catalog/carsystem-fill-putty.webp` | `/products/carsystem/catalog/carsystem-fill-putty.webp` | senka za beli papir → tamna | `carsystem-fill-putty` (glavna) |
| 23 | `/remastered/products/carsystem/catalog/carsystem-git-multi-green.webp` | `/products/carsystem/catalog/carsystem-git-multi-green.webp` | senka za beli papir → tamna | `carsystem-git-multi-green` (glavna) |
| 24 | `/remastered/products/carsystem/catalog/carsystem-glas-white.webp` | `/products/carsystem/catalog/carsystem-glas-white.webp` | senka za beli papir → tamna | `carsystem-glas-white` (glavna) |
| 25 | `/remastered/products/carsystem/catalog/carsystem-glas.webp` | `/products/carsystem/catalog/carsystem-glas.webp` | senka za beli papir → tamna | `carsystem-glas` (glavna) |
| 26 | `/remastered/products/carsystem/catalog/carsystem-glass-fibre-mat.webp` | `/products/carsystem/catalog/carsystem-glass-fibre-mat.webp` | okvir platna uklonjen | `carsystem-glass-fibre-mat` (glavna) |
| 27 | `/remastered/products/carsystem/catalog/carsystem-gun-clean-set.webp` | `/products/carsystem/catalog/carsystem-gun-clean-set.webp` | svetao rub očišćen | `carsystem-gun-clean-set` (glavna) |
| 28 | `/remastered/products/carsystem/catalog/carsystem-metallic.webp` | `/products/carsystem/catalog/carsystem-metallic.webp` | senka za beli papir → tamna | `carsystem-metallic` (glavna) |
| 29 | `/remastered/products/carsystem/catalog/carsystem-multi-green-glas-light.webp` | `/products/carsystem/catalog/carsystem-multi-green-glas-light.webp` | senka za beli papir → tamna | `carsystem-multi-green-glas-light` (glavna) |
| 30 | `/remastered/products/carsystem/catalog/carsystem-multi-green-glas.webp` | `/products/carsystem/catalog/carsystem-multi-green-glas.webp` | senka za beli papir → tamna | `carsystem-multi-green-glas` (glavna) |
| 31 | `/remastered/products/carsystem/catalog/carsystem-multi-green-plus-1-0-super-light.webp` | `/products/carsystem/catalog/carsystem-multi-green-plus-1-0-super-light.webp` | senka za beli papir → tamna | `carsystem-multi-green-plus-1-0-super-light` (glavna) |
| 32 | `/remastered/products/carsystem/catalog/carsystem-multi-green-rapid.webp` | `/products/carsystem/catalog/carsystem-multi-green-rapid.webp` | senka za beli papir → tamna | `carsystem-multi-green-rapid` (glavna) |
| 33 | `/remastered/products/carsystem/catalog/carsystem-multi-green-sf.webp` | `/products/carsystem/catalog/carsystem-multi-green-sf.webp` | senka za beli papir → tamna | `carsystem-multi-green-sf` (glavna) |
| 34 | `/remastered/products/carsystem/catalog/carsystem-multi-light.webp` | `/products/carsystem/catalog/carsystem-multi-light.webp` | senka za beli papir → tamna | `carsystem-multi-light` (glavna) |
| 35 | `/remastered/products/carsystem/catalog/carsystem-multi-plus.webp` | `/products/carsystem/catalog/carsystem-multi-plus.webp` | senka za beli papir → tamna | `carsystem-multi-plus` (glavna) |
| 36 | `/remastered/products/carsystem/catalog/carsystem-multi-silver-light.webp` | `/products/carsystem/catalog/carsystem-multi-silver-light.webp` | senka za beli papir → tamna | `carsystem-multi-silver-light` (glavna) |
| 37 | `/remastered/products/carsystem/catalog/carsystem-multi-soft.webp` | `/products/carsystem/catalog/carsystem-multi-soft.webp` | senka za beli papir → tamna | `carsystem-multi-soft` (glavna) |
| 38 | `/remastered/products/carsystem/catalog/carsystem-multi-super-flex.webp` | `/products/carsystem/catalog/carsystem-multi-super-flex.webp` | senka za beli papir → tamna | `carsystem-multi-super-flex` (glavna) |
| 39 | `/remastered/products/carsystem/catalog/carsystem-multi.webp` | `/products/carsystem/catalog/carsystem-multi.webp` | senka za beli papir → tamna | `carsystem-multi` (glavna) |
| 40 | `/remastered/products/carsystem/catalog/carsystem-orbital-sander-csh-cms01-kit.webp` | `/products/carsystem/catalog/carsystem-orbital-sander-csh-cms01-kit.webp` | okvir platna uklonjen | `carsystem-orbital-sander-csh-cms01-kit` (glavna) |
| 41 | `/remastered/products/carsystem/catalog/carsystem-paint-trolley-flexi-plus.webp` | `/products/carsystem/catalog/carsystem-paint-trolley-flexi-plus.webp` | okvir platna uklonjen; senka za beli papir → tamna | `carsystem-paint-trolley-flexi-plus` (glavna) |
| 42 | `/remastered/products/carsystem/catalog/carsystem-plastic-pro.webp` | `/products/carsystem/catalog/carsystem-plastic-pro.webp` | senka za beli papir → tamna | `carsystem-plastic-pro` (glavna) |
| 43 | `/remastered/products/carsystem/catalog/carsystem-polish-c-30-finish.webp` | `/products/carsystem/catalog/carsystem-polish-c-30-finish.webp` | svetao rub očišćen | `carsystem-polish-c-30-finish` (glavna) |
| 44 | `/remastered/products/carsystem/catalog/carsystem-polishing-pad-x1500-2.webp` | `/products/carsystem/catalog/carsystem-polishing-pad-x1500-2.webp` | senka za beli papir → tamna | `carsystem-polishing-pad-x1500` (galerija) |
| 45 | `/remastered/products/carsystem/catalog/carsystem-polishing-pad-x8000-2.webp` | `/products/carsystem/catalog/carsystem-polishing-pad-x8000-2.webp` | senka za beli papir → tamna | `carsystem-polishing-pad-x8000` (galerija) |
| 46 | `/remastered/products/carsystem/catalog/carsystem-polishing-pad-x8000.webp` | `/products/carsystem/catalog/carsystem-polishing-pad-x8000.webp` | senka za beli papir → tamna | `carsystem-polishing-pad-x8000` (glavna) |
| 47 | `/remastered/products/carsystem/catalog/carsystem-proflex-mercury.webp` | `/products/carsystem/catalog/carsystem-proflex-mercury.webp` | okvir platna uklonjen | `carsystem-proflex-mercury` (glavna) |
| 48 | `/remastered/products/carsystem/catalog/carsystem-proflex-neptune.webp` | `/products/carsystem/catalog/carsystem-proflex-neptune.webp` | okvir platna uklonjen | `carsystem-proflex-neptune` (glavna) |
| 49 | `/remastered/products/carsystem/catalog/carsystem-rallye-spray-premium-black-glossy.webp` | `/products/carsystem/catalog/carsystem-rallye-spray-premium-black-glossy.webp` | senka za beli papir → tamna | `carsystem-rallye-spray-premium-black-glossy` (glavna) |
| 50 | `/remastered/products/carsystem/catalog/carsystem-rallye-spray-premium-black-matt.webp` | `/products/carsystem/catalog/carsystem-rallye-spray-premium-black-matt.webp` | senka za beli papir → tamna | `carsystem-rallye-spray-premium-black-matt` (glavna) |
| 51 | `/remastered/products/carsystem/catalog/carsystem-rupes-orbital-sander-slp41a.webp` | `/products/carsystem/catalog/carsystem-rupes-orbital-sander-slp41a.webp` | okvir platna uklonjen | `carsystem-rupes-orbital-sander-slp41a` (glavna) |
| 52 | `/remastered/products/carsystem/catalog/carsystem-rupes-polishing-machine-lh19e.webp` | `/products/carsystem/catalog/carsystem-rupes-polishing-machine-lh19e.webp` | okvir platna uklonjen; senka za beli papir → tamna | `carsystem-rupes-polishing-machine-lh19e` (glavna) |
| 53 | `/remastered/products/carsystem/catalog/carsystem-rupes-polishing-machine-lhr75.webp` | `/products/carsystem/catalog/carsystem-rupes-polishing-machine-lhr75.webp` | okvir platna uklonjen; senka za beli papir → tamna | `carsystem-rupes-polishing-machine-lhr75` (glavna) |
| 54 | `/remastered/products/carsystem/catalog/carsystem-rupes-skorpio-e-rx.webp` | `/products/carsystem/catalog/carsystem-rupes-skorpio-e-rx.webp` | okvir platna uklonjen | `carsystem-rupes-skorpio-e-rx` (glavna) |
| 55 | `/remastered/products/carsystem/catalog/carsystem-rupes-vacuum-cleaner-s145.webp` | `/products/carsystem/catalog/carsystem-rupes-vacuum-cleaner-s145.webp` | okvir platna uklonjen | `carsystem-rupes-vacuum-cleaner-s145` (glavna) |
| 56 | `/remastered/products/carsystem/catalog/carsystem-spare-battery-5-0ah.webp` | `/products/carsystem/catalog/carsystem-spare-battery-5-0ah.webp` | svetao rub očišćen | `carsystem-spare-battery-5-0ah` (glavna) |
| 57 | `/remastered/products/carsystem/catalog/carsystem-tape-off-disc-premium-2.webp` | `/products/carsystem/catalog/carsystem-tape-off-disc-premium-2.webp` | senka za beli papir → tamna | `carsystem-tape-off-disc-premium` (galerija) |
| 58 | `/remastered/products/carsystem/catalog/carsystem-uv-filler-spray.webp` | `/products/carsystem/catalog/carsystem-uv-filler-spray.webp` | senka za beli papir → tamna | `carsystem-uv-filler-spray` (glavna) |
| 59 | `/remastered/products/carsystem/catalog/carsystem-x-stand-classic.webp` | `/products/carsystem/catalog/carsystem-x-stand-classic.webp` | senka za beli papir → tamna | `carsystem-x-stand-classic` (glavna) |
| 60 | `/remastered/products/carsystem/catalog/carsystem-x-stand-top.webp` | `/products/carsystem/catalog/carsystem-x-stand-top.webp` | senka za beli papir → tamna | `carsystem-x-stand-top` (glavna) |
| 61 | `/remastered/products/cosmos-lac/putties/cosmos-lac-putties-iron-filler.webp` | `/products/cosmos-lac/putties/cosmos-lac-putties-iron-filler.webp` | senka za beli papir → tamna | `cosmos-lac-putties-iron-filler` (glavna) |
| 62 | `/remastered/products/cosmos-lac/putties/cosmos-lac-putties-marble-adhesive-filler.webp` | `/products/cosmos-lac/putties/cosmos-lac-putties-marble-adhesive-filler.webp` | senka za beli papir → tamna | `cosmos-lac-putties-marble-adhesive-filler` (glavna) |
| 63 | `/remastered/products/cosmos-lac/putties/cosmos-lac-putties-polyester-putty-fiber-filler.webp` | `/products/cosmos-lac/putties/cosmos-lac-putties-polyester-putty-fiber-filler.webp` | senka za beli papir → tamna | `cosmos-lac-putties-polyester-putty-fiber-filler` (glavna) |
| 64 | `/remastered/products/rm/rm-pasta-190-1l.webp` | `/products/rm/rm-pasta-190-1l.webp` | stepenasta alfa izglađena; svetao rub očišćen | `rm-pasta-190-1l` (glavna) |
| 65 | `/remastered/products/rm/rm-pasta-190-5l.webp` | `/products/rm/rm-pasta-190-5l.webp` | stepenasta alfa izglađena; svetao rub očišćen | `rm-pasta-190-5l` (glavna) |
