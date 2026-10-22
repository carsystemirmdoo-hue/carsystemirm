import base from "./SataBrandPage.module.css";
import desktop from "./SataBrandPage.desktop.module.css";
import mobile from "./SataBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase SataBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
