/** Da li link pokriva trenutnu stranu (deli ga desktop i mobilni meni). */
export function isPathActive(href: string, pathname: string) {
  const hrefPath = href.split(/[?#]/)[0] || "/";
  if (hrefPath === "/") return pathname === "/";
  if (hrefPath === "/katalog") {
    return pathname === "/katalog" || pathname.startsWith("/proizvodi/");
  }
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}
