import base from "./BefarBrandPage.module.css";
import desktop from "./BefarBrandPage.desktop.module.css";
import mobile from "./BefarBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase BefarBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
