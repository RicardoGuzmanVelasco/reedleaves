export const BOOK_LINK_PLATFORMS = ["amazon", "goodreads"];

// Restrict editorial links to actual book pages, not arbitrary sites or redirects.
export function bookLinkUrl(platform, value) {
  if (typeof value !== "string" || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    if (platform === "amazon" && ["www.amazon.es", "www.amazon.com", "www.amazon.fr", "www.amazon.de", "www.amazon.it", "www.amazon.co.uk"].includes(url.hostname) && /^\/dp\/[A-Z0-9]{10}\/?$/.test(url.pathname)) return url.href;
    if (platform === "goodreads" && url.hostname === "www.goodreads.com" && /^\/(?:en\/)?book\/show\/[1-9]\d*(?:[._-][^/]+)?\/?$/.test(url.pathname)) return url.href;
  } catch {}
  return null;
}

export function validateBookLinks(links, {required = false} = {}) {
  if (links === undefined && !required) return;
  if (!links || typeof links !== "object" || Array.isArray(links) ||
      Object.keys(links).some(platform => !BOOK_LINK_PLATFORMS.includes(platform))) throw new Error("Invalid book links");
  for (const platform of BOOK_LINK_PLATFORMS) {
    if ((required || links[platform] !== undefined) && !bookLinkUrl(platform, links[platform])) throw new Error("Invalid or missing book link: " + platform);
  }
  return links;
}
