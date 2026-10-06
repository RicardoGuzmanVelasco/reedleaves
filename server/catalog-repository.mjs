import { validateBook, validateCards, LANGUAGES } from "../app/core.mjs";
import { validateBookLinks } from "../app/book-links.mjs";

export function readCatalog(db) {
  const genres = db.prepare("SELECT id FROM genres ORDER BY id").all().map(({ id }) => {
    const name = Object.fromEntries(db.prepare("SELECT language, name FROM genre_translations WHERE genre_id = ?").all(id).map(t => [t.language, t.name]));
    return { id, name };
  });
  const books = db.prepare("SELECT id, author, original_title, original_language, editorial_status FROM books ORDER BY position").all().map(row => {
    const book = { schemaVersion: 1, id: row.id, author: row.author, editorialStatus: row.editorial_status,
      originalTitle: row.original_title, originalLanguage: row.original_language,
      title: {}, shortTitle: {}, description: {}, editorialNote: {},
      links: Object.fromEntries(db.prepare("SELECT platform,url FROM book_links WHERE book_id = ? ORDER BY platform").all(row.id).map(link => [link.platform, link.url])),
      genres: db.prepare("SELECT genre_id FROM book_genres WHERE book_id = ? ORDER BY genre_id").all(row.id).map(t => t.genre_id),
      sources: db.prepare("SELECT title, url FROM sources WHERE book_id = ? ORDER BY id").all(row.id).map(t => ({ ...t })) };
    for (const t of db.prepare("SELECT * FROM book_translations WHERE book_id = ?").all(row.id)) {
      book.title[t.language] = t.title;
      book.shortTitle[t.language] = t.short_title;
      book.description[t.language] = t.description;
      book.editorialNote[t.language] = t.editorial_note;
    }
    validateBookLinks(book.links, {required:true});
    return validateBook(book, LANGUAGES, {requireOriginal:true});
  });
  const cards = db.prepare(`SELECT c.*, d.deck_id, deck.language AS deck_language, s.url FROM cards c
    JOIN deck_versions d ON d.id = c.version_id JOIN decks deck ON deck.id = d.deck_id JOIN sources s ON s.id = c.source_id
    JOIN books b ON b.id = c.book_id ORDER BY b.position,d.deck_id,d.version,c.position,c.id`).all().map(row => {
    const card = { id:row.id, bookId:row.book_id, deckId:row.deck_id, versionId:row.version_id, deckLanguage:row.deck_language,
      parentId:row.parent_id, order:row.position, sourceUrl:row.url, title:{}, body:{} };
    for (const t of db.prepare("SELECT language,title,body FROM card_translations WHERE card_id = ?").all(row.id)) {
      card.title[t.language] = t.title; card.body[t.language] = t.body;
    }
    return card;
  });
  const decks = db.prepare(`SELECT d.*,u.display_name FROM decks d
    JOIN users u ON u.id = d.creator_user_id ORDER BY d.book_id,d.is_recommended DESC,d.id`).all().map(row => ({
    id:row.id,bookId:row.book_id,language:row.language,isRecommended:!!row.is_recommended,
    creator:{ kind:"user",userId:row.creator_user_id,name:row.display_name || null },
    metrics: {
      likes:db.prepare("SELECT count(*) AS n FROM deck_votes WHERE deck_id = ? AND value = 1").get(row.id).n,
      dislikes:db.prepare("SELECT count(*) AS n FROM deck_votes WHERE deck_id = ? AND value = -1").get(row.id).n,
      startedBy:db.prepare(`SELECT count(DISTINCT r.user_id) AS n FROM reviews r
        JOIN deck_versions v ON v.id = r.version_id WHERE v.deck_id = ?`).get(row.id).n,
      completedBy:db.prepare(`SELECT count(DISTINCT r.user_id) AS n FROM reviews r
        JOIN deck_versions v ON v.id = r.version_id WHERE v.deck_id = ? AND r.completed_at IS NOT NULL`).get(row.id).n
    }
  }));
  const versions = db.prepare("SELECT v.*,d.language FROM deck_versions v JOIN decks d ON d.id = v.deck_id ORDER BY v.deck_id,v.version").all().map(row => {
    const model = validateCards(cards.filter(c => c.versionId === row.id),row.book_id);
    let depth = 0;
    for (const card of model.cards) {
      let level = 1, parent = card.parentId;
      while (parent !== null) { level++; parent = model.byId.get(parent).parentId; }
      depth = Math.max(depth,level);
    }
    const version = { id:row.id,deckId:row.deck_id,bookId:row.book_id,number:row.version,
      status:row.status,editorialStatus:row.editorial_status,language:row.language,cardCount:model.cards.length,depth,
      title:{},description:{},editorialNote:{} };
    for (const t of db.prepare("SELECT * FROM deck_version_translations WHERE version_id = ?").all(row.id)) {
      version.title[t.language] = t.title;
      version.description[t.language] = t.description;
      version.editorialNote[t.language] = t.editorial_note;
    }
    for (const key of ["title","description","editorialNote"]) if (!version[key][version.language]?.trim()) throw new Error("Missing deck-language metadata");
    for (const siblings of model.children.values()) {
      if (siblings.some((c,i) => c.order !== i + 1)) throw new Error("Non-contiguous sibling order");
    }
    if (model.cards.some(card => !card.title[row.language] || !card.body[row.language])) throw new Error("Card is missing text in its deck language");
    return version;
  });
  return { schemaVersion:3,genres,books,decks,versions,cards };
}

export function checkCatalog(db) {
  if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Database integrity check failed");
  if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Broken references");
  const catalog = readCatalog(db);
  const ids = new Set(catalog.genres.map(g => g.id));
  if (catalog.genres.some(g => LANGUAGES.some(language => !g.name[language]?.trim()))) throw new Error("Missing genre translation");
  for (const book of catalog.books) {
    if (!book.genres.length || book.genres.some(id => !ids.has(id))) throw new Error("Missing book genre");
  }
  return { books:catalog.books.length,decks:catalog.decks.length,versions:catalog.versions.length,cards:catalog.cards.length,genres:catalog.genres.length };
}
