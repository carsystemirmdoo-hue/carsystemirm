import base from "./RmBrandPage.module.css";
import desktop from "./RmBrandPage.desktop.module.css";
import mobile from "./RmBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase RmBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
