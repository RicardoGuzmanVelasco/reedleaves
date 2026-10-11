import {isCanonicalLocale,LANGUAGES} from "./core.mjs";
import {bookLinkUrl,BOOK_LINK_PLATFORMS} from "./book-links.mjs";

export const TRANSLATION_FIELDS = {title:240,shortTitle:240,description:2000,editorialNote:500};
export function missingBookInformation(book) {
  const missing=[];
  for (const language of LANGUAGES) for (const field of ["title","shortTitle","description"]) {
    if (!book[field]?.[language]?.trim()) missing.push({field,language});
  }
  if (!book.genres?.length) missing.push({field:"genres"});
  return missing;
}
const object = value => value && typeof value === "object" && !Array.isArray(value);
function text(value,max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error("Invalid book metadata");
  return value.trim();
}
export function sourceUrl(value) {
  try {
    const url=new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") ||
        url.hostname === "localhost" || url.hostname.endsWith(".local") || /^[\d.]+$/.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
// Shared by preview generation and saving. Unknown fields never enter the catalog.
export function normalizeBookMetadata(value={}, {completeTranslations=true}={}) {
  if (!object(value)) throw new Error("Invalid book metadata");
  const result={title:{},shortTitle:{},description:{},editorialNote:{},genres:[],links:{},sources:[]};
  if (value.originalTitle !== undefined) result.originalTitle=text(value.originalTitle,240);
  if (value.originalLanguage !== undefined) {
    if (!isCanonicalLocale(value.originalLanguage)) throw new Error("Invalid book metadata");
    result.originalLanguage=value.originalLanguage;
  }
  const languages=new Set();
  for (const [field,max] of Object.entries(TRANSLATION_FIELDS)) {
    if (value[field] === undefined) continue;
    if (!object(value[field]) || Object.keys(value[field]).length > 4) throw new Error("Invalid book metadata");
    for (const [language,translation] of Object.entries(value[field])) {
      if (!isCanonicalLocale(language)) throw new Error("Invalid book metadata");
      if (!completeTranslations && typeof translation === "string" && !translation.trim()) continue;
      languages.add(language); result[field][language]=text(translation,max);
    }
  }
  // The existing translation tables store complete rows.
  if (completeTranslations) for (const language of LANGUAGES) if (languages.has(language)) for (const field of Object.keys(TRANSLATION_FIELDS)) {
    if (!result[field][language]) throw new Error("Incomplete book translation");
  }
  if (value.genres !== undefined) {
    if (!Array.isArray(value.genres) || value.genres.length > 20) throw new Error("Invalid book metadata");
    result.genres=[...new Set(value.genres.map(id=>text(id,80)))].sort();
  }
  if (value.links !== undefined) {
    if (!object(value.links) || Object.keys(value.links).some(key=>!BOOK_LINK_PLATFORMS.includes(key))) throw new Error("Invalid book metadata");
    for (const [platform,url] of Object.entries(value.links)) {
      const valid=bookLinkUrl(platform,url);
      if (!valid) throw new Error("Invalid book metadata");
      result.links[platform]=valid;
    }
  }
  if (value.sources !== undefined) {
    if (!Array.isArray(value.sources) || value.sources.length > 10) throw new Error("Invalid book metadata");
    const seen=new Set();
    for (const source of value.sources) {
      if (!object(source)) throw new Error("Invalid book metadata");
      const url=sourceUrl(text(source.url,2048)),title=text(source.title,240);
      if (!url) throw new Error("Invalid book metadata");
      if (!seen.has(url)) { result.sources.push({title,url}); seen.add(url); }
    }
  }
  return result;
}

export function mergeBookMetadata(current,proposal) {
  const next=normalizeBookMetadata(current,{completeTranslations:false}),generated=normalizeBookMetadata(proposal);
  for (const field of ["originalTitle","originalLanguage"]) next[field] ||= generated[field];
  for (const field of Object.keys(TRANSLATION_FIELDS)) next[field]={...generated[field],...next[field]};
  if (!next.genres.length) next.genres=generated.genres;
  next.links={...generated.links,...next.links};
  next.sources=[...next.sources,...generated.sources.filter(s=>!next.sources.some(existing=>existing.url===s.url))].slice(0,10);
  return normalizeBookMetadata(next);
}
