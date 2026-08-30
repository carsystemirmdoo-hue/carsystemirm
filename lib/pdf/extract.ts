import "server-only";

/**
 * Serverska granica nad čitanjem PDF-a.
 *
 * Implementacija je u `parseDocument.ts` i namerno je bez `server-only`, da bi
 * isti parser mogao da se pokrene i lokalno na kancelarijskom računaru. Ovaj
 * fajl postoji da postojeći serverski pozivaoci zadrže granicu koju su imali:
 * `server-only` ovde i dalje sprečava da parsiranje slučajno završi u klijentu.
 *
 * Ne dodavati logiku ovde. Sve što oba ulaza dele živi u `parseDocument.ts`.
 */
export { fileHashOf, parseBiznisoftPdf } from "./parseDocument";
export type { ExtractedField, ParsedDocument, ParsedLine } from "./parseDocument";
