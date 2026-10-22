import base from "./CosmosBrandPage.module.css";
import desktop from "./CosmosBrandPage.desktop.module.css";
import mobile from "./CosmosBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase CosmosBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
