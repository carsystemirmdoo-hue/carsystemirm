import base from "./CarfitBrandPage.module.css";
import desktop from "./CarfitBrandPage.desktop.module.css";
import mobile from "./CarfitBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase CarfitBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
