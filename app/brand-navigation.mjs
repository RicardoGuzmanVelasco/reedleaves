export function updateBrandNavigation(brand, signedIn, homeLabel) {
  if (signedIn) {
    brand.removeAttribute("href");
    brand.setAttribute("role", "img");
    brand.setAttribute("aria-label", "Reedleaves");
    return;
  }

  brand.setAttribute("href", "#home");
  brand.removeAttribute("role");
  brand.setAttribute("aria-label", homeLabel);
}
