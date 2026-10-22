import base from "./NorbinBrandPage.module.css";
import desktop from "./NorbinBrandPage.desktop.module.css";
import mobile from "./NorbinBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase NorbinBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
