import base from "./FamilyBasePdp.module.css";
import desktop from "./FamilyBasePdp.desktop.module.css";
import mobile from "./FamilyBasePdp.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/**
 * Klase izbora porodice baza: zajednički izgled + desktop + mobilni raspored pod istim
 * imenom. Jedina ulazna tačka za ove stilove — redosled fajlova (zajednički, pa raspored)
 * mora biti isti na svakoj strani, inače mobilno pravilo može izgubiti od zajedničkog.
 */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
