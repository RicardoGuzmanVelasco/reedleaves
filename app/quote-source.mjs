export function normalizeQuoteSourceUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 2048) return null;
  try {
    const url=new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function validQuoteSourceUrl(value) {
  return typeof value === "string" && normalizeQuoteSourceUrl(value) === value;
}
