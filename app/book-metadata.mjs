import {isCanonicalLocale,LANGUAGES,TITLE_MAX_LENGTH,DESCRIPTION_MAX_LENGTH,EDITORIAL_NOTE_MAX_LENGTH} from "./core.mjs";
import {bookLinkUrl,BOOK_LINK_PLATFORMS} from "./book-links.mjs";

export const TRANSLATION_FIELDS = {title:TITLE_MAX_LENGTH,description:DESCRIPTION_MAX_LENGTH,editorialNote:EDITORIAL_NOTE_MAX_LENGTH};
export function missingBookInformation(book) {
  const missing=[];
  for (const language of LANGUAGES) for (const field of ["description"]) {
    if (!book[field]?.[language]?.trim()) missing.push({field,language});
  }
  if (!book.genres?.length) missing.push({field:"genres"});
  return missing;
}
const object = value => value && typeof value === "object" && !Array.isArray(value);
function text(value,max,required=true) {
  if (typeof value !== "string" || required && !value.trim() || value.trim().length > max) throw new Error("Invalid book metadata");
  return value.trim();
}
// Shared by preview generation and saving. Unknown fields never enter the catalog.
export function normalizeBookMetadata(value={}, {completeTranslations=true,canonicalTitles=false}={}) {
  if (!object(value)) throw new Error("Invalid book metadata");
  const result={title:{},description:{},editorialNote:{},genres:[],links:{}};
  if (value.popularTitle !== undefined) result.popularTitle=text(value.popularTitle,TITLE_MAX_LENGTH);
  if (value.popularLanguage !== undefined) {
    if (!isCanonicalLocale(value.popularLanguage)) throw new Error("Invalid book metadata");
    result.popularLanguage=value.popularLanguage;
  }
  const languages=new Set();
  for (const [field,max] of Object.entries(TRANSLATION_FIELDS)) {
    if (value[field] === undefined) continue;
    if (!object(value[field]) || Object.keys(value[field]).length > 4) throw new Error("Invalid book metadata");
    for (const [language,translation] of Object.entries(value[field])) {
      if (!isCanonicalLocale(language)) throw new Error("Invalid book metadata");
      if (field !== "title" && !completeTranslations && typeof translation === "string" && !translation.trim()) continue;
      languages.add(language); result[field][language]=text(translation,max,field !== "title");
    }
  }
  // A preferred title is optional; the popular title is the display fallback.
  if (completeTranslations) for (const language of new Set([...LANGUAGES.filter(language=>languages.has(language)),...Object.keys(result.title)])) {
    for (const field of ["description","editorialNote"]) if (!result[field][language]) throw new Error("Incomplete book translation");
    result.title[language] ||= "";
  }
  if(canonicalTitles) for (const language of Object.keys(result.title)) if (result.title[language] === result.popularTitle) result.title[language]="";
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
  return result;
}

export function mergeBookMetadata(current,proposal) {
  const next=normalizeBookMetadata(current,{completeTranslations:false}),generated=normalizeBookMetadata(proposal);
  for (const field of ["popularTitle","popularLanguage"]) next[field] ||= generated[field];
  for (const field of Object.keys(TRANSLATION_FIELDS)) next[field]={...generated[field],...next[field]};
  if (!next.genres.length) next.genres=generated.genres;
  next.links={...generated.links,...next.links};
  return normalizeBookMetadata(next,{canonicalTitles:true});
}
