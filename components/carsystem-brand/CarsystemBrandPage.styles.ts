import base from "./CarsystemBrandPage.module.css";
import desktop from "./CarsystemBrandPage.desktop.module.css";
import mobile from "./CarsystemBrandPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase CarsystemBrandPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
