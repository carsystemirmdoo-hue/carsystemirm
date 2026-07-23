# Paint takeover technical proof

Izolovani proof na `/interaction-demo/paint-takeover` proverava scroll-driven
SVG sistem pre izrade finalnog artworka i pre bilo kakve produkcione integracije.

## Struktura

- `PaintTakeoverArtwork.tsx` sadrži tačno 18 top-level `.paint-stroke` grupa.
- `paintTakeoverConfig.ts` eksplicitno definiše start, end, easing, ulaznu
  transformaciju i reveal metod svake grupe.
- `usePaintTakeover.ts` računa normalizovani progress iz geometrije spoljašnje
  sekcije i upisuje stilove u jednom `requestAnimationFrame` ciklusu.
- `PaintTakeoverSection.module.css` drži sticky kadar, tipografiju, responsive
  kompoziciju i reduced-motion fallback.

## Porodice poteza

| ID | Porodica | Reveal |
| --- | --- | --- |
| 01–03 | broad-brush | directional SVG mask |
| 04–05 | dry-brush | fragmentisana SVG maska |
| 06–07 | curved-sweep | mask path sa dash reveal-om |
| 08–09 | thin-flick | pathLength i stroke-dashoffset |
| 10–11 | scratch | pathLength i stroke-dashoffset |
| 12–13 | spray-cloud | scale, opacity i translacija |
| 14–15 | spray-burst | tri vremenski pomerene podgrupe |
| 16–17 | splatter | tri vremenski pomerene podgrupe |
| 18 | mist | spora opacity i drift promena |

## Dijagnostika

`/interaction-demo/paint-takeover?debug=1` prikazuje progress, fazu, broj
aktivnih grupa i reduced-motion status. Panel se ne renderuje bez parametra.

## Phase 2 correction

- Scroll geometrija koristi stvarnu visinu sticky viewporta, pa promena mobilnog
  browser chrome-a više ne menja progress denominator usred kadra.
- Svetli prilaz prelazi u veliku zakrivljenu tamnu masu sa fragmentisanim
  pigmentnim rubom; obojena linija više nije kontura takeover siluete.
- Potezi ulaze sa sve četiri ivice, nekoliko njih prelazi gotovo čitavu širinu,
  a kompozicija nema zajedničku tačku iz koje elementi zrače.
- Noseći potezi imaju eksplicitne praznine, vlakna, različitu gustinu i
  isprekidane rubove umesto neon traka i punih geometrijskih silueta.
- Spray cloud, burst i splatter grupe imaju gušći raspon kapljica i nepravilne
  organske čestice, male drips i overspray, bez dodavanja novih top-level grupa.

### Korekcija trzaja oko 0.426

Pre korekcije su `proof-stroke-05` i odmah zatim `proof-stroke-07` menjali
masku, transformaciju i opacity tokom istog kratkog intervala. Quint-out easing
je zato ubrzavao veliku vidljivu površinu, a `proof-stroke-13` je dodatno
skalirao i roditeljsku i unutrašnju cloud grupu.

Reveal i motion progress su sada odvojeni. Grupe koje se otkrivaju maskom ili
stroke-draw logikom imaju stabilnu geometriju (`transform: none`), maska koristi
monotoni smoothstep progress, a cloud se skalira samo na roditeljskoj grupi.
Debug progress se prikazuje sa četiri decimale. Sticky geometrija se meri samo
pri inicijalizaciji i resize događaju.

## Ograničenja proofa

Ovo nije finalni artwork. Potezi su reprezentativni i služe proveri maski,
sequencing-a, reverse scroll-a, responsive ponašanja i cleanup-a. Produkcioni
homepage, globalna tema, header, footer i navigacioni rail nisu povezani sa
proofom.
