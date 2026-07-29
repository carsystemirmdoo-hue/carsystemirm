# SEO cannibalization izveštaj

Nije korišćen niti izmišljen search volume. Target odluke su hipoteze zasnovane na arhitekturi i vidljivom sadržaju sajta.

| Tema | Konkurentski URL-ovi | Primary URL | Izmena | Internal-link odluka |
| --- | --- | --- | --- | --- |
| R-M proizvodi | /brendovi/rm, /katalog?brend=rm | /brendovi/rm | filter je noindex i canonical na /katalog; brand dobija jedinstven title/content | katalog/footer vode na brand za brand intent |
| bezbojni lakovi | /kategorije/bezbojni-lakovi, /program/boje-i-lakovi, pojedinačni PDP | /kategorije/bezbojni-lakovi za generički intent | category dobija uređenu kopiju; program objašnjava proces; PDP cilja naziv/kod | category vodi na PDP, PDP breadcrumb vodi na category |
| priprema/prajmeri | /kategorije/prajmeri-i-punioci, /program/priprema-i-abrazivi | category za proizvodni tip, program za proces | title/H1 i sadržaj razdvojeni po intent-u | uzajamne veze kroz proizvode, bez cross-canonical-a |
| AGILIS | /brendovi/rm, AGILIS PDP-ovi, query sistemi | /brendovi/rm za sistemski pregled; PDP za tačan kod | query filter noindex; svaki PDP jedinstven | R-M landing vodi ka AGILIS proizvodima, PDP nazad ka brandu |
| DIAMONT | /brendovi/rm, DIAMONT bazna boja PDP, DIAMONT clear PDP | PDP za tačan proizvod, R-M landing za sistem | nema canonical spajanja različitih proizvoda | relevantni related-product linkovi |
| program boje i lakovi | /program/boje-i-lakovi, /katalog, kategorije | /program/boje-i-lakovi za workflow intent | katalog ostaje širok komercijalni pregled | program vodi na kategorije/PDP |
| kontakt | /kontakt i query prefill URL-ovi | /kontakt | svi query prefill URL-ovi noindex i canonical na čistu rutu | CTA može da zadrži query radi UX-a |
| H 2P15 duplikat | dva istorijska source foldera i dve moguće putanje | /proizvodi/h-2p15-clear-harden-r | jedna putanja je 308 redirect; drugi PDP nije generisan | svi linkovi koriste canonical slug |

## ProductGroup odluka

ProductGroup nije uveden. Dostavljenih 59 zapisa predstavlja 59 funkcionalno različitih proizvoda sa sopstvenim kodom, vidljivim sadržajem i dokumentacijom. Jedini potvrđeni source duplikat, H 2P15, konsolidovan je na jedan PDP i redirect. Promena na ProductGroup ima smisla tek ako poslovni podaci potvrde prave varijante istog proizvoda.
