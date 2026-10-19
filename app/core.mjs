export const LANGUAGES = ["es", "en"];
export const CONTENT_LANGUAGES = ["es", "en"];
export const INVITE_CODE_MIN_LENGTH = 12;

export function restoreLanguage(saved) {
  return LANGUAGES.includes(saved) ? saved : "es";
}

export function isCanonicalLocale(language) {
  try { return typeof language === "string" && language.length <= 35 && Intl.getCanonicalLocales(language)[0] === language; }
  catch { return false; }
}

export function contentText(translations, interfaceLanguage, deckLanguage = interfaceLanguage) {
  const entries = Object.entries(translations || {}).filter(([,text]) => typeof text === "string" && text.trim());
  return translations?.[interfaceLanguage] ||
    entries.find(([language]) => language.split("-")[0] === interfaceLanguage)?.[1] ||
    translations?.[deckLanguage] ||
    entries.find(([language]) => language.split("-")[0] === deckLanguage.split("-")[0])?.[1] ||
    entries[0]?.[1] || "";
}

export function quoteExcerpt(body) {
  const characters = Array.from(body.trim().replace(/\s+/g," "));
  return characters.length > 80 ? characters.slice(0,77).join("") + "…" : characters.join("");
}

export function contentLocale(translations, interfaceLanguage, deckLanguage = interfaceLanguage) {
  const entries = Object.entries(translations || {}).filter(([,text]) => typeof text === "string" && text.trim());
  if (translations?.[interfaceLanguage]) return interfaceLanguage;
  const interfaceMatch = entries.find(([language]) => language.split("-")[0] === interfaceLanguage);
  if (interfaceMatch) return interfaceMatch[0];
  if (translations?.[deckLanguage]) return deckLanguage;
  return entries.find(([language]) => language.split("-")[0] === deckLanguage.split("-")[0])?.[0] || entries[0]?.[0] || deckLanguage;
}

export function bookTitle(book, interfaceLanguage, {original = false, short = false} = {}) {
  if (original && book.originalTitle) return {text:book.originalTitle, language:book.originalLanguage};
  const translations = short ? book.shortTitle : book.title;
  return {text:contentText(translations,interfaceLanguage,book.originalLanguage) || book.originalTitle,
    language:contentLocale(translations,interfaceLanguage,book.originalLanguage)};
}

export function bookCoverTitle(book, interfaceLanguage, {original = false} = {}) {
  const full=bookTitle(book,interfaceLanguage,{original});
  if (original) return full;
  const short=book.shortTitle?.[full.language]?.trim() || full.text;
  const abbreviated=Array.from(short).length < Array.from(full.text).length;
  return {text:short + (abbreviated && !/(?:…|\.{3})$/u.test(short) ? "…" : ""),language:full.language};
}

export function validateBook(book, requiredLanguages = ["es", "en"], {requireOriginal = false} = {}) {
  if (!book || book.schemaVersion !== 1 || typeof book.id !== "string" || !book.id.trim() ||
      typeof book.author !== "string" || !book.author.trim()) throw new Error("Invalid book");
  if (book.genres !== undefined && (!Array.isArray(book.genres) || book.genres.some(id => typeof id !== "string" || !id.trim()))) throw new Error("Invalid genres");
  if (requireOriginal || book.originalTitle !== undefined || book.originalLanguage !== undefined) {
    if (typeof book.originalTitle !== "string" || !book.originalTitle.trim() || !isCanonicalLocale(book.originalLanguage)) throw new Error("Invalid original book title or language");
  }
  const fields = ["title","shortTitle","description","editorialNote"];
  if (book.creatorUserId != null) {
    if (typeof book.creatorUserId !== "string" || !book.creatorUserId.trim() || !isCanonicalLocale(book.originalLanguage)) throw new Error("Invalid book owner");
    for (const field of fields) {
      for (const [language,value] of Object.entries(book[field] || {})) {
        if (!isCanonicalLocale(language) || typeof value !== "string" || !value.trim()) throw new Error("Invalid book translation");
      }
    }
    if (!book.title?.[book.originalLanguage]?.trim() || !book.shortTitle?.[book.originalLanguage]?.trim()) throw new Error("Missing book title");
    return book;
  }
  for (const field of fields) {
    for (const language of requiredLanguages) {
      if (!isCanonicalLocale(language)) throw new Error("Invalid book language");
      if (typeof book[field]?.[language] !== "string" || !book[field][language].trim()) throw new Error("Missing book translation");
    }
    for (const [language,value] of Object.entries(book[field] || {})) {
      if (!isCanonicalLocale(language) || typeof value !== "string" || !value.trim()) throw new Error("Invalid book translation");
    }
  }
  return book;
}

export function parseCards(text, bookId) {
  const cards = text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  return validateCards(cards, bookId);
}

export function validateCards(cards, bookId, {allowEmpty = false} = {}) {
  if (!Array.isArray(cards) || !allowEmpty && !cards.length) throw new Error("No cards");
  const byId = new Map();
  const orders = new Set();
  for (const card of cards) {
    if (!card || typeof card.id !== "string" || !card.id.trim() || byId.has(card.id)) throw new Error("Invalid or duplicate ID");
    if (card.isQuote !== undefined && typeof card.isQuote !== "boolean") throw new Error("Invalid quote tag");
    if (card.bookId !== bookId) throw new Error("Wrong book");
    if (card.parentId !== null && (typeof card.parentId !== "string" || !card.parentId)) throw new Error("Invalid parent");
    if (!Number.isInteger(card.order) || card.order < 1) throw new Error("Invalid order");
    const orderKey = JSON.stringify([card.parentId, card.order]);
    if (orders.has(orderKey)) throw new Error("Duplicate sibling order");
    orders.add(orderKey);
    const titleLanguages = Object.keys(card.title || {}), bodyLanguages = Object.keys(card.body || {});
    if (!titleLanguages.length || titleLanguages.some(language => !isCanonicalLocale(language) ||
        typeof card.title[language] !== "string" || !card.title[language].trim() ||
        typeof card.body?.[language] !== "string" || !card.body[language].trim()) ||
        bodyLanguages.length !== titleLanguages.length || bodyLanguages.some(language => !titleLanguages.includes(language))) throw new Error("Missing or invalid card-language translation");
    byId.set(card.id, card);
  }
  for (const card of cards) {
    if (card.parentId !== null && !byId.has(card.parentId)) throw new Error("Missing parent");
    const chain = new Set([card.id]);
    let parent = card.parentId;
    while (parent !== null) {
      if (chain.has(parent)) throw new Error("Cycle");
      chain.add(parent);
      parent = byId.get(parent).parentId;
    }
  }
  const children = new Map();
  for (const card of cards) {
    if (!children.has(card.parentId)) children.set(card.parentId, []);
    children.get(card.parentId).push(card);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.order - b.order);
  return { cards, byId, children, roots: children.get(null) || [] };
}

export function localDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function selectDaily(roots, day, saved, random = Math.random) {
  if (!roots.length) return null;
  if (saved?.day === day && roots.some(card => card.id === saved.id)) return { day, id: saved.id };
  const index = Math.min(roots.length - 1, Math.max(0, Math.floor(random() * roots.length)));
  return { day, id: roots[index].id };
}
