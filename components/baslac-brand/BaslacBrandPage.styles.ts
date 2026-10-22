import base from "./BaslacBrandPage.module.css";
import desktop from "./BaslacBrandPage.desktop.module.css";
import mobile from "./BaslacBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase BaslacBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
