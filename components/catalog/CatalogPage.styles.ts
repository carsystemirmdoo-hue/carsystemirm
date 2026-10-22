import base from "./CatalogPage.module.css";
import desktop from "./CatalogPage.desktop.module.css";
import mobile from "./CatalogPage.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase CatalogPage: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
